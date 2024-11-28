import { Controller, Post, Body, Delete } from '@nestjs/common';
import { QueueV2Service } from '../assignments-v2/queue.service';
import { ApiBody } from '@nestjs/swagger';
import { AddMultipleDto, AddQueueDto, AddUserDto } from './task.dto';
import { TASK_QUEUE, USER_QUEUE } from '../assignments-v2/index.constant';

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

  /** API: Xóa một user khỏi queue */
  @Delete('remove-user')
  @ApiBody({
    type: AddUserDto,
  })
  async removeUser(@Body('userId') userId: string) {
    const removed = await this.queueService.removeFromQueue({
      queue: USER_QUEUE,
      id: userId,
    });
    return removed
      ? { message: `User ${userId} removed from queue` }
      : { message: `User ${userId} not found in queue` };
  }

  /** API: Xóa một task khỏi queue */
  @Delete('remove-task')
  @ApiBody({
    type: AddQueueDto,
  })
  async removeTask(@Body('taskId') taskId: string) {
    const removed = await this.queueService.removeFromQueue({
      queue: TASK_QUEUE,
      id: taskId,
    });
    return removed
      ? { message: `Task ${taskId} removed from queue` }
      : { message: `Task ${taskId} not found in queue` };
  }

  /** API: Thêm nhiều users vào queue */
  @Post('add-multiple-users')
  @ApiBody({
    type: AddMultipleDto,
  })
  async addMultipleUsers(@Body('ids') userIds: string[]) {
    const result = await this.queueService.addMultipleToQueue(
      USER_QUEUE,
      userIds,
    );
    return { message: `${result} users added to queue` };
  }

  /** API: Thêm nhiều tasks vào queue */
  @Post('add-multiple-tasks')
  @ApiBody({
    type: AddMultipleDto,
  })
  async addMultipleTasks(@Body('ids') taskIds: string[]) {
    const result = await this.queueService.addMultipleToQueue(
      TASK_QUEUE,
      taskIds,
    );
    return { message: `${result} tasks added to queue` };
  }

  /** API: Thêm nhiều tasks vào queue */
  @Post('cc')
  async cc() {
    return this.queueService.a;
  }
}
