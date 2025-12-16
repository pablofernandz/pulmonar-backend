import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateListDto {
  @ApiProperty({ required: false, default: 'Lista de elementos' })
  @IsOptional() @IsString() listname?: string;
}
