import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bullmq';
import { QueueV2Service } from './queue.service';
import { Interval } from '@nestjs/schedule';
import { BULL_QUEUE_NAME } from './index.constant';

@Processor(BULL_QUEUE_NAME)
export class QueueProcessor {
  constructor(private readonly queueService: QueueV2Service) {}

  @Process('assignTask')
  async handleAssignTask(job: Job) {
    const { taskId, userId } = job.data;

    try {
      console.log(`Processing task ${taskId} for user ${userId}`);
      await this.updateTaskStatus(taskId, userId, 'Assigned');
      console.log(`Task ${taskId} successfully assigned to user ${userId}`);
    } catch (error) {
      console.error(`Failed to assign task ${taskId} to user ${userId}:`, error);

      // Phân loại lỗi và xử lý
      await this.queueService.requeueBasedOnError({ taskId, userId, error });
    }
  }

  // Định kỳ kiểm tra và xử lý các task và user trong hàng đợi
  @Interval(5000) // Chạy mỗi 5 giây
  async handlePendingQueue() {
    console.log('Checking for pending tasks and users...');
    await this.queueService.assignPendingTasks();
  }

  private async updateTaskStatus(taskId: string, userId: string, status: string) {
    const randomValue = Math.random(); // Generate a random number between 0 and 1

    if (randomValue < 0.3) {
      // 30% chance of failure
      const isUserError = randomValue < 0.15; // 15% for USER_ERROR
      const error = new Error(isUserError ? 'Simulated user-related failure' : 'Simulated task-related failure');
      (error as any).code = isUserError ? 'USER_ERROR' : 'TASK_ERROR';
      throw error;
    }

    // No failure; proceed normally
    console.log(`Task ${taskId} updated to status "${status}" for user ${userId}`);
  }
}
