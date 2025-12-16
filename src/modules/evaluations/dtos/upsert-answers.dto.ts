import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsInt, Min, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class AnswerDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1)
  idSection!: number;

  @ApiProperty() @Type(() => Number) @IsInt() @Min(1)
  idQuestion!: number;

  @ApiProperty() @Type(() => Number) @IsInt() @Min(1)
  idResponse!: number;

  @ApiProperty({ required: false }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  idQuestionList?: number | null;

  @ApiProperty({ required: false }) @IsOptional() @IsString()
  value?: string | null;
}

export class UpsertAnswersDto {
  @ApiProperty({ type: [AnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers!: AnswerDto[];
}
