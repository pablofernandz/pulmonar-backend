import { IsDateString } from 'class-validator';

export class RescheduleDto {
  @IsDateString()
  date: string;
}
