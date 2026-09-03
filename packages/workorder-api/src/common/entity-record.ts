export type Tone = 'ok' | 'info' | 'warning' | 'danger' | 'neutral';

export interface EntityRecord {
  id: string;
  title: string;
  subtitle?: string;
  values: Record<string, string | number>;
  status: string;
  tone: Tone;
}

export function toneFromStatus(status: string): Tone {
  if (['服务中', '有效', '启用', '已启用', '已发布', '已映射', '已绑定', 'DELIVERED', '成功', '在职'].includes(status)) {
    return 'ok';
  }
  if (['待分派', '待接单', '待重试', 'RETRYABLE', '筹备中', '临期', '身份失效', '已拒绝'].includes(status)) {
    return 'warning';
  }
  if (['已超时', 'FAILED', '失败', 'OPEN'].includes(status)) return 'danger';
  if (['草稿', '处理中', '重试中', 'RETRYING', 'PENDING', '未读', 'V4 新增', '受限'].includes(status)) {
    return 'info';
  }
  return 'neutral';
}

export function entity(
  id: string,
  title: string,
  subtitle: string | undefined,
  status: string,
  values: Record<string, string | number>,
  tone?: Tone,
): EntityRecord {
  return { id, title, subtitle, status, values, tone: tone ?? toneFromStatus(status) };
}
