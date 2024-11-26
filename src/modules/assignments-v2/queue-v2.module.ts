import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { QueueV2Service } from './queue.service';
import { QueueProcessor } from './queue.processor';
import { ScheduleModule } from '@nestjs/schedule';
import { BULL_QUEUE_NAME } from './index.constant';

@Module({
  imports: [
    BullModule.registerQueue({
      name: BULL_QUEUE_NAME, // Tên hàng đợi
    }),
    ScheduleModule.forRoot(),
  ],
  providers: [QueueV2Service, QueueProcessor],
  exports: [QueueV2Service],
})
export class QueueV2Module {}
