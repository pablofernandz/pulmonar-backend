import { PartialType } from '@nestjs/mapped-types';
import { CreateAppointmentDto } from './create-appointment.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsDateString, IsString, MaxLength, IsIn } from 'class-validator';

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ example: '2025-09-10T11:00:00' })
  @IsOptional() @IsDateString()
  date?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional() @IsInt() @Min(1)
  statusId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @IsInt() @IsIn([0,1])
  type?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional() @IsInt() @Min(1)
  patientId?: number;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional() @IsInt() @Min(1)
  revisorId?: number;

  @ApiPropertyOptional({ maxLength: 400 })
  @IsOptional() @IsString() @MaxLength(400)
  comments?: string;
}
