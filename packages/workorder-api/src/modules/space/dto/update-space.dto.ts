import { IsString, IsOptional, IsEnum } from 'class-validator';
import { SpaceType, SpaceStatus } from './create-space.dto';

export class UpdateSpaceDto {
  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(SpaceType)
  @IsOptional()
  type?: SpaceType;

  @IsEnum(SpaceStatus)
  @IsOptional()
  status?: SpaceStatus;
}
