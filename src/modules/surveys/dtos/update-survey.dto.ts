import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSurveyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(45) 
  name?: string;
}
