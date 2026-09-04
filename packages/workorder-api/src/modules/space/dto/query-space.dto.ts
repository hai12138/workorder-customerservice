import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class QuerySpaceDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  tree?: boolean;
}
