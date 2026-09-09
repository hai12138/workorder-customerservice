import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { USER_STATUSES } from '../people.constants';

export class QueryPeopleDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsIn([...USER_STATUSES])
  @IsOptional()
  status?: (typeof USER_STATUSES)[number];

  @IsString()
  @IsOptional()
  q?: string;
}
