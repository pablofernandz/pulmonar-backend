import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, IsOptional, IsDateString, Matches, IsEmail, MaxLength } from 'class-validator';

export class CreatePacienteDto {
  @ApiProperty({ example: 'Ana' })
  @IsString()
  @Length(1, 45)
  nombre: string;

  @ApiProperty({ example: 'López García', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 90)
  apellidos?: string;

  @ApiProperty({ example: '12345678Z', description: 'Documento único (DNI/NIF)' })
  @IsString()
  @Length(1, 20) 
  @Matches(/^[0-9A-Za-z\-]+$/)
  nif: string;

  @ApiProperty({ example: 'ana@example.com', description: 'Email único' })
  @IsEmail()
  @MaxLength(100) 
  mail: string;

  @ApiProperty({ required: false, example: '1980-01-01', format: 'date' })
  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string;
}
