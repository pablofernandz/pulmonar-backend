import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, IsDateString, IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ example: '2025-09-10T10:00:00' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 1, description: 'ID de statusappointment' })
  @IsInt()
  @Min(1)
  statusId: number;

  @ApiProperty({ example: 0, description: 'Tipo: tinyint(1) en BD' })
  @IsInt()
  @IsIn([0, 1])
  type: number;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  patientId: number;

  @ApiProperty({ example: 7 })
  @IsInt()
  @Min(1)
  revisorId: number;

  @ApiProperty({ required: false, maxLength: 400 })
  @IsOptional()
  @IsString()
  @MaxLength(400)
  comments?: string;
}
