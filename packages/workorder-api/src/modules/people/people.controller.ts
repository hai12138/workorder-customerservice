import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { RequirePermissions, RolesGuard } from '../../common/guards/roles.guard';
import { CreatePersonDto } from './dto/create-person.dto';
import { QueryPeopleDto } from './dto/query-people.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { USER_STATUS_ACTIVE, USER_STATUS_DISABLED } from './people.constants';
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

  @Post(':id/enable')
  @RequirePermissions('config:write')
  enable(@Param('id') id: string) {
    return this.people.setStatus(id, USER_STATUS_ACTIVE);
  }

  @Post(':id/disable')
  @RequirePermissions('config:write')
  disable(@Param('id') id: string) {
    return this.people.setStatus(id, USER_STATUS_DISABLED);
  }
}
