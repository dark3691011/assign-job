import { Injectable } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import {
  BULL_QUEUE_NAME,
  DARK_LIST_QUEUE_TASK,
  DARK_LIST_QUEUE_USER,
  EXPIRED_RETRY_COUNT,
  RETRY_TASK_COUNT,
  RETRY_USER_COUNT,
  TASK_QUEUE,
  USER_QUEUE,
} from './index.constant';

@Injectable()
export class QueueV2Service {
  private readonly redisClient: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectQueue(BULL_QUEUE_NAME) private readonly taskQueue: Queue,
  ) {
    this.redisClient = this.redisService.getOrThrow(
      this.configService.get('REDIS_CONNECTION'),
    );
  }

  /** Add a unique user to the Redis queue */
  async addUser(userId: string) {
    await this.addToQueueIfNotExists({
      queue: USER_QUEUE,
      id: userId,
      logPrefix: `User ${userId}`,
    });
  }

  /** Add a unique task to the Redis queue or assign it if a user is available */
  async addTask(taskId: string) {
    const userId = await this.redisClient.lpop(USER_QUEUE);
    if (userId) {
      await this.assignTaskToUser({ taskId, userId });
    } else {
      await this.addToQueueIfNotExists({
        queue: TASK_QUEUE,
        id: taskId,
        logPrefix: `Task ${taskId}`,
      });
    }
  }

  /** Assign pending tasks when a user is added */
  async assignPendingTasks() {
    const taskId = await this.redisClient.lpop(TASK_QUEUE);
    if (taskId) {
      const userId = await this.redisClient.lpop(USER_QUEUE);
      if (userId) {
        await this.assignTaskToUser({ taskId, userId });
      } else {
        await this.addToQueueIfNotExists({
          queue: TASK_QUEUE,
          id: taskId,
          logPrefix: `Task ${taskId}`,
          isFront: true,
        });
      }
    }
  }

  /** Handle requeue based on specific error types */
  async requeueBasedOnError({
    taskId,
    userId,
    error,
  }: {
    taskId: string;
    userId: string;
    error: any;
  }) {
    const retryConfigs = [
      {
        queue: USER_QUEUE,
        key: `${RETRY_USER_COUNT}${userId}`,
        id: userId,
        dlq: DARK_LIST_QUEUE_USER,
        type: 'User',
      },
      {
        queue: TASK_QUEUE,
        key: `${RETRY_TASK_COUNT}${taskId}`,
        id: taskId,
        dlq: DARK_LIST_QUEUE_TASK,
        type: 'Task',
      },
    ];

    for (const config of retryConfigs) {
      if (error.code === `${config.type.toUpperCase()}_ERROR`) {
        await this.retryOrDLQ(config);
        return;
      }
    }

    // Fallback for unknown errors
    await Promise.all(retryConfigs.map((config) => this.retryOrDLQ(config)));
  }

  /** Helper: Add a unique item to a Redis queue */
  private async addToQueueIfNotExists({
    queue,
    id,
    logPrefix,
    isFront = false,
  }: {
    queue: string;
    id: string;
    logPrefix: string;
    isFront?: boolean;
  }) {
    const exists = await this.redisClient.lpos(queue, id);
    if (exists === null) {
      await (isFront
        ? this.redisClient.lpush(queue, id)
        : this.redisClient.rpush(queue, id));
      console.log(`${logPrefix} added to Redis queue`);
    } else {
      console.log(`${logPrefix} already exists in Redis queue`);
    }
  }

  /** Helper: Retry or move to DLQ */
  private async retryOrDLQ({
    queue,
    key,
    id,
    dlq,
    type,
    skipCheck = false,
  }: {
    queue: string;
    key: string;
    id: string;
    dlq: string;
    type: string;
    skipCheck?: boolean;
  }) {
    if (skipCheck) {
      await this.addToQueueIfNotExists({ queue, id, logPrefix: `` });
      return;
    }

    const maxRetries = 3;
    const retries = Number((await this.redisClient.get(key)) || 0);

    if (retries >= maxRetries) {
      console.error(`${type} ${id} reached max retries. Moving to DLQ.`);
      await this.redisClient.rpush(dlq, id);
    } else {
      await this.redisClient.incr(key);
      await this.redisClient.expire(key, EXPIRED_RETRY_COUNT); // Reset TTL
      await this.redisClient.rpush(queue, id);
      console.log(
        `Retrying ${type.toLowerCase()} ${id} (Retry: ${retries + 1})`,
      );
    }
  }

  /** Helper: Assign a task to a user */
  private async assignTaskToUser({
    taskId,
    userId,
  }: {
    taskId: string;
    userId: string;
  }) {
    await this.taskQueue.add(`assignTask`, { taskId, userId });
    console.log(`Task ${taskId} assigned to user ${userId}`);
  }
}
