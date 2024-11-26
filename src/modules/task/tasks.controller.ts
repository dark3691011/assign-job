import { Controller, Post, Body } from '@nestjs/common';
import { QueueV2Service } from '../assignments-v2/queue.service';
import { ApiBody } from '@nestjs/swagger';
import { AddQueueDto, AddUserDto } from './task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly queueService: QueueV2Service) {}

  @Post('add-user')
  @ApiBody({
    type: AddUserDto,
  })
  async addUser(@Body('userId') userId: string) {
    await this.queueService.addUser(userId);
    await this.queueService.assignPendingTasks(); // Check and assign pending tasks
    return { message: `User ${userId} added and pending tasks assigned` };
  }

  @Post('add-task')
  @ApiBody({
    type: AddQueueDto,
  })
  async addTask(@Body('taskId') taskId: string) {
    await this.queueService.addTask(taskId);
    return { message: `Task ${taskId} added to queue` };
  }
}
