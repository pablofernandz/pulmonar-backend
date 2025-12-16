import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class StatsGlobalQueryDto {
  
  @IsOptional() @IsString()
  from?: string; 

  @IsOptional() @IsString()
  to?: string;   

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  groupId?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  indexId?: number;

  @IsOptional() @IsString()
  indexName?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit: number = 5000;
}
