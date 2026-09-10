import { IsIn, IsOptional, IsString } from 'class-validator';
import { ALL_PEOPLE_IDENTITIES, USER_STATUSES } from '../people.constants';

export class UpdatePersonDto {
  @IsString()
  @IsOptional()
  name?: string;

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
