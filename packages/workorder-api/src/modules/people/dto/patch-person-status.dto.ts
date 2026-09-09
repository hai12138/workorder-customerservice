import { IsIn } from 'class-validator';
import { USER_STATUSES } from '../people.constants';

export class PatchPersonStatusDto {
  @IsIn([...USER_STATUSES], { message: 'status 必须是 有效 或 停用' })
  status!: (typeof USER_STATUSES)[number];
}
