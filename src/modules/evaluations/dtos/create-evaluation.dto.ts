import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEvaluationDto {
  @ApiProperty({ example: 5 })
  @Type(() => Number) @IsInt() @Min(1)
  idPatient: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number) @IsInt() @Min(1)
  idSurvey: number;

  @ApiPropertyOptional({
    example: 9,
    description: 'Revisor que crea. Si no se envía y el usuario es revisor, se usa el del token.',
  })
  @IsOptional()
  @Type(() => Number) @IsInt() @Min(1)
  idRevisor?: number;

  @ApiPropertyOptional({ example: '2025-09-10T10:00:00' })
  @IsOptional() @IsDateString()
  date?: string;
}
