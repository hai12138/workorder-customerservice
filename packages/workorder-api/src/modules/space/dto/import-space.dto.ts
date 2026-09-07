import { IsString, IsNotEmpty } from 'class-validator';

export class ImportSpaceDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;
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
