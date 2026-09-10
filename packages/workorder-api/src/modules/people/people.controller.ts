import { Body, Controller, Get, Param, Post, Put, Query, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RequirePermissions, RolesGuard } from '../../common/guards/roles.guard';
import { CreatePersonDto } from './dto/create-person.dto';
import { ImportPeopleDto } from './dto/import-people.dto';
import { QueryPeopleDto } from './dto/query-people.dto';
import { QueryPeopleTemplateDto } from './dto/query-people-template.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PeopleService } from './people.service';

@Controller('people')
@UseGuards(RolesGuard)
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get()
  list(@Query() query: QueryPeopleDto) {
    return this.people.list(query);
  }

  @Get('template')
  async downloadTemplate(@Query() query: QueryPeopleTemplateDto) {
    const buffer = await this.people.generateTemplate(query.scope);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename=people_${query.scope}_template.xlsx`,
    });
  }

  @Post('import')
  @RequirePermissions('config:write')
  @UseInterceptors(FileInterceptor('file'))
  importPeople(@UploadedFile() file: Express.Multer.File, @Body() dto: ImportPeopleDto) {
    return this.people.importPeople(file, dto.projectId, dto.scope);
  }

  @Post()
  @RequirePermissions('config:write')
  create(@Body() dto: CreatePersonDto) {
    return this.people.create(dto);
  }

  @Put(':id')
  @RequirePermissions('config:write')
  update(@Param('id') id: string, @Body() dto: UpdatePersonDto) {
    return this.people.update(id, dto);
  }
}
