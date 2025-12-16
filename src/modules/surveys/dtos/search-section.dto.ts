import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SearchSectionsDto {
  @ApiPropertyOptional({ example: 'Antecedentes', description: 'Filtro por nombre (LIKE %name%)' })
  @IsOptional() @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 2, description: 'Filtrar por idCoordinator (propietario)' })
  @IsOptional() @IsInt() @Min(1)
  idCoordinator?: number;

  @ApiPropertyOptional({ example: 1, description: 'Página (>=1)' })
  @IsOptional() @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, description: 'Límite (1..100)' })
  @IsOptional() @IsInt() @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 'name', description: 'Campo de orden: name | date_insert | id' })
  @IsOptional() @IsString()
  orderBy?: string;

  @ApiPropertyOptional({ example: 'ASC', description: 'Dirección de orden: ASC | DESC' })
  @IsOptional() @IsString()
  orderDir?: 'ASC' | 'DESC' | 'asc' | 'desc';
}
