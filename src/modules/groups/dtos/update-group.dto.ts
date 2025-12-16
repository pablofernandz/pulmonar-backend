import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateGroupDto {
  @ApiPropertyOptional({ description: 'Nombre del grupo (opcional)' })
  @IsOptional() @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'ID de encuesta para story; null = limpiar' })
  @IsOptional() @Type(() => Number)
  story?: number | null;

  @ApiPropertyOptional({ description: 'ID de encuesta para revision; null = limpiar' })
  @IsOptional() @Type(() => Number)
  revision?: number | null;
}
