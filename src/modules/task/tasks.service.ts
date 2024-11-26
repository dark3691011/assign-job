import { Injectable } from '@nestjs/common';
import { QueueV2Service } from '../assignments-v2/queue.service';

@Injectable()
export class TasksService {
  constructor(private readonly queueService: QueueV2Service) {}

  async createAndAssignTask(taskId: string, userId: string) {
    // Logic tạo nhiệm vụ (thêm vào DB)
    console.log(`Creating task ${taskId} and assigning to user ${userId}`);

    // Thêm vào queue
    // await this.queueService.addTaskToQueue(taskId, userId);
  }
}
