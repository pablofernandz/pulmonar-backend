import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchUsersDto {
  @ApiPropertyOptional({ description: 'Texto libre: name, apellidos, mail; DNI exacto' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: ['patient', 'revisor', 'coordinator'] })
  @IsOptional()
  @IsIn(['patient', 'revisor', 'coordinator'])
  role?: 'patient' | 'revisor' | 'coordinator';

  @ApiPropertyOptional({ description: 'Filtrar por grupo como PACIENTE (id)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  groupPatientId?: number;

  @ApiPropertyOptional({ description: 'Filtrar por grupo como REVISOR (id)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  groupRevisorId?: number;

  @ApiPropertyOptional({ description: 'Desde (YYYY-MM-DD) sobre date_insert' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta (YYYY-MM-DD) sobre date_insert' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    enum: ['date_insert', 'name', 'last_name_1', 'dni', 'mail'],
    default: 'date_insert',
  })
  @IsOptional()
  @IsIn(['date_insert', 'name', 'last_name_1', 'dni', 'mail'])
  sort: 'date_insert' | 'name' | 'last_name_1' | 'dni' | 'mail' = 'date_insert';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;
}
