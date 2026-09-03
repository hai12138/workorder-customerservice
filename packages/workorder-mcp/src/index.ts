#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { WorkorderClient } from 'workorder-sdk';

const baseUrl = process.env.WORKORDER_API_BASE ?? 'http://localhost:3000/api/v1';
const token = process.env.WORKORDER_API_TOKEN ?? 'dev-token-change-me';
const defaultUserId = process.env.WORKORDER_DEFAULT_USER_ID ?? 'admin';

const client = new WorkorderClient({ baseUrl, token, userId: defaultUserId });

const server = new McpServer({
  name: 'workorder-mcp',
  version: '0.1.0',
});

function jsonText(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

server.tool('workorder_list_types', '列出可用工单类型', {}, async () => {
  return jsonText(await client.listTypes());
});

server.tool(
  'workorder_get_form_schema',
  '获取工单类型的表单字段定义',
  { type_code: z.string().describe('工单类型编码，如 REPAIR') },
  async ({ type_code }) => jsonText(await client.getFormSchema(type_code)),
);

server.tool(
  'workorder_get_config_summary',
  '获取当前生效配置摘要',
  {},
  async () => jsonText(await client.getConfigSummary()),
);

server.tool(
  'workorder_create_draft',
  '暂存工单草稿',
  {
    type_code: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    contact_phone: z.string().optional(),
    extra_fields: z.record(z.unknown()).optional(),
    user_id: z.string().optional().describe('操作用户 ID'),
  },
  async (input) => {
    if (input.user_id) client.setUserId(input.user_id);
    const { user_id: _, ...body } = input;
    return jsonText(await client.createDraft(body));
  },
);

server.tool(
  'workorder_submit',
  '提交工单并发起流程（若未建草稿则先建草稿）',
  {
    type_code: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    contact_phone: z.string().optional(),
    extra_fields: z.record(z.unknown()).optional(),
    workorder_id: z.string().optional().describe('已有草稿 ID 时直接提交'),
    user_id: z.string().optional(),
  },
  async (input) => {
    if (input.user_id) client.setUserId(input.user_id);
    const { workorder_id, user_id: _, ...body } = input;
    const draft = workorder_id
      ? await client.get(workorder_id)
      : await client.createDraft(body);
    if (draft.status !== 'DRAFT') {
      return jsonText(draft);
    }
    return jsonText(await client.submit(draft.id));
  },
);

server.tool(
  'workorder_get',
  '按 ID 或单号查询工单详情',
  {
    id: z.string().optional(),
    workorder_no: z.string().optional(),
  },
  async ({ id, workorder_no }) => {
    if (workorder_no) return jsonText(await client.getByNo(workorder_no));
    if (id) return jsonText(await client.get(id));
    throw new Error('请提供 id 或 workorder_no');
  },
);

server.tool(
  'workorder_list',
  '查询工单列表',
  {
    status: z.string().optional(),
    type_code: z.string().optional(),
    keyword: z.string().optional(),
    user_id: z.string().optional(),
  },
  async (input) => {
    if (input.user_id) client.setUserId(input.user_id);
    const { user_id: _, ...params } = input;
    return jsonText(await client.list(params));
  },
);

server.tool(
  'workorder_list_tasks',
  '查询当前用户待办任务',
  { user_id: z.string().optional() },
  async ({ user_id }) => jsonText(await client.listTasksTodo(user_id)),
);

server.tool(
  'workorder_complete_task',
  '完成/审批待办任务',
  {
    task_id: z.string(),
    comment: z.string().optional(),
    user_id: z.string().optional(),
  },
  async ({ task_id, comment, user_id }) =>
    jsonText(await client.completeTask(task_id, comment, user_id)),
);

server.tool(
  'workorder_transfer_task',
  '转交待办任务',
  {
    task_id: z.string(),
    assignee_id: z.string(),
    comment: z.string().optional(),
    user_id: z.string().optional(),
  },
  async ({ task_id, assignee_id, comment, user_id }) =>
    jsonText(await client.transferTask(task_id, assignee_id, comment, user_id)),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
