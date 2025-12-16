import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SearchResponsesDto {
  @ApiPropertyOptional({ description: 'Filtra por nombre (LIKE %name%)', example: 'Sí' })
  @IsOptional() @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Filtra por tipo (tinyint 0/1 u otros que uses)',
    example: 0,
  })
  @IsOptional() @Type(() => Number) @IsInt()
  type?: number;

  @ApiPropertyOptional({ description: 'Página (>=1)', example: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Límite (1..100)', example: 20, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Campo de orden',
    example: 'date_insert',
    enum: ['name', 'date_insert', 'id'],
    default: 'date_insert',
  })
  @IsOptional() @IsString()
  @IsIn(['name', 'date_insert', 'id'])
  orderBy?: 'name' | 'date_insert' | 'id' = 'date_insert';

  @ApiPropertyOptional({
    description: 'Dirección de orden',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @Transform(({ value }) => String(value || '').toUpperCase())
  @IsIn(['ASC', 'DESC'])
  orderDir?: 'ASC' | 'DESC' = 'DESC';
}
