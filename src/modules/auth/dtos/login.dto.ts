import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ example: '12345678' })
  @IsString()
  @Length(1, 20)                 
  @Matches(/^[0-9A-Za-z\-]+$/)  
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  dni: string;

  @ApiProperty({ example: 'Contraseña' })
  @IsString()
  @Length(3, 100)
  password: string;
}
