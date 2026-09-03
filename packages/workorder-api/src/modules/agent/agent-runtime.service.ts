import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class AgentRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async defaultProjectId(projectId?: string) {
    if (projectId) return projectId;
    const p = await this.prisma.project.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!p) throw new BadRequestException('请先创建项目');
    return p.id;
  }

  async listTypes(projectId?: string) {
    const pid = await this.defaultProjectId(projectId);
    const cfg = await this.prisma.configVersion.findFirst({
      where: { projectId: pid, status: 'published' },
      include: { orderTypes: true },
      orderBy: { publishedAt: 'desc' },
    });
    return (cfg?.orderTypes ?? []).map((t) => ({
      code: t.code,
      name: t.name,
      channels: t.channels,
      priority: t.priority,
      status: t.status,
    }));
  }

  async formSchema(typeCode: string, projectId?: string) {
    const pid = await this.defaultProjectId(projectId);
    const cfg = await this.prisma.configVersion.findFirst({
      where: { projectId: pid, status: 'published' },
      include: { formFields: true, orderTypes: true },
      orderBy: { publishedAt: 'desc' },
    });
    const type = cfg?.orderTypes.find((t) => t.code === typeCode || t.code === 'OT-REPAIR');
    const fields = (cfg?.formFields ?? []).filter((f) => !f.orderTypeId || f.orderTypeId === type?.id);
    return {
      type_code: typeCode,
      fields: fields.map((f) => ({
        code: f.code,
        label: f.label,
        field_type: f.fieldType,
        required: f.required,
        privacy: f.privacy,
      })),
    };
  }

  async configSummary(projectId?: string) {
    const pid = await this.defaultProjectId(projectId);
    const published = await this.prisma.configVersion.findFirst({
      where: { projectId: pid, status: 'published' },
      include: { _count: { select: { orderTypes: true, formFields: true, flows: true } } },
      orderBy: { publishedAt: 'desc' },
    });
    return {
      project_id: pid,
      version: published?.label ?? null,
      status: published?.status ?? null,
      order_types: published?._count.orderTypes ?? 0,
      form_fields: published?._count.formFields ?? 0,
      flows: published?._count.flows ?? 0,
    };
  }

  private async nextWorkorderNo() {
    const day = new Date();
    const key = `${day.getFullYear()}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}`;
    const seq = await this.redis.getClient().incr(`workorder:seq:${key}`);
    return `WO-${key.slice(2)}-${String(seq).padStart(3, '0')}`;
  }

  async createDraft(input: {
    type_code: string;
    title?: string;
    description?: string;
    contact_phone?: string;
    extra_fields?: Record<string, unknown>;
    projectId?: string;
    actorId?: string;
    idempotencyKey?: string;
  }) {
    const pid = await this.defaultProjectId(input.projectId);
    if (input.idempotencyKey) {
      const hit = await this.prisma.idempotencyKey.findUnique({ where: { id: input.idempotencyKey } });
      if (hit?.result && typeof hit.result === 'object' && hit.result !== null && 'workOrderId' in hit.result) {
        const id = String((hit.result as { workOrderId: string }).workOrderId);
        return this.get(id);
      }
    }
    const no = await this.nextWorkorderNo();
    const wo = await this.prisma.workOrder.create({
      data: {
        projectId: pid,
        workorderNo: no,
        typeCode: input.type_code,
        typeName: input.type_code === 'REPAIR' || input.type_code === 'OT-REPAIR' ? '标准报修' : input.type_code,
        title: input.title ?? 'Agent 草稿工单',
        status: 'DRAFT',
        creatorId: input.actorId,
        formData: {
          description: input.description,
          contact_phone: input.contact_phone,
          ...(input.extra_fields ?? {}),
        },
      },
    });
    if (input.idempotencyKey) {
      await this.prisma.idempotencyKey.create({
        data: { id: input.idempotencyKey, result: { workOrderId: wo.id, workorderNo: no } },
      });
    }
    await this.prisma.agentCallLog.create({
      data: {
        toolName: 'create_work_order_draft',
        actor: input.actorId ?? 'agent',
        durationMs: 120,
        status: '成功',
      },
    });
    return this.toDto(wo);
  }

  async submit(id: string, actorId?: string) {
    const wo = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException('工单不存在');
    if (wo.status !== 'DRAFT' && wo.status !== '草稿') {
      return this.toDto(wo);
    }
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { status: '待分派', slaLabel: '剩余 24 小时' },
    });
    await this.prisma.workOrderEvent.create({
      data: { workOrderId: id, action: 'SUBMIT', detail: `由 ${actorId ?? 'agent'} 提交` },
    });
    return this.toDto(updated);
  }

  async get(id: string) {
    const wo = await this.prisma.workOrder.findUnique({ where: { id } });
    if (!wo) throw new NotFoundException('工单不存在');
    return this.toDto(wo);
  }

  async getByNo(workorderNo: string) {
    const wo = await this.prisma.workOrder.findFirst({ where: { workorderNo } });
    if (!wo) throw new NotFoundException('工单不存在');
    return this.toDto(wo);
  }

  async list(params?: { status?: string; type_code?: string; keyword?: string; projectId?: string }) {
    const pid = await this.defaultProjectId(params?.projectId);
    const rows = await this.prisma.workOrder.findMany({
      where: {
        projectId: pid,
        status: params?.status,
        typeCode: params?.type_code,
        OR: params?.keyword
          ? [
              { title: { contains: params.keyword } },
              { workorderNo: { contains: params.keyword } },
            ]
          : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((w) => this.toDto(w));
  }

  async listTools() {
    return this.prisma.mcpTool.findMany({ orderBy: { code: 'asc' } });
  }

  async listSkills() {
    return this.prisma.skillPackage.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async listApps() {
    return this.prisma.agentApp.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async listLogs() {
    return this.prisma.agentCallLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async publishCapabilities(version: string) {
    return this.prisma.agentCapabilityRelease.create({
      data: { version, status: '已发布' },
    });
  }

  private toDto(wo: {
    id: string;
    workorderNo: string;
    typeCode: string;
    typeName: string;
    title: string;
    status: string;
    assigneeName: string | null;
    spaceLabel: string | null;
    formData: unknown;
    createdAt: Date;
  }) {
    return {
      id: wo.id,
      workorder_no: wo.workorderNo,
      type_code: wo.typeCode,
      type_name: wo.typeName,
      title: wo.title,
      status: wo.status,
      assignee_name: wo.assigneeName,
      space_label: wo.spaceLabel,
      form_data: wo.formData,
      created_at: wo.createdAt.toISOString(),
    };
  }
}
