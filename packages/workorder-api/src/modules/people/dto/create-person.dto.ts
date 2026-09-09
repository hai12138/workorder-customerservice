import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EMPLOYEE_IDENTITIES } from '../people.constants';

export class CreatePersonDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsIn([...EMPLOYEE_IDENTITIES])
  @IsOptional()
  identity?: (typeof EMPLOYEE_IDENTITIES)[number];
}
