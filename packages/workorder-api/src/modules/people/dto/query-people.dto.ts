import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PEOPLE_SCOPES, USER_STATUSES } from '../people.constants';

export class QueryPeopleDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsIn([...PEOPLE_SCOPES])
  @IsOptional()
  scope?: (typeof PEOPLE_SCOPES)[number];

  @IsIn([...USER_STATUSES])
  @IsOptional()
  status?: (typeof USER_STATUSES)[number];

  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  identity?: string;
}
