import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, ValidateIf, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserGroupsDto {
  @ApiPropertyOptional({ description: 'ID de grupo activo como PACIENTE; null = quitar todos' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  groupPatientId?: number | null;

  @ApiPropertyOptional({ description: 'ID de grupo activo como REVISOR (modo exclusivo legacy); null = quitar todos' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsInt()
  groupRevisorId?: number | null;

  @ApiPropertyOptional({
    type: [Number],
    description: '(Compat) Array de grupos PACIENTE; se usa solo el primero',
  })
  @IsOptional()
  @IsArray()
  groupsPatient?: number[];

  @ApiPropertyOptional({
    type: [Number],
    description: 'Grupos como REVISOR (multi-grupo). [] = quitar de todos',
  })
  @IsOptional()
  @IsArray()
  groupsRevisor?: number[];
}
