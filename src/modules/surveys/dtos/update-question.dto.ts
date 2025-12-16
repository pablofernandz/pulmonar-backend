import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateQuestionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Posición destino (1..N) dentro de la sección' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  targetOrder?: number;
}
