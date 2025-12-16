import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, Matches, Length } from 'class-validator';

export class UpdateSelfDto {
  @ApiPropertyOptional({ example: 'Ana', description: 'Nombre' })
  @IsOptional()
  @IsString()
  @Length(1, 45)
  name?: string;

  @ApiPropertyOptional({ example: 'López', description: 'Primer apellido' })
  @IsOptional()
  @IsString()
  @Length(1, 45)
  last_name_1?: string;

  @ApiPropertyOptional({ example: 'García', description: 'Segundo apellido' })
  @IsOptional()
  @IsString()
  @Length(0, 45)
  last_name_2?: string;

  @ApiPropertyOptional({ example: 'ana@example.com' })
  @IsOptional()
  @IsEmail()
  mail?: string;

  @ApiPropertyOptional({ example: '600123123' })
  @IsOptional()
  @IsString()
  @Length(0, 25)
  phone?: string;

  @ApiPropertyOptional({ example: '1992-03-14', description: 'YYYY-MM-DD' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Formato de fecha inválido (YYYY-MM-DD)' })
  birthday?: string;
}
