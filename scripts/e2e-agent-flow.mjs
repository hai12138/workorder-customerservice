const BASE = process.env.WORKORDER_API_BASE ?? 'http://localhost:3000/api/v1';
const TOKEN = process.env.WORKORDER_API_TOKEN ?? 'dev-token-change-me';

async function api(method, path, body, userId = 'user_resident') {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'X-User-Id': userId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`${method} ${path}: ${json.message}`);
  }
  return json.data;
}

async function main() {
  console.log('1. List types');
  const types = await api('GET', '/workorder-types');
  console.log(types.map((t) => t.code).join(', '));

  console.log('2. Form schema REPAIR');
  await api('GET', '/workorder-types/REPAIR/form-schema');

  console.log('3. Create draft');
  const draft = await api('POST', '/workorders/draft', {
    type_code: 'REPAIR',
    title: 'E2E测试漏水',
    description: '自动化测试工单',
    contact_phone: '13800138000',
  });
  console.log(draft.workorder_no, draft.status);

  console.log('4. Submit');
  const submitted = await api('POST', `/workorders/${draft.id}/submit`);
  console.log(submitted.status, submitted.flow?.tasks?.length, 'tasks');

  console.log('5. Complete tasks as staff');
  let status = submitted.status;
  let id = submitted.id;
  while (status === 'IN_PROGRESS') {
    const todos = await api('GET', '/tasks/todo', null, 'user_staff');
    const task = todos.find((t) => t.workorder.id === id);
    if (!task) throw new Error('No pending task found');
    const done = await api(
      'POST',
      `/tasks/${task.id}/complete`,
      { comment: 'E2E done' },
      'user_staff',
    );
    status = done.status;
    id = done.id;
    console.log('  completed', task.node_name, '->', status);
  }

  console.log('6. Final status:', status);
  if (status !== 'COMPLETED') process.exit(1);
  console.log('E2E OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
