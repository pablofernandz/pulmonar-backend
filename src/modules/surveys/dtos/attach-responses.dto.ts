import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AttachResponsesDto {
  @ApiProperty({
    example: [11, 12, 25],
    description: 'IDs de respuestas EXISTENTES a adjuntar a la pregunta (en ese orden).',
    type: [Number],
  })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  responseIds!: number[];

  @ApiPropertyOptional({
    example: 0,
    description:
      'Insertar después de este orden actual (1..N). Si no se envía, apendea al final. Usa 0 para insertar al principio.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  insertAfterOrder?: number; 
}
