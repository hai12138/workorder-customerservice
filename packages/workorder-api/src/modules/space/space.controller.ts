import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/guards/roles.guard';
import { SpaceService } from './space.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { QuerySpaceDto } from './dto/query-space.dto';

@Controller('spaces')
@UseGuards(RolesGuard)
export class SpaceController {
  constructor(private readonly spaceService: SpaceService) {}

  @Get()
  async list(@Query() query: QuerySpaceDto) {
    const spaces = await this.spaceService.findByProject(query.projectId, query.tree);
    return spaces;
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
