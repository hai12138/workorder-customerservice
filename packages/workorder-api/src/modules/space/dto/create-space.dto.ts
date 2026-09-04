import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum SpaceType {
  BUILDING = '楼栋',
  FLOOR = '楼层',
  ROOM = '房间',
  PUBLIC = '公区',
  PARKING = '车位',
}

export enum SpaceStatus {
  AVAILABLE = '可用',
  DISABLED = '停用',
}

export class CreateSpaceDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(SpaceType)
  @IsNotEmpty()
  type!: SpaceType;

  @IsEnum(SpaceStatus)
  @IsOptional()
  status?: SpaceStatus;
}
