import { IsOptional, IsString } from 'class-validator';

export class QueryRolesDto {
  @IsString()
  @IsOptional()
  status?: string;
}
