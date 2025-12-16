import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsDateString } from 'class-validator';

export class ListAppointmentsDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  patient?: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1)
  revisor?: number;

  @ApiPropertyOptional({ description: 'statusappointment.id' })
  @IsOptional() @IsInt() @Min(1)
  status?: number;

  @ApiPropertyOptional({ example: 0, description: '0 o 1' })
  @IsOptional() @IsInt() @Min(0) @Max(1)
  type?: number;

  @ApiPropertyOptional({ example: '2025-09-01T00:00:00' })
  @IsOptional() @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2025-09-30T23:59:59' })
  @IsOptional() @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 }) @IsOptional() @IsInt() @Min(1)
  limit?: number;
}
