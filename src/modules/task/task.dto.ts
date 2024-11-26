import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';

export class AddUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  userId: string;
}
export class AddQueueDto {
  @ApiProperty({ required: false })
  @IsOptional()
  taskId: string;
}
