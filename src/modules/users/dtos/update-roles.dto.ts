import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateRolesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  patient?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  revisor?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  coordinator?: boolean;
}
