import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min, IsString, Length, IsOptional } from 'class-validator';

export class AddSectionDto {
  @ApiProperty({ example: 1 }) @IsInt() @Min(1)
  idSurvey: number;

  @ApiProperty({ example: 'Datos demográficos' })
  @IsString() @Length(1, 200)
  title: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @IsInt() @Min(1)
  position?: number;
}
