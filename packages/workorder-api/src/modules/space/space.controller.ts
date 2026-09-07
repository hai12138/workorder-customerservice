import { Body, Controller, Delete, Get, Header, Param, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/guards/roles.guard';
import { SpaceService } from './space.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { QuerySpaceDto } from './dto/query-space.dto';
import { ImportSpaceDto } from './dto/import-space.dto';

@Controller('spaces')
@UseGuards(RolesGuard)
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  @Get()
  async list(@Query() query: QuerySpaceDto) {
    const spaces = await this.spaceService.findByProject(query.projectId, query.tree);
    return spaces;
  }

  @Get('template')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename=space_template.xlsx')
  async downloadTemplate() {
    const buffer = await this.spaceService.generateTemplate();
    return buffer;
  }

  @Post('import')
  @RequirePermissions('config:write')
  @UseInterceptors(FileInterceptor('file'))
  async importSpaces(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportSpaceDto,
  ) {
    return await this.spaceService.importSpaces(file, dto.projectId);
  }

  @Post()
  @RequirePermissions('config:write')
  async create(@Body() dto: CreateSpaceDto) {
    return await this.spaceService.create(dto);
  }

  @Put(':id')
  @RequirePermissions('config:write')
  async update(@Param('id') id: string, @Body() dto: UpdateSpaceDto) {
    return await this.spaceService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('config:write')
  async delete(@Param('id') id: string) {
    return await this.spaceService.delete(id);
  }
}
