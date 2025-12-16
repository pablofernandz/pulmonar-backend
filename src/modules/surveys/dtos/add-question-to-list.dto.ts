import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddQuestionToListDto {
  @ApiProperty({ description: 'ID de la pregunta que se añadirá como ítem de la lista' })
  @IsInt()
  @Min(1)
  idQuestion!: number;

  @ApiPropertyOptional({
    description: 'Posición (1..n) dentro de la lista. Si se omite, se añade al final.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @ApiPropertyOptional({
    description:
      'Si es true y la pregunta está vinculada a alguna sección, la desvincula (DELETE en sectionquestion) antes de añadirla a la lista.',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsBoolean()
  forceDetach?: boolean;
}
