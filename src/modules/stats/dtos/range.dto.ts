import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class RangeDto {
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

  @ApiPropertyOptional({
    example: 3,
    description: 'Filtra por grupo “vigente” en la fecha de la evaluación (JOIN histórico).',
  })
  @IsOptional() @IsInt() @Min(1)
  @Transform(({ value }) => (value !== undefined ? Number(value) : value))
  groupId?: number;
}
