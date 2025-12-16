import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min, Max } from 'class-validator';

export class DuplicateSurveyDto {
  @ApiProperty({ example: 'Historia Clínica (copia)' })
  @IsString()
  @Length(1, 45)
  name!: string;

  @ApiPropertyOptional({ example: 0, description: '0 = historia, 1 = revisión (opcional)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1)
  type?: number;

  @ApiProperty({ example: 2, description: 'ID del coordinator propietario del nuevo formulario' })
  @IsInt()
  @Min(1)
  idCoordinator!: number;
}
