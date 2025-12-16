import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AddPatientDto {
  @ApiProperty({ example: 1 }) @IsInt() @Min(1)
  idGroup: number;

  @ApiProperty({ example: 5 }) @IsInt() @Min(1)
  idPaciente: number;
}
