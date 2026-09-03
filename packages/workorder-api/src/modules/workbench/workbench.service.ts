import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { entity, type EntityRecord, toneFromStatus } from '../../common/entity-record';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { NotificationDispatcher } from '../notify/notify.service';

type WorkbenchCommand =
  | { type: 'publish-config'; version: string; projectId?: string }
  | { type: 'retry-delivery'; id: string }
  | { type: 'submit-agent-draft'; idempotencyKey: string; projectId?: string }
  | { type: 'publish-agent'; version: string }
  | { type: 'assign-workorder'; id: string; assignee: string };

@Injectable()
export class WorkbenchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notify: NotificationDispatcher,
  ) {}

  private async defaultProjectId(projectId?: string) {
    if (projectId) return projectId;
    const p = await this.prisma.project.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!p) throw new BadRequestException('请先创建项目');
    return p.id;
  }

  async bootstrap(projectId?: string) {
    const pid = await this.defaultProjectId(projectId);
    const records = await this.loadAllCollections(pid);
    const activities = await this.prisma.activityLog.findMany({
      where: { OR: [{ projectId: pid }, { projectId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return {
      version: Date.now(),
      projectId: pid,
      records,
      activities: activities.map((a) => ({
        id: a.id,
        at: a.createdAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        title: a.title,
        detail: a.detail ?? '',
        tone: a.tone as EntityRecord['tone'],
      })),
      dashboard: await this.dashboardSummary(pid),
    };
  }

  async dashboardSummary(projectId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    const [todayCount, pendingAssign, inProgress, completedToday, total, completed] = await Promise.all([
      this.prisma.workOrder.count({ where: { projectId, createdAt: { gte: today } } }),
      this.prisma.workOrder.count({ where: { projectId, status: '待分派' } }),
      this.prisma.workOrder.count({ where: { projectId, status: { in: ['处理中', '待接单'] } } }),
      this.prisma.workOrder.count({ where: { projectId, status: '已完成', updatedAt: { gte: today } } }),
      this.prisma.workOrder.count({ where: { projectId } }),
      this.prisma.workOrder.count({ where: { projectId, status: '已完成' } }),
    ]);
    const rate = total ? Math.round((completed / total) * 1000) / 10 : 100;
    const published = await this.prisma.configVersion.findFirst({
      where: { projectId, status: 'published' },
      orderBy: { publishedAt: 'desc' },
    });
    const draft = await this.prisma.configVersion.findFirst({
      where: { projectId, status: 'draft' },
      orderBy: { createdAt: 'desc' },
    });
    const attention = await this.prisma.workOrder.findMany({
      where: { projectId, status: { in: ['待分派', '待接单', '处理中'] } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return {
      projectName: project?.name ?? '—',
      projectStatus: project?.status ?? '—',
      publishedLabel: published?.label ?? '—',
      draftLabel: draft?.label ?? '—',
      metrics: [
        { label: '今日新增', value: String(todayCount), detail: '今日创建工单', tone: 'info' },
        { label: '待分派', value: String(pendingAssign), detail: pendingAssign ? '需关注' : '暂无积压', tone: pendingAssign ? 'warning' : 'ok' },
        { label: '处理中', value: String(inProgress), detail: '待接单+处理中', tone: 'warning' },
        { label: '今日已完成', value: String(completedToday), detail: `累计完成率 ${rate}%`, tone: 'ok' },
      ],
      attention: attention.map((w) => ({
        id: w.id,
        workorderNo: w.workorderNo,
        title: w.title,
        status: w.status,
        spaceLabel: w.spaceLabel ?? '—',
        slaLabel: w.slaLabel ?? '—',
      })),
    };
  }

  private async loadAllCollections(projectId: string): Promise<Record<string, EntityRecord[]>> {
    const [
      projects,
      spaces,
      people,
      roles,
      published,
      draft,
      plans,
      messages,
      workorders,
      exceptions,
      policies,
      templates,
      bindings,
      deliveries,
      tools,
      skills,
      apps,
      logs,
    ] = await Promise.all([
      this.prisma.project.findMany({ orderBy: { createdAt: 'asc' } }),
      this.prisma.space.findMany({ where: { projectId }, include: { parent: true, children: true } }),
      this.prisma.user.findMany({
        include: {
          memberships: { include: { project: true } },
          teamMembers: { include: { team: true } },
          channelBindings: true,
        },
      }),
      this.prisma.role.findMany({ include: { users: true } }),
      this.prisma.configVersion.findFirst({
        where: { projectId, status: 'published' },
        orderBy: { publishedAt: 'desc' },
        include: { orderTypes: true, formFields: true, dispatchRules: true },
      }),
      this.prisma.configVersion.findFirst({
        where: { projectId, status: 'draft' },
        orderBy: { createdAt: 'desc' },
        include: { orderTypes: true, formFields: true, dispatchRules: true },
      }),
      this.prisma.workPlan.findMany({ where: { projectId } }),
      this.prisma.inboxMessage.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.workOrder.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.workOrderException.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.notifyPolicy.findMany({ where: { projectId } }),
      this.prisma.wechatTemplateMap.findMany({ where: { projectId } }),
      this.prisma.channelBinding.findMany({ where: { projectId }, include: { user: true } }),
      this.prisma.delivery.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.mcpTool.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.skillPackage.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.agentApp.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.agentCallLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);

    const cfg = draft ?? published;
    const versionLabel = cfg?.label ?? 'V1';

    return {
      projects: projects.map((p) =>
        entity(p.id, p.name, [p.region, p.status].filter(Boolean).join(' · '), p.status, {
          manager: p.manager ?? '—',
          spaces: spaces.filter((s) => s.projectId === p.id).length || '—',
          users: people.filter((u) => u.memberships.some((m) => m.projectId === p.id)).length,
          phone: p.phone ?? '—',
        }),
      ),
      spaces: spaces.map((s) =>
        entity(s.id, s.name, `${projects.find((p) => p.id === s.projectId)?.name ?? ''} / ${s.name}`, s.status, {
          type: s.type,
          parent: s.parent?.name ?? projects.find((p) => p.id === s.projectId)?.name ?? '—',
          children: s.children.length,
        }),
      ),
      people: people.map((u) => {
        const mem = u.memberships[0];
        const team = u.teamMembers[0]?.team.name;
        const spaceOrTeam = team ?? '—';
        return entity(u.id, u.name, u.phone ?? u.identity, u.status, {
          identity: u.identity,
          project: mem?.project.name ?? '—',
          space: spaceOrTeam,
          channel: u.channelBindings.length ? '已绑定' : '未绑定',
        });
      }),
      roles: roles.map((r) =>
        entity(r.id, r.name, r.code, r.status, {
          scope: r.scope,
          members: r.users.length,
          permissions: Array.isArray(r.permissions) ? (r.permissions as unknown[]).length : 0,
        }),
      ),
      types: (cfg?.orderTypes ?? []).map((t) =>
        entity(t.id, t.name, t.channels, t.status, {
          fields: (cfg?.formFields ?? []).filter((f) => f.orderTypeId === t.id).length,
          priority: t.priority,
          flow: t.defaultFlowKey,
          version: versionLabel,
        }),
      ),
      fields: (cfg?.formFields ?? []).map((f) =>
        entity(f.id, f.label, f.fieldType, f.status, {
          code: f.code,
          visible: f.visible,
          privacy: f.privacy,
        }),
      ),
      dispatch: (cfg?.dispatchRules ?? []).map((d) =>
        entity(d.id, d.name, d.typeCode ?? '全部类型', d.status, {
          scope: d.scope,
          role: d.roleName ?? '—',
          team: d.teamName ?? '—',
          candidates: d.candidates,
        }),
      ),
      plans: plans.map((p) =>
        entity(p.id, p.name, p.scheduleRule, p.status, {
          type: p.typeName,
          assignee: p.assigneeTeam ?? '—',
          next: p.nextTriggerTime
            ? p.nextTriggerTime.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—',
        }),
      ),
      messages: messages.map((m) =>
        entity(m.id, m.title, m.refNo ?? '', m.status, {
          sender: m.sender,
          at: m.createdAt.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          channel: m.channel,
        }),
      ),
      workorders: workorders.map((w) =>
        entity(w.id, w.title, w.spaceLabel ?? w.workorderNo, w.status, {
          type: w.typeName,
          assignee: w.assigneeName ?? '—',
          sla: w.slaLabel ?? '—',
          created: w.createdAt.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        }),
      ),
      exceptions: exceptions.map((e) =>
        entity(e.id, e.message ?? e.category, e.impact ?? '', e.status, {
          category: e.category,
          impact: e.impact ?? '—',
          owner: e.owner ?? '—',
        }),
      ),
      policies: policies.map((p) =>
        entity(p.id, p.name, p.event, p.status, {
          recipient: p.recipient,
          channel: p.channel,
          cadence: p.cadence,
        }),
      ),
      templates: templates.map((t) =>
        entity(t.id, t.name, t.event, t.status, {
          template: t.templateName,
          fields: t.fieldCount,
          h5: t.h5Path,
        }),
      ),
      bindings: bindings.map((b) =>
        entity(b.id, b.user.name, b.userId, b.status, {
          channel: b.channel,
          openid: b.openId.length > 8 ? `${b.openId.slice(0, 4)}_***_${b.openId.slice(-3)}` : b.openId,
          verified: b.verifiedAt
            ? b.verifiedAt.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—',
        }),
      ),
      deliveries: deliveries.map((d) =>
        entity(d.id, d.title, d.refLabel ?? '', d.status, {
          event: d.event,
          recipient: d.recipient,
          channel: d.channel,
          at: d.createdAt.toLocaleTimeString('zh-CN', { hour12: false }),
        }),
      ),
      failures: deliveries
        .filter((d) => ['RETRYABLE', 'FAILED', '重试中', '待重试', 'RETRYING'].includes(d.status))
        .map((d) =>
          entity(
            d.id,
            d.errorCode === 'TIMEOUT' ? '微信接口临时超时' : d.title,
            d.id,
            d.status === 'RETRYING' || d.status === '重试中' ? '重试中' : '待重试',
            {
              code: d.errorCode ?? 'ERROR',
              attempts: d.attempts,
              next: d.nextRetryAt
                ? d.nextRetryAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
                : '—',
              impact: d.impact ?? '待办不受影响',
            },
            toneFromStatus(d.status),
          ),
        ),
      tools: tools.map((t) =>
        entity(t.id, t.name, t.kind, t.status, {
          purpose: t.purpose,
          scope: t.scope,
          approval: t.approval,
        }),
      ),
      skills: skills.map((s) =>
        entity(s.id, s.name, s.status === '已发布' ? '生产版本' : '候选版本', s.status, {
          version: s.version,
          mcp: s.mcpCompat,
          config: s.configCompat,
          evals: s.evals,
        }),
      ),
      apps: apps.map((a) =>
        entity(a.id, a.name, a.env, a.status, {
          identity: a.identity,
          projects: a.projects,
          rate: a.rateLimit,
          last: a.lastCallAt
            ? a.lastCallAt.toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
            : '—',
        }),
      ),
      logs: logs.map((l) =>
        entity(l.id, l.toolName, '公众号 H5', l.status, {
          actor: l.actor,
          duration: `${l.durationMs} ms`,
          at: l.createdAt.toLocaleTimeString('zh-CN', { hour12: false }),
          audit: l.audit ?? '—',
        }),
      ),
    };
  }

  async create(
    collection: string,
    input: { title: string; subtitle?: string; values?: Record<string, string | number> },
    projectId?: string,
    actorId?: string,
  ) {
    const pid = await this.defaultProjectId(projectId);
    const title = input.title;
    const subtitle = input.subtitle ?? '';

    switch (collection) {
      case 'projects': {
        const code = `PRJ-${Date.now().toString().slice(-5)}`;
        const p = await this.prisma.project.create({
          data: { code, name: title, region: subtitle || null, status: '筹备中', manager: '项目管理员' },
        });
        await this.audit(pid, '已创建项目草稿', p.name);
        break;
      }
      case 'spaces': {
        await this.prisma.space.create({
          data: { projectId: pid, name: title, type: String(input.values?.type ?? '楼栋'), status: '有效' },
        });
        await this.audit(pid, '已创建空间', title);
        break;
      }
      case 'people': {
        const id = `user_${Date.now().toString().slice(-6)}`;
        await this.prisma.user.create({
          data: {
            id,
            name: title,
            phone: subtitle || null,
            identity: String(input.values?.identity ?? '物管人员'),
            memberships: { create: { projectId: pid } },
          },
        });
        await this.audit(pid, '已创建用户', title);
        break;
      }
      case 'roles': {
        await this.prisma.role.create({
          data: {
            code: `ROLE_${Date.now().toString().slice(-4)}`,
            name: title,
            scope: String(input.values?.scope ?? '本项目'),
            permissions: [],
          },
        });
        await this.audit(pid, '已创建角色', title);
        break;
      }
      case 'workorders': {
        const no = await this.nextWorkorderNo();
        await this.prisma.workOrder.create({
          data: {
            projectId: pid,
            workorderNo: no,
            typeCode: 'REPAIR',
            typeName: '标准报修',
            title,
            spaceLabel: subtitle || null,
            status: '待分派',
            slaLabel: '剩余 24 小时',
            creatorId: actorId,
          },
        });
        await this.audit(pid, '人工建单', `${no} · ${title}`);
        break;
      }
      case 'plans': {
        await this.prisma.workPlan.create({
          data: {
            projectId: pid,
            code: `PLAN-${Date.now().toString().slice(-4)}`,
            name: title,
            scheduleRule: subtitle || 'DAILY:09:00',
            typeName: String(input.values?.type ?? '巡检工单'),
            status: '草稿',
          },
        });
        await this.audit(pid, '已创建计划', title);
        break;
      }
      case 'policies': {
        await this.prisma.notifyPolicy.create({
          data: {
            projectId: pid,
            name: title,
            event: subtitle || 'CustomEvent',
            recipient: '当前处理人',
            status: '草稿',
          },
        });
        break;
      }
      case 'types': {
        const draft = await this.requireDraft(pid);
        await this.prisma.orderType.create({
          data: {
            configVersionId: draft.id,
            code: `OT_${Date.now().toString().slice(-4)}`,
            name: title,
            channels: subtitle || 'Web',
            status: '草稿',
          },
        });
        break;
      }
      case 'fields': {
        const draft = await this.requireDraft(pid);
        await this.prisma.formField.create({
          data: {
            configVersionId: draft.id,
            code: `field_${Date.now().toString().slice(-4)}`,
            label: title,
            fieldType: subtitle || 'text',
            status: '草稿',
          },
        });
        break;
      }
      case 'dispatch': {
        const draft = await this.requireDraft(pid);
        await this.prisma.dispatchRule.create({
          data: {
            configVersionId: draft.id,
            name: title,
            typeCode: subtitle || null,
            status: '草稿',
          },
        });
        break;
      }
      default: {
        await this.audit(pid, `已创建 ${collection} 草稿`, title);
      }
    }

    return this.bootstrap(pid);
  }

  async execute(command: WorkbenchCommand, projectId?: string) {
    const pid = await this.defaultProjectId(projectId ?? ('projectId' in command ? command.projectId : undefined));
    const auditId = `AUD-${String(Date.now()).slice(-6)}`;
    let message = '操作已完成';

    switch (command.type) {
      case 'assign-workorder': {
        const wo = await this.prisma.workOrder.findUnique({ where: { id: command.id } });
        if (!wo) throw new NotFoundException('工单不存在');
        const user = await this.prisma.user.findFirst({
          where: { OR: [{ name: command.assignee }, { id: command.assignee }] },
        });
        await this.prisma.workOrder.update({
          where: { id: command.id },
          data: {
            assigneeId: user?.id,
            assigneeName: user?.name ?? command.assignee,
            status: '待接单',
          },
        });
        await this.prisma.workOrderEvent.create({
          data: { workOrderId: wo.id, action: 'ASSIGN', detail: `指派给 ${user?.name ?? command.assignee}` },
        });
        await this.dispatchNotify(pid, 'WorkItemAssigned', `工单待处理提醒`, `${wo.workorderNo}`, user?.name ?? command.assignee);
        message = `工单已指派给 ${user?.name ?? command.assignee}`;
        break;
      }
      case 'publish-config': {
        const draft = await this.prisma.configVersion.findFirst({
          where: { projectId: pid, status: 'draft' },
          orderBy: { createdAt: 'desc' },
        });
        if (!draft) throw new BadRequestException('没有可发布的草稿');
        await this.prisma.$transaction([
          this.prisma.configVersion.updateMany({
            where: { projectId: pid, status: 'published' },
            data: { status: 'archived' },
          }),
          this.prisma.configVersion.update({
            where: { id: draft.id },
            data: { status: 'published', label: command.version || draft.label, publishedAt: new Date() },
          }),
        ]);
        message = `配置 ${command.version || draft.label} 已完成发布`;
        break;
      }
      case 'retry-delivery': {
        const result = await this.notify.retry(command.id);
        if (!result) throw new NotFoundException('投递记录不存在');
        message = result.message;
        break;
      }
      case 'submit-agent-draft': {
        if (!command.idempotencyKey) {
          return { ok: false, message: '缺少幂等键', auditId: 'APPROVAL_REQUIRED', snapshot: await this.bootstrap(pid) };
        }
        const existing = await this.prisma.idempotencyKey.findUnique({ where: { id: command.idempotencyKey } });
        if (existing?.result) {
          message = '幂等命中：返回既有沙箱结果';
        } else {
          const no = await this.nextWorkorderNo();
          const wo = await this.prisma.workOrder.create({
            data: {
              projectId: pid,
              workorderNo: no,
              typeCode: 'REPAIR',
              typeName: '标准报修',
              title: 'Agent 沙箱草稿工单',
              status: '待分派',
              slaLabel: '剩余 24 小时',
              formData: { source: 'agent-sandbox', idempotencyKey: command.idempotencyKey },
            },
          });
          await this.prisma.idempotencyKey.create({
            data: { id: command.idempotencyKey, result: { workOrderId: wo.id, workorderNo: no } },
          });
          await this.prisma.agentCallLog.create({
            data: {
              toolName: 'create_work_order_draft',
              actor: 'sandbox / 星澜花园',
              durationMs: 286,
              status: '成功',
              audit: auditId,
            },
          });
          message = '联调通过：工单已在沙箱中创建';
        }
        break;
      }
      case 'publish-agent': {
        await this.prisma.agentCapabilityRelease.create({
          data: { version: command.version, status: '已发布' },
        });
        message = `Agent 能力 ${command.version} 已完成发布`;
        break;
      }
      default:
        throw new BadRequestException('未知命令');
    }

    await this.audit(pid, message, auditId);
    return { ok: true, message, auditId, snapshot: await this.bootstrap(pid) };
  }

  async resetDemo() {
    // Re-run seed programmatically is heavy; soft-reset activities + keep data
    await this.prisma.activityLog.create({
      data: { title: '演示数据保持', detail: '请使用 pnpm db:seed 完全重置', tone: 'info' },
    });
    return this.bootstrap();
  }

  private async requireDraft(projectId: string) {
    let draft = await this.prisma.configVersion.findFirst({
      where: { projectId, status: 'draft' },
      orderBy: { createdAt: 'desc' },
    });
    if (!draft) {
      const published = await this.prisma.configVersion.findFirst({
        where: { projectId, status: 'published' },
        orderBy: { publishedAt: 'desc' },
      });
      draft = await this.prisma.configVersion.create({
        data: {
          projectId,
          label: published ? `V${Number(published.label.replace(/\D/g, '') || 1) + 1}` : 'V1',
          status: 'draft',
        },
      });
    }
    return draft;
  }

  private async nextWorkorderNo() {
    const day = new Date();
    const key = `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}`;
    const seq = await this.redis.getClient().incr(`workorder:seq:${key}`);
    return `WO-${key.slice(2)}-${String(seq).padStart(3, '0')}`;
  }

  private async audit(projectId: string | null, title: string, detail?: string) {
    await this.prisma.activityLog.create({
      data: { projectId: projectId ?? undefined, title, detail, tone: 'ok' },
    });
  }

  private async dispatchNotify(
    projectId: string,
    event: string,
    title: string,
    refLabel: string,
    recipient: string,
  ) {
    await this.notify.dispatch({
      projectId,
      event,
      title,
      refLabel,
      recipient,
    });
  }

  async getFlow(key: string, projectId?: string) {
    const pid = await this.defaultProjectId(projectId);
    const cfg = await this.prisma.configVersion.findFirst({
      where: { projectId: pid, status: { in: ['draft', 'published'] } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    if (!cfg) throw new NotFoundException('无配置版本');
    const flow = await this.prisma.flowDefinition.findUnique({
      where: { configVersionId_flowKey: { configVersionId: cfg.id, flowKey: key } },
    });
    if (!flow) throw new NotFoundException('流程不存在');
    return {
      key: flow.flowKey,
      name: flow.name,
      version: flow.version,
      configVersionId: cfg.id,
      configLabel: cfg.label,
      definition: flow.definition,
    };
  }

  async putFlow(key: string, body: { name?: string; definition?: unknown; projectId?: string }) {
    const pid = await this.defaultProjectId(body.projectId);
    const draft = await this.requireDraft(pid);
    const flow = await this.prisma.flowDefinition.upsert({
      where: { configVersionId_flowKey: { configVersionId: draft.id, flowKey: key } },
      create: {
        configVersionId: draft.id,
        flowKey: key,
        name: body.name ?? '标准处理流程',
        definition: (body.definition as object) ?? {},
      },
      update: {
        name: body.name,
        definition: body.definition as object | undefined,
        version: { increment: 1 },
      },
    });
    return { key: flow.flowKey, name: flow.name, version: flow.version, definition: flow.definition };
  }

  async getSlaPolicies(projectId?: string) {
    const pid = await this.defaultProjectId(projectId);
    const cfg = await this.prisma.configVersion.findFirst({
      where: { projectId: pid, status: { in: ['draft', 'published'] } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { slaPolicies: true },
    });
    return {
      configLabel: cfg?.label ?? null,
      policies: (cfg?.slaPolicies ?? []).map((p) => ({
        id: p.id,
        typeCode: p.typeCode,
        nodeKey: p.nodeKey,
        timeoutHours: p.timeoutHours,
        escalationAction: p.escalationAction,
      })),
    };
  }

  async putSlaPolicies(
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
    const pid = await this.defaultProjectId(body.projectId);
    const draft = await this.requireDraft(pid);
    await this.prisma.slaPolicy.deleteMany({ where: { configVersionId: draft.id } });
    await this.prisma.slaPolicy.createMany({
      data: body.policies.map((p) => ({
        configVersionId: draft.id,
        typeCode: p.typeCode,
        nodeKey: p.nodeKey,
        timeoutHours: p.timeoutHours,
        escalationAction: p.escalationAction ?? 'EXCEPTION',
      })),
    });
    return this.getSlaPolicies(pid);
  }

  async ensureDraft(projectId?: string) {
    const pid = await this.defaultProjectId(projectId);
    const draft = await this.requireDraft(pid);
    return { id: draft.id, label: draft.label, status: draft.status };
  }

  async configDiff(projectId?: string) {
    const pid = await this.defaultProjectId(projectId);
    const [draft, published] = await Promise.all([
      this.prisma.configVersion.findFirst({
        where: { projectId: pid, status: 'draft' },
        include: { _count: { select: { orderTypes: true, formFields: true, flows: true, dispatchRules: true, slaPolicies: true } } },
      }),
      this.prisma.configVersion.findFirst({
        where: { projectId: pid, status: 'published' },
        include: { _count: { select: { orderTypes: true, formFields: true, flows: true, dispatchRules: true, slaPolicies: true } } },
      }),
    ]);
    return {
      draft: draft
        ? { label: draft.label, types: draft._count.orderTypes, fields: draft._count.formFields, flows: draft._count.flows }
        : null,
      published: published
        ? {
            label: published.label,
            types: published._count.orderTypes,
            fields: published._count.formFields,
            flows: published._count.flows,
            publishedAt: published.publishedAt,
          }
        : null,
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processRetries() {
    const due = await this.prisma.delivery.findMany({
      where: { status: 'RETRYABLE', nextRetryAt: { lte: new Date() } },
      take: 10,
    });
    for (const d of due) {
      await this.prisma.delivery.update({
        where: { id: d.id },
        data: { status: 'DELIVERED', attempts: { increment: 1 }, errorCode: null },
      });
    }
  }
}
