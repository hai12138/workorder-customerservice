import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ALL_PEOPLE_IDENTITIES, PEOPLE_SCOPES, USER_STATUSES } from '../people.constants';

export class CreatePersonDto {
  @IsIn([...PEOPLE_SCOPES])
  @IsOptional()
  scope?: (typeof PEOPLE_SCOPES)[number];

  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsIn([...ALL_PEOPLE_IDENTITIES])
  @IsOptional()
  identity?: (typeof ALL_PEOPLE_IDENTITIES)[number];

  @IsIn([...USER_STATUSES])
  @IsOptional()
  status?: (typeof USER_STATUSES)[number];
}
