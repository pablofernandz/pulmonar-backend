import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class EvalsQueryDto {
  @ApiPropertyOptional({
    example: '2025-09-01 00:00:00',
    description: 'Fecha inicio (DATETIME BD o ISO). Inclusiva.',
  })
  @IsOptional() @IsString()
  from?: string;

  @ApiPropertyOptional({
    example: '2025-09-30 23:59:59',
    description: 'Fecha fin (DATETIME BD o ISO). Inclusiva.',
  })
  @IsOptional() @IsString()
  to?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  groupId?: number;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  revisor?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  patient?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  survey?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  limit?: number;
}
