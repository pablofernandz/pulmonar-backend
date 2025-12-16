import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Length, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateSurveyDto {
  @ApiProperty({ example: 'Cuestionario Pulmonar v1' })
  @IsString() @Length(1, 45)
  name: string;

  @ApiProperty({ example: 2, description: 'ID de coordinator (requerido por DDL)' })
  @IsInt() @Min(1)
  idCoordinator: number;

  @ApiPropertyOptional({ example: 0, description: '0 = clinic history, 1 = revision' })
  @IsOptional() @IsInt() @Min(0) @Max(1)
  type?: number;
}
