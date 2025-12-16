import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateResponseDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ description: '0/1', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  type?: number;

  @ApiPropertyOptional({ maxLength: 45 })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  unity?: string;

  @ApiPropertyOptional({ maxLength: 45 })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  min?: string;

  @ApiPropertyOptional({ maxLength: 45 })
  @IsOptional()
  @IsString()
  @MaxLength(45)
  max?: string;
}
