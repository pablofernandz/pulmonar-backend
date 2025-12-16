import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, IsInt } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateGroupDto {
  @ApiProperty({ example: 'Grupo A' })
  @IsString()
  @Length(1, 45)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiProperty({ example: 12, description: 'ID de encuesta de Historia (story)' })
  @Type(() => Number)
  @IsInt()
  story: number;

  @ApiProperty({ example: 34, description: 'ID de encuesta de Revisión (revision)' })
  @Type(() => Number)
  @IsInt()
  revision: number;
}
