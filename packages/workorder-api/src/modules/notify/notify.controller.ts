import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationDispatcher, SimulatorChannel } from './notify.service';
import { entity } from '../../common/entity-record';

@Controller()
export class NotifyController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  private async pid(projectId?: string) {
    if (projectId) return projectId;
    const p = await this.prisma.project.findFirst({ orderBy: { createdAt: 'asc' } });
    return p?.id ?? '';
  }

  @Get('notify-policies')
  async policies(@Query('projectId') projectId?: string) {
    const pid = await this.pid(projectId);
    const rows = await this.prisma.notifyPolicy.findMany({ where: { projectId: pid } });
    return {
      records: rows.map((p) =>
        entity(p.id, p.name, p.event, p.status, {
          recipient: p.recipient,
          channel: p.channel,
          cadence: p.cadence,
        }),
      ),
      total: rows.length,
    };
  }

  @Post('notify-policies')
  async createPolicy(
    @Body() body: { title: string; subtitle?: string; projectId?: string },
  ) {
    const pid = await this.pid(body.projectId);
    const p = await this.prisma.notifyPolicy.create({
      data: {
        projectId: pid,
        name: body.title,
        event: body.subtitle || 'CustomEvent',
        recipient: '当前处理人',
        status: '草稿',
      },
    });
    return entity(p.id, p.name, p.event, p.status, {
      recipient: p.recipient,
      channel: p.channel,
      cadence: p.cadence,
    });
  }

  @Get('wechat-templates')
  async templates(@Query('projectId') projectId?: string) {
    const pid = await this.pid(projectId);
    const rows = await this.prisma.wechatTemplateMap.findMany({ where: { projectId: pid } });
    return {
      records: rows.map((t) =>
        entity(t.id, t.name, t.event, t.status, {
          template: t.templateName,
          fields: t.fieldCount,
          h5: t.h5Path,
        }),
      ),
      total: rows.length,
    };
  }

  @Get('channel-bindings')
  async bindings(@Query('projectId') projectId?: string) {
    const pid = await this.pid(projectId);
    const rows = await this.prisma.channelBinding.findMany({
      where: { projectId: pid },
      include: { user: true },
    });
    return {
      records: rows.map((b) =>
        entity(b.id, b.user.name, b.userId, b.status, {
          channel: b.channel,
          openid: b.openId.length > 8 ? `${b.openId.slice(0, 4)}_***_${b.openId.slice(-3)}` : b.openId,
        }),
      ),
      total: rows.length,
    };
  }

  @Get('deliveries')
  async deliveries(@Query('projectId') projectId?: string) {
    const pid = await this.pid(projectId);
    const rows = await this.prisma.delivery.findMany({
      where: { projectId: pid },
      orderBy: { createdAt: 'desc' },
    });
    return {
      records: rows.map((d) =>
        entity(d.id, d.title, d.refLabel ?? '', d.status, {
          event: d.event,
          recipient: d.recipient,
          channel: d.channel,
        }),
      ),
      total: rows.length,
    };
  }

  @Get('failures')
  async failures(@Query('projectId') projectId?: string) {
    const pid = await this.pid(projectId);
    const rows = await this.prisma.delivery.findMany({
      where: {
        projectId: pid,
        status: { in: ['RETRYABLE', 'FAILED', 'RETRYING', '待重试', '重试中'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      records: rows.map((d) =>
        entity(d.id, d.title, d.id, d.status, {
          code: d.errorCode ?? 'ERROR',
          attempts: d.attempts,
          impact: d.impact ?? '待办不受影响',
        }),
      ),
      total: rows.length,
    };
  }

  @Post('failures/:id/retry')
  async retry(@Param('id') id: string) {
    return this.dispatcher.retry(id);
  }

  @Get('wechat-integration')
  async getWechat(@Query('projectId') projectId?: string) {
    const pid = await this.pid(projectId);
    const row = await this.prisma.wechatIntegration.findUnique({ where: { projectId: pid } });
    return {
      projectId: pid,
      appId: row?.appId ?? null,
      status: row?.status ?? '未配置',
      hasSecret: Boolean(row?.appSecret),
      // secret never echoed
    };
  }

  @Put('wechat-integration')
  async putWechat(
    @Body() body: { projectId?: string; appId?: string; appSecret?: string; status?: string },
  ) {
    const pid = await this.pid(body.projectId);
    const row = await this.prisma.wechatIntegration.upsert({
      where: { projectId: pid },
      create: {
        projectId: pid,
        appId: body.appId,
        appSecret: body.appSecret,
        status: body.status ?? '已配置',
      },
      update: {
        appId: body.appId,
        ...(body.appSecret ? { appSecret: body.appSecret } : {}),
        status: body.status ?? '已配置',
      },
    });
    return { projectId: pid, appId: row.appId, status: row.status, hasSecret: Boolean(row.appSecret) };
  }
}
