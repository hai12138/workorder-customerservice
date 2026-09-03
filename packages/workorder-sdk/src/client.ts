import {
  ApiResponse,
  ConfigSummary,
  CreateWorkorderInput,
  FormSchema,
  JobTask,
  Workorder,
  WorkorderType,
} from './types.js';

export interface WorkorderClientOptions {
  baseUrl: string;
  token: string;
  userId?: string;
}

export class WorkorderClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private userId: string;

  constructor(opts: WorkorderClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.token = opts.token;
    this.userId = opts.userId ?? 'user_resident';
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    userId?: string,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        'X-User-Id': userId ?? this.userId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as ApiResponse<T>;
    if (!res.ok || json.code !== 0) {
      throw new Error(json.message || `HTTP ${res.status}`);
    }
    return json.data;
  }

  listTypes(): Promise<WorkorderType[]> {
    return this.request('GET', '/workorder-types');
  }

  getFormSchema(code: string): Promise<FormSchema> {
    return this.request('GET', `/workorder-types/${code}/form-schema`);
  }

  getConfigSummary(): Promise<ConfigSummary> {
    return this.request('GET', '/config/summary');
  }

  createDraft(input: CreateWorkorderInput): Promise<Workorder> {
    return this.request('POST', '/workorders/draft', input);
  }

  submit(id: string): Promise<Workorder> {
    return this.request('POST', `/workorders/${id}/submit`);
  }

  get(id: string): Promise<Workorder> {
    return this.request('GET', `/workorders/${id}`);
  }

  getByNo(workorderNo: string): Promise<Workorder> {
    return this.request('GET', `/workorders/no/${workorderNo}`);
  }

  list(params?: { status?: string; type_code?: string; keyword?: string }): Promise<Workorder[]> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.type_code) qs.set('type_code', params.type_code);
    if (params?.keyword) qs.set('keyword', params.keyword);
    const query = qs.toString();
    return this.request('GET', `/workorders${query ? `?${query}` : ''}`);
  }

  listTasksTodo(userId?: string): Promise<JobTask[]> {
    return this.request('GET', '/tasks/todo', undefined, userId);
  }

  completeTask(id: string, comment?: string, userId?: string): Promise<Workorder> {
    return this.request('POST', `/tasks/${id}/complete`, { comment }, userId);
  }

  transferTask(id: string, assigneeId: string, comment?: string, userId?: string): Promise<Workorder> {
    return this.request('POST', `/tasks/${id}/transfer`, { assignee_id: assigneeId, comment }, userId);
  }
}

export * from './types.js';
