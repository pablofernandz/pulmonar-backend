import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class SelectRoleDto {
  @ApiProperty({ enum: ['coordinator', 'revisor', 'patient'] })
  @IsIn(['coordinator', 'revisor', 'patient'])
  role: 'coordinator' | 'revisor' | 'patient';
}

