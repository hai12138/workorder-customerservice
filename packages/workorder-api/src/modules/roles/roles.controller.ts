import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { QueryRolesDto } from './dto/query-roles.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(RolesGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list(@Query() query: QueryRolesDto, @CurrentUser() user: JwtPayload) {
    return this.roles.list(query, user.tenantId);
  }
}
