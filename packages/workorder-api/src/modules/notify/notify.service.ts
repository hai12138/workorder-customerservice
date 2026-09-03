import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type ChannelSendResult =
  | { ok: true; channelMsgId: string }
  | { ok: false; errorCode: string; retryable: boolean; detail: string };

export interface ChannelAdapter {
  readonly name: string;
  send(input: {
    openId: string;
    title: string;
    template?: string;
    payload?: Record<string, unknown>;
  }): Promise<ChannelSendResult>;
}

@Injectable()
export class SimulatorChannel implements ChannelAdapter {
  readonly name = 'simulator';

  async send(input: {
    openId: string;
    title: string;
    template?: string;
    payload?: Record<string, unknown>;
  }): Promise<ChannelSendResult> {
    // Deterministic demo: openIds containing "fail" or titles with "超时" fail once as retryable
    if (input.openId.includes('fail') || input.title.includes('强制失败')) {
      return {
        ok: false,
        errorCode: 'TIMEOUT',
        retryable: true,
        detail: '模拟通道：微信接口临时超时',
      };
    }
    return {
      ok: true,
      channelMsgId: `sim_${Date.now().toString(36)}`,
    };
  }
}

@Injectable()
export class NotificationDispatcher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channel: SimulatorChannel,
  ) {}

  async dispatch(input: {
    projectId: string;
    event: string;
    title: string;
    refLabel?: string;
    recipient: string;
    recipientUserId?: string;
    forceFail?: boolean;
  }) {
    const binding = input.recipientUserId
      ? await this.prisma.channelBinding.findFirst({
          where: { projectId: input.projectId, userId: input.recipientUserId, status: '已绑定' },
        })
      : null;

    const delivery = await this.prisma.delivery.create({
      data: {
        projectId: input.projectId,
        event: input.event,
        title: input.forceFail ? `${input.title}·强制失败` : input.title,
        refLabel: input.refLabel,
        recipient: input.recipient,
        channel: '微信',
        status: 'PENDING',
        attempts: 0,
      },
    });

    const result = await this.channel.send({
      openId: binding?.openId ?? `openid_${input.recipient}`,
      title: delivery.title,
      payload: { event: input.event, ref: input.refLabel },
    });

    if (result.ok) {
      await this.prisma.delivery.update({
        where: { id: delivery.id },
        data: { status: 'DELIVERED', attempts: 1 },
      });
      await this.prisma.deliveryAttempt.create({
        data: { deliveryId: delivery.id, status: 'DELIVERED', detail: `channelMsgId=${result.channelMsgId}` },
      });
    } else {
      await this.prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          status: result.retryable ? 'RETRYABLE' : 'FAILED',
          errorCode: result.errorCode,
          attempts: 1,
          nextRetryAt: result.retryable ? new Date(Date.now() + 5 * 60_000) : null,
          impact: '待办不受影响',
        },
      });
      await this.prisma.deliveryAttempt.create({
        data: { deliveryId: delivery.id, status: 'FAILED', detail: result.detail },
      });
    }

    await this.prisma.inboxMessage.create({
      data: {
        projectId: input.projectId,
        title: input.title,
        refNo: input.refLabel,
        sender: '通知中心',
        channel: '站内 + 微信',
        status: '未读',
      },
    });

    return delivery.id;
  }

  async retry(deliveryId: string) {
    const d = await this.prisma.delivery.findUnique({ where: { id: deliveryId } });
    if (!d) return null;
    await this.prisma.delivery.update({
      where: { id: d.id },
      data: { status: 'RETRYING', attempts: { increment: 1 } },
    });
    const result = await this.channel.send({
      openId: `retry_${d.recipient}`,
      title: d.title.replace('·强制失败', ''),
    });
    if (result.ok) {
      await this.prisma.delivery.update({
        where: { id: d.id },
        data: { status: 'DELIVERED', errorCode: null, nextRetryAt: null },
      });
      await this.prisma.deliveryAttempt.create({
        data: { deliveryId: d.id, status: 'DELIVERED', detail: '模拟通道重试成功' },
      });
      return { ok: true, message: '通知已重新进入模拟投递队列并送达' };
    }
    await this.prisma.delivery.update({
      where: { id: d.id },
      data: {
        status: 'RETRYABLE',
        errorCode: result.errorCode,
        nextRetryAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    await this.prisma.deliveryAttempt.create({
      data: { deliveryId: d.id, status: 'FAILED', detail: result.detail },
    });
    return { ok: false, message: '重试仍失败，已安排下次重试' };
  }
}
