import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { AgentRuntimeService } from './agent-runtime.service';

@Controller()
export class AgentController {
  constructor(private readonly runtime: AgentRuntimeService) {}

  @Get('mcp-tools')
  tools() {
    return this.runtime.listTools();
  }

  @Get('skills')
  skills() {
    return this.runtime.listSkills();
  }

  @Get('agent-apps')
  apps() {
    return this.runtime.listApps();
  }

  @Get('agent-logs')
  logs() {
    return this.runtime.listLogs();
  }

  @Post('agent/capabilities/publish')
  publish(@Body() body: { version?: string }) {
    return this.runtime.publishCapabilities(body.version ?? `R-${Date.now().toString().slice(-4)}`);
  }

  @Post('agent/sandbox/submit-draft')
  sandbox(
    @Body() body: { idempotencyKey?: string; draft?: Record<string, unknown>; projectId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.runtime
      .createDraft({
        type_code: String(body.draft?.type_code ?? 'REPAIR'),
        title: String(body.draft?.title ?? 'Agent 沙箱草稿工单'),
        description: body.draft?.description ? String(body.draft.description) : undefined,
        projectId: body.projectId,
        actorId: user.sub,
        idempotencyKey: body.idempotencyKey,
      })
      .then(async (draft) => {
        const submitted = await this.runtime.submit(draft.id, user.sub);
        return { ok: true, message: '联调通过：工单已在沙箱中创建', workorder: submitted };
      });
  }

  // --- MCP / SDK compatible runtime ---
  @Get('workorder-types')
  listTypes(@Query('projectId') projectId?: string) {
    return this.runtime.listTypes(projectId);
  }

  @Get('workorder-types/:code/form-schema')
  formSchema(@Param('code') code: string, @Query('projectId') projectId?: string) {
    return this.runtime.formSchema(code, projectId);
  }

  @Get('config/summary')
  summary(@Query('projectId') projectId?: string) {
    return this.runtime.configSummary(projectId);
  }

  @Post('workorders/draft')
  createDraft(
    @Body()
    body: {
      type_code: string;
      title?: string;
      description?: string;
      contact_phone?: string;
      extra_fields?: Record<string, unknown>;
      projectId?: string;
      idempotencyKey?: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.runtime.createDraft({ ...body, actorId: user.sub });
  }

  @Post('workorders/:id/submit')
  submit(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.runtime.submit(id, user.sub);
  }

  @Get('workorders/no/:workorderNo')
  getByNo(@Param('workorderNo') workorderNo: string) {
    return this.runtime.getByNo(workorderNo);
  }

  @Get('workorders/:id')
  get(@Param('id') id: string) {
    return this.runtime.get(id);
  }

  @Get('workorders')
  list(
    @Query('status') status?: string,
    @Query('type_code') type_code?: string,
    @Query('keyword') keyword?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.runtime.list({ status, type_code, keyword, projectId });
  }

  @Get('tasks/todo')
  todo(@CurrentUser() user: JwtPayload) {
    return this.runtime.list({ status: '待接单' }).then((rows) =>
      rows.map((w) => ({
        id: `task_${w.id}`,
        workorder_id: w.id,
        workorder_no: w.workorder_no,
        title: w.title,
        status: w.status,
        assignee: user.name,
      })),
    );
  }
}
