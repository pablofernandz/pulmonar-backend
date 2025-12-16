import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsIn } from 'class-validator';
import { CreatePacienteDto } from './create-paciente.dto';
import { Transform } from 'class-transformer';

export class UpdatePacienteDto extends PartialType(CreatePacienteDto) {
  @ApiProperty({ required: false, example: 'ana.nuevo@example.com', description: 'Alias de mail (compatibilidad)' })
  @IsOptional()
  @IsEmail()
  @Transform(({ value, obj }) => obj.mail ?? value)
  email?: string;

  @ApiProperty({ required: false, enum: [0, 1], example: 1 })
  @IsOptional()
  @IsIn([0, 1])
  deleted?: number;
}
