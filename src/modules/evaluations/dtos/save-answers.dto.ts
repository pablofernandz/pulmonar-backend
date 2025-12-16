import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsInt, Min, IsOptional, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

class AnswerDto {
  @ApiProperty({ example: 3 })
  @Type(() => Number) @IsInt() @Min(1)
  idSection: number;

  @ApiProperty({ example: 12 })
  @Type(() => Number) @IsInt() @Min(1)
  idQuestion: number;

  @ApiProperty({ example: 4 })
  @Type(() => Number) @IsInt() @Min(1)
  idResponse: number;

  @ApiPropertyOptional({ example: 7, description: 'nullable en BD' })
  @Transform(({ value }) => (value === null || value === undefined ? undefined : value))
  @IsOptional()
  @Type(() => Number) @IsInt() @Min(1)
  idQuestionList?: number;

  @ApiPropertyOptional({
    example: 'Texto libre / número como string / JSON string',
    description: 'Se guarda en evaluation_question.value (TEXT).',
  })
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? value : String(value)))
  @IsString()
  value?: string | null;
}

export class SaveAnswersDto {
  @ApiProperty({ type: [AnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
