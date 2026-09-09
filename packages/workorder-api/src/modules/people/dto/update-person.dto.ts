import { IsIn, IsOptional, IsString } from 'class-validator';
import { EMPLOYEE_IDENTITIES, USER_STATUSES } from '../people.constants';

export class UpdatePersonDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsIn([...EMPLOYEE_IDENTITIES])
  @IsOptional()
  identity?: (typeof EMPLOYEE_IDENTITIES)[number];

  @IsIn([...USER_STATUSES])
  @IsOptional()
  status?: (typeof USER_STATUSES)[number];
}
