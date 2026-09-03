export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface WorkorderType {
  code: string;
  name: string;
  groupName: string;
  defaultFlowKey: string;
  sort: number;
}

export interface FormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: unknown;
  sort: number;
}

export interface FormSchema {
  typeCode: string;
  typeName: string;
  fields: FormField[];
}

export interface CreateWorkorderInput {
  type_code: string;
  title?: string;
  description?: string;
  contact_phone?: string;
  extra_fields?: Record<string, unknown>;
}

export interface WorkorderTask {
  id: string;
  node_key: string;
  node_name: string;
  assignee_id: string;
  status: string;
  belong_type: string;
  created_at: string;
  completed_at: string | null;
}

export interface Workorder {
  id: string;
  workorder_no: string;
  type_code: string;
  status: string;
  title: string | null;
  form_data: Record<string, unknown>;
  creator_id: string;
  created_at: string;
  updated_at: string;
  flow: {
    status: string;
    flow_key: string;
    current_node: string | null;
    tasks: WorkorderTask[];
  } | null;
  events: Array<{ action: string; operator_id: string | null; created_at: string }>;
}

export interface JobTask {
  id: string;
  node_key: string;
  node_name: string;
  assignee_id: string;
  status: string;
  belong_type: string;
  created_at: string;
  workorder: { id: string; workorder_no: string; title: string | null };
}

export interface ConfigSummary {
  version: number;
  typeCount: number;
  publishedAt: string | null;
}
