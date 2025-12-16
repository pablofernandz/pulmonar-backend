import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, Min, IsString, Length, IsOptional } from 'class-validator';

export class AddQuestionDto {
  @ApiProperty({ example: 1 }) @IsInt() @Min(1)
  idSection: number;

  @ApiProperty({ example: '¿Fuma actualmente?' })
  @IsString() @Length(1, 400)
  prompt: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @IsInt() @Min(1)
  position?: number;
}
