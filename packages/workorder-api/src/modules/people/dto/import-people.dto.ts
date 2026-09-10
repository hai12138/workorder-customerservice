import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { PEOPLE_SCOPES, type PeopleScope } from '../people.constants';

export class ImportPeopleDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsIn([...PEOPLE_SCOPES])
  @IsNotEmpty()
  scope!: PeopleScope;
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  imported?: number;
  errors?: ImportError[];
}
