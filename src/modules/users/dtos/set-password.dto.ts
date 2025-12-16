import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class SetPasswordDto {
  @ApiProperty({ example: 'NuevaPass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword!: string;
}
