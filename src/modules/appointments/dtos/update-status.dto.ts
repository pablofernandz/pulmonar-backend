import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateStatusDto {
  @IsOptional()
  @IsInt()
  statusId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  statusName?: string;
}
