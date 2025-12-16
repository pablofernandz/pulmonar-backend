import { IsInt, Min, Max, IsOptional, IsIn, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  orderBy?: string;

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  orderDir?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'ASC';
}
