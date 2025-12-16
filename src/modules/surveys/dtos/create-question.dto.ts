import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateQuestionDto {
  @ApiProperty({ description: 'Título/texto de la pregunta' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Posición (1..N) dentro de la sección. Si no se envía, va al final.',
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetOrder?: number;
}
