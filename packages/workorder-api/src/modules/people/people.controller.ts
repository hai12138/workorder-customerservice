import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions, RolesGuard } from '../../common/guards/roles.guard';
import { CreatePersonDto } from './dto/create-person.dto';
import { PatchPersonStatusDto } from './dto/patch-person-status.dto';
import { QueryPeopleDto } from './dto/query-people.dto';
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

  @Patch(':id/status')
  @RequirePermissions('config:write')
  patchStatus(@Param('id') id: string, @Body() dto: PatchPersonStatusDto) {
    return this.people.setStatus(id, dto.status);
  }
}
