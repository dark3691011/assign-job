import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { QueueV2Module } from '../assignments-v2/queue-v2.module';

@Module({
  imports: [QueueV2Module],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
