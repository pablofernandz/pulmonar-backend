import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSectionDto {
  @ApiPropertyOptional({ description: 'Nombre de la sección' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({
    description: 'Posición (1..N) dentro del formulario. Si no lo envías, va al final.',
    minimum: 1,
    example: 1,       
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  targetOrder?: number;
}
