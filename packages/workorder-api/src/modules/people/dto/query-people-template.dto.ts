import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { PEOPLE_SCOPES, type PeopleScope } from '../people.constants';

export class QueryPeopleTemplateDto {
  @IsIn([...PEOPLE_SCOPES])
  @IsNotEmpty()
  @IsString()
  scope!: PeopleScope;
}
