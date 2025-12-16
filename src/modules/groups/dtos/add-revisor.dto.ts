import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AddRevisorDto {
  @ApiProperty({ example: 1 }) @IsInt() @Min(1)
  idGroup: number;

  @ApiProperty({ example: 9 }) @IsInt() @Min(1)
  idRevisor: number;
}
