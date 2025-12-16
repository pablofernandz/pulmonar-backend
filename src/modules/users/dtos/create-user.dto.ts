import {
  IsOptional,
  IsString,
  IsEmail,
  IsDateString,
  IsBoolean,
  IsIn,
  MinLength,
  MaxLength,
  IsInt,
  IsArray,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString() @MaxLength(50) name: string;
  @IsString() @MaxLength(50) last_name_1: string;
  @IsOptional() @IsString() @MaxLength(50) last_name_2?: string;

  @IsString() @MaxLength(12) dni: string;
  @IsOptional() @IsEmail() mail?: string;

  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsDateString() birthday?: string;
  @IsOptional() @IsIn(['H','M']) sex?: 'H'|'M';

  @IsString() @MinLength(8) @MaxLength(100) password: string;
  @IsOptional() @IsBoolean() isValidate?: boolean;

  @IsOptional() @IsBoolean() patient?: boolean;
  @IsOptional() @IsBoolean() revisor?: boolean;
  @IsOptional() @IsBoolean() coordinator?: boolean;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @Type(() => Number)
  @IsInt()
  groupPatientId?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null)
  @Type(() => Number)
  @IsInt()
  groupRevisorId?: number | null;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  groupsRevisor?: number[];
}
