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
  RE_ADD_QUEUE_TASK,
  RE_ADD_QUEUE_USER,
  RETRY_TASK_COUNT,
  RETRY_USER_COUNT,
  TASK_QUEUE,
  TYPE_QUEUE_ENUM,
  USER_QUEUE,
} from './index.constant';

@Injectable()
export class QueueV2Service {
  private readonly redisClient: Redis;
  a = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectQueue(BULL_QUEUE_NAME) private readonly taskQueue: Queue,
  ) {
    this.redisClient = this.redisService.getOrNil(
      this.configService.get('REDIS_CONNECTION'),
    );
  }

  /** Add a unique user to the Redis queue */
  async addUser(userId: string): Promise<void> {
    await this.addToQueueIfNotExists({
      queue: USER_QUEUE,
      id: userId,
      logPrefix: `User ${userId}`,
    });
  }

  /** Add a unique task to the Redis queue or assign it if a user is available */
  async addTask(taskId: string): Promise<void> {
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
  async assignPendingTasks(): Promise<void> {
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
  }): Promise<void> {
    const retryConfigs = [
      {
        queue: USER_QUEUE,
        key: `${RETRY_USER_COUNT}${userId}`,
        id: userId,
        dlq: DARK_LIST_QUEUE_USER,
        type: TYPE_QUEUE_ENUM.USER,
        errorReAdd: RE_ADD_QUEUE_USER,
      },
      {
        queue: TASK_QUEUE,
        key: `${RETRY_TASK_COUNT}${taskId}`,
        id: taskId,
        dlq: DARK_LIST_QUEUE_TASK,
        type: TYPE_QUEUE_ENUM.TASK,
        errorReAdd: RE_ADD_QUEUE_TASK,
      },
    ];

    for (const config of retryConfigs) {
      if (config.errorReAdd.includes(error.code)) {
        await this.retryOrDLQ({ ...config, skipCheck: true });
        return;
      }
    }

    // Handle unknown errors for all configurations
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
  }): Promise<void> {
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
  }): Promise<void> {
    if (skipCheck) {
      await this.addToQueueIfNotExists({
        queue,
        id,
        logPrefix: ``,
        isFront: true,
      });
      return;
    }

    const maxRetries = 3;
    const retries = Number((await this.redisClient.get(key)) || 0);

    if (retries >= maxRetries) {
      console.error(`${type} ${id} reached max retries.`);

      if (type === TYPE_QUEUE_ENUM.USER) {
        // Add user back to the queue to retry later
        await this.addToQueueIfNotExists({
          queue,
          id,
          logPrefix: `User ${id}`,
        });
      } else {
        // Move task to DLQ if retries exceeded
        await this.redisClient.rpush(dlq, id);
      }
    } else {
      await this.redisClient.incr(key);
      await this.redisClient.expire(key, EXPIRED_RETRY_COUNT);
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
  }): Promise<void> {
    await this.taskQueue.add('assignTask', { taskId, userId });
    console.log(`Task ${taskId} assigned to user ${userId}`);
  }

  async removeFromQueue({
    queue,
    id,
  }: {
    queue: string;
    id: string;
  }): Promise<boolean> {
    const index = await this.redisClient.lpos(queue, id);
    if (index !== null) {
      await this.redisClient.lrem(queue, 1, id);
      console.log(`${id} removed from ${queue}`);
      return true;
    }
    console.log(`${id} not found in ${queue}`);
    return false;
  }

  /** Thêm nhiều phần tử vào queue sử dụng pipeline */
  async addMultipleToQueue(queue: string, ids: string[]): Promise<number> {
    const pipeline = this.redisClient.pipeline();
    let addedCount = 0;

    for (const id of ids) {
      const exists = await this.redisClient.lpos(queue, id);
      if (exists === null) {
        pipeline.rpush(queue, id); // Chỉ thêm nếu không tồn tại
        addedCount++;
      }
    }

    await pipeline.exec();
    console.log(`${addedCount} items added to ${queue}`);
    return addedCount;
  }

  /** Assign all pending tasks to available users */
  async assignPendingTaskss(): Promise<void> {
    while (true) {
      const [taskId, userId] = await Promise.all([
        this.redisClient.lpop(TASK_QUEUE),
        this.redisClient.lpop(USER_QUEUE),
      ]);

      if (!taskId || !userId) {
        // Thoát khi không còn task hoặc user nào để gán
        if (taskId) {
          // Nếu còn task mà hết user, trả lại task vào đầu queue
          await this.addToQueueIfNotExists({
            queue: TASK_QUEUE,
            id: taskId,
            logPrefix: `Task ${taskId}`,
            isFront: true,
          });
        }

        if (userId) {
          // Nếu còn user mà hết task, trả lại user vào queue
          await this.addToQueueIfNotExists({
            queue: USER_QUEUE,
            id: userId,
            logPrefix: `User ${userId}`,
          });
        }
        break;
      }

      // Gán task cho user
      await this.assignTaskToUser({ taskId, userId });
    }
  }

  cc(body) {
    this.a.push(body);
  }
}
