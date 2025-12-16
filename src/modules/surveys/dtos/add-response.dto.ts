import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AddResponseDto {
  @ApiProperty({ description: 'ID de la respuesta existente a vincular', minimum: 1, example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idResponse!: number;

  @ApiPropertyOptional({
    description: 'Posición (1..N) dentro de la lista de respuestas de la pregunta. Si no se envía, va al final.',
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetOrder?: number;
}
