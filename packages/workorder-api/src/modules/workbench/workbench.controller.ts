import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { RequirePermissions, RolesGuard } from '../../common/guards/roles.guard';
import { WorkbenchService } from './workbench.service';

@Controller()
@UseGuards(RolesGuard)
export class WorkbenchController {
  constructor(private readonly workbench: WorkbenchService) {}

  @Get('workbench/bootstrap')
  bootstrap(@Query('projectId') projectId?: string) {
    return this.workbench.bootstrap(projectId);
  }

  @Get('dashboard/summary')
  dashboard(@Query('projectId') projectId?: string) {
    return this.workbench.bootstrap(projectId).then((s) => ({
      ...s.dashboard,
      activities: s.activities,
      attention: s.records.workorders?.slice(0, 4) ?? [],
      projectId: s.projectId,
    }));
  }

  @Post('workbench/collections/:name')
  create(
    @Param('name') name: string,
    @Body() body: { title: string; subtitle?: string; values?: Record<string, string | number>; projectId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workbench.create(name, body, body.projectId, user.sub).then((snapshot) => ({
      record: snapshot.records[name]?.[0],
      snapshot,
    }));
  }

  @Post('workbench/commands')
  execute(
    @Body()
    body: {
      type: string;
      version?: string;
      id?: string;
      assignee?: string;
      idempotencyKey?: string;
      projectId?: string;
    },
  ) {
    return this.workbench.execute(body as never, body.projectId);
  }

  @Post('workbench/reset')
  reset() {
    return this.workbench.resetDemo();
  }

  @Post('config/draft')
  createDraft(@Body() body: { projectId?: string }) {
    return this.workbench.ensureDraft(body.projectId);
  }

  @Get('config/diff')
  diff(@Query('projectId') projectId?: string) {
    return this.workbench.configDiff(projectId);
  }

  @Post('config/publish')
  @RequirePermissions('config:publish')
  publish(@Body() body: { version?: string; projectId?: string }) {
    return this.workbench.execute(
      { type: 'publish-config', version: body.version ?? 'V4', projectId: body.projectId },
      body.projectId,
    );
  }

  @Get('projects')
  projects(@Query('projectId') projectId?: string) {
    return this.workbench.bootstrap(projectId).then((s) => s.records.projects);
  }

  @Get('catalog/:name')
  catalog(@Param('name') name: string, @Query('projectId') projectId?: string) {
    return this.workbench.bootstrap(projectId).then((s) => ({
      records: s.records[name] ?? [],
      total: (s.records[name] ?? []).length,
    }));
  }

  @Get('flows/:key')
  getFlow(@Param('key') key: string, @Query('projectId') projectId?: string) {
    return this.workbench.getFlow(key, projectId);
  }

  @Put('flows/:key')
  @RequirePermissions('config:write')
  putFlow(
    @Param('key') key: string,
    @Body() body: { name?: string; definition?: unknown; projectId?: string },
  ) {
    return this.workbench.putFlow(key, body);
  }

  @Get('sla-policies')
  getSla(@Query('projectId') projectId?: string) {
    return this.workbench.getSlaPolicies(projectId);
  }

  @Put('sla-policies')
  @RequirePermissions('config:write')
  putSla(
    @Body()
    body: {
      projectId?: string;
      policies: Array<{
        id?: string;
        typeCode: string;
        nodeKey?: string;
        timeoutHours: number;
        escalationAction?: string;
      }>;
    },
  ) {
    return this.workbench.putSlaPolicies(body);
  }

  @Post('workorders/:id/assign')
  @RequirePermissions('workorder:assign')
  assign(
    @Param('id') id: string,
    @Body() body: { assigneeId?: string; assignee?: string; projectId?: string },
  ) {
    return this.workbench.execute(
      {
        type: 'assign-workorder',
        id,
        assignee: body.assigneeId ?? body.assignee ?? '',
      },
      body.projectId,
    );
  }
}
