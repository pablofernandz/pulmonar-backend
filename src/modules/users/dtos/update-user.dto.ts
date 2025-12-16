import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, MaxLength, IsDateString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Primer apellido' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name_1?: string;

  @ApiPropertyOptional({ description: 'Segundo apellido' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name_2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  mail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  birthday?: string;
}
