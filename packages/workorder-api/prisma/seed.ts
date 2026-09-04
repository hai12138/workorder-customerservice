import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 'default';
const PROJECT_XINGLAN_ID = 'prj_xinglan';

const standardFlowDefinition = {
  flow_key: 'standard',
  version: 1,
  nodes: [
    { key: 'start', type: 'start', next: 'dispatch' },
    {
      key: 'dispatch',
      type: 'task',
      name: '派单',
      assignee_rule: 'dispatch_rule',
      next: 'handle',
    },
    {
      key: 'handle',
      type: 'task',
      name: '处理',
      assignee_rule: 'claim',
      next: 'end',
    },
    { key: 'end', type: 'end' },
  ],
};

export async function main() {
  // --- dependency-safe delete (children → parents) ---
  await prisma.deliveryAttempt.deleteMany();
  await prisma.agentCallLog.deleteMany();
  await prisma.workOrderTask.deleteMany();
  await prisma.workOrderEvent.deleteMany();
  await prisma.workOrderException.deleteMany();
  await prisma.slaTimer.deleteMany();
  await prisma.formField.deleteMany();
  await prisma.orderType.deleteMany();
  await prisma.flowDefinition.deleteMany();
  await prisma.slaPolicy.deleteMany();
  await prisma.dispatchRule.deleteMany();
  await prisma.configVersion.deleteMany();
  await prisma.inboxMessage.deleteMany();
  await prisma.notifyPolicy.deleteMany();
  await prisma.wechatTemplateMap.deleteMany();
  await prisma.channelBinding.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.wechatIntegration.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.workPlan.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.space.deleteMany();
  await prisma.agentApp.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.role.deleteMany();
  await prisma.mcpTool.deleteMany();
  await prisma.skillPackage.deleteMany();
  await prisma.agentCapabilityRelease.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.user.deleteMany();
  await prisma.project.deleteMany();
  await prisma.tenant.deleteMany();

  // --- tenant ---
  await prisma.tenant.create({
    data: { id: TENANT_ID, name: '默认租户' },
  });

  // --- users ---
  await prisma.user.createMany({
    data: [
      {
        id: 'admin',
        tenantId: TENANT_ID,
        name: '项目管理员',
        phone: '13800000000',
        passwordHash: 'dev',
        identity: '管理员',
        status: '有效',
      },
      {
        id: 'zhaoqing',
        tenantId: TENANT_ID,
        name: '赵晴',
        phone: '13800000021',
        passwordHash: 'dev',
        identity: '物管人员',
        status: '有效',
      },
      {
        id: 'chenbin',
        tenantId: TENANT_ID,
        name: '陈斌',
        phone: '13800000034',
        passwordHash: 'dev',
        identity: '物管人员',
        status: '有效',
      },
      {
        id: 'linzhou',
        tenantId: TENANT_ID,
        name: '林舟',
        phone: '13800000049',
        passwordHash: 'dev',
        identity: '物管人员',
        status: '有效',
      },
      {
        id: 'linyue',
        tenantId: TENANT_ID,
        name: '林悦',
        phone: '138001381208',
        passwordHash: 'dev',
        identity: '业主',
        status: '有效',
      },
    ],
  });

  // --- roles ---
  const roleAdmin = await prisma.role.create({
    data: {
      tenantId: TENANT_ID,
      code: 'PROPERTY_ADMIN',
      name: '项目管理员',
      scope: '本项目',
      permissions: ['*'],
      status: '启用',
    },
  });

  const roleStaff = await prisma.role.create({
    data: {
      tenantId: TENANT_ID,
      code: 'PROPERTY_STAFF',
      name: '物业客服',
      scope: '本项目',
      permissions: [
        'order_overview_view',
        'order_workbench',
        'order_workorder_view',
        'order_work_plan_view',
        'order_work_plan_trigger',
        'order_message_view',
        'order_exception_view',
        'order_project_view',
        'order_space_view',
        'workorder:assign',
        'config:write',
      ],
      status: '启用',
    },
  });

  const roleUser = await prisma.role.create({
    data: {
      tenantId: TENANT_ID,
      code: 'PROJECT_USER',
      name: '项目用户',
      scope: '本人数据',
      permissions: ['order_launch_view', 'order_workorder_view', 'order_message_view'],
      status: '启用',
    },
  });

  await prisma.userRole.createMany({
    data: [
      { userId: 'admin', roleId: roleAdmin.id },
      { userId: 'zhaoqing', roleId: roleStaff.id },
      { userId: 'chenbin', roleId: roleStaff.id },
      { userId: 'linzhou', roleId: roleStaff.id },
      { userId: 'linyue', roleId: roleUser.id },
    ],
  });

  // --- projects ---
  await prisma.project.createMany({
    data: [
      {
        id: PROJECT_XINGLAN_ID,
        tenantId: TENANT_ID,
        code: 'PRJ-26001',
        name: '星澜花园',
        province: '浙江省',
        city: '杭州市',
        district: '西湖区',
        address: '文三路138号',
        latitude: 30.2741,
        longitude: 120.1551,
        businessType: '住宅公寓',
        manager: '项目管理员',
        phone: '400-820-1200',
        status: '服务中',
      },
      {
        id: 'prj_yunqi',
        tenantId: TENANT_ID,
        code: 'PRJ-26002',
        name: '云栖雅苑',
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        address: '科技园南路15号',
        latitude: 22.5333,
        longitude: 113.9344,
        businessType: '写字楼',
        manager: '林经理',
        phone: '400-820-1300',
        status: '服务中',
      },
      {
        id: 'prj_tech_park',
        tenantId: TENANT_ID,
        code: 'PRJ-26003',
        name: '创智产业园',
        province: '江苏省',
        city: '苏州市',
        district: '工业园区',
        address: '金鸡湖大道99号',
        latitude: 31.3091,
        longitude: 120.7046,
        businessType: '产业园区',
        manager: '王经理',
        phone: '400-820-1400',
        status: '筹备中',
      },
    ],
  });

  await prisma.projectMember.createMany({
    data: [
      { projectId: PROJECT_XINGLAN_ID, userId: 'admin' },
      { projectId: PROJECT_XINGLAN_ID, userId: 'zhaoqing' },
      { projectId: PROJECT_XINGLAN_ID, userId: 'chenbin' },
      { projectId: PROJECT_XINGLAN_ID, userId: 'linzhou' },
      { projectId: PROJECT_XINGLAN_ID, userId: 'linyue' },
    ],
  });

  // --- spaces (星澜花园) ---
  await prisma.space.createMany({
    data: [
      {
        id: 'sp_bld_1',
        projectId: PROJECT_XINGLAN_ID,
        name: '1栋',
        type: 'BUILDING',
        status: 'AVAILABLE',
      },
      {
        id: 'sp_bld_2',
        projectId: PROJECT_XINGLAN_ID,
        name: '2栋',
        type: 'BUILDING',
        status: 'AVAILABLE',
      },
      {
        id: 'sp_garage_a',
        projectId: PROJECT_XINGLAN_ID,
        name: 'A区地下车库',
        type: 'PARKING',
        status: 'AVAILABLE',
      },
    ],
  });

  // --- team ---
  const team = await prisma.team.create({
    data: {
      id: 'team_repair_1',
      projectId: PROJECT_XINGLAN_ID,
      code: 'TEAM-REPAIR-01',
      name: '工程维修一组',
      status: '启用',
      members: {
        create: [{ userId: 'zhaoqing' }, { userId: 'chenbin' }],
      },
    },
  });

  // --- config versions: published V3 + draft V4 ---
  const configV3 = await prisma.configVersion.create({
    data: {
      id: 'cfg_v3',
      projectId: PROJECT_XINGLAN_ID,
      label: 'V3',
      status: 'published',
      publishedAt: new Date('2026-08-18T10:00:00+08:00'),
    },
  });

  const configV4 = await prisma.configVersion.create({
    data: {
      id: 'cfg_v4',
      projectId: PROJECT_XINGLAN_ID,
      label: 'V4',
      status: 'draft',
    },
  });

  // --- order types (both versions) ---
  const repairV3 = await prisma.orderType.create({
    data: {
      id: 'ot_repair_v3',
      configVersionId: configV3.id,
      code: 'OT-REPAIR',
      name: '标准报修',
      channels: '移动端 / Web / 开放应用',
      priority: '高',
      defaultFlowKey: 'standard',
      status: '已启用',
      sort: 10,
    },
  });

  await prisma.orderType.create({
    data: {
      id: 'ot_complaint_v3',
      configVersionId: configV3.id,
      code: 'OT-COMPLAINT',
      name: '投诉建议',
      channels: '移动端 / Web',
      priority: '中',
      defaultFlowKey: 'standard',
      status: '已启用',
      sort: 20,
    },
  });

  const repairV4 = await prisma.orderType.create({
    data: {
      id: 'ot_repair_v4',
      configVersionId: configV4.id,
      code: 'OT-REPAIR',
      name: '标准报修',
      channels: '移动端 / Web / 开放应用',
      priority: '高',
      defaultFlowKey: 'standard',
      status: '已启用',
      sort: 10,
    },
  });

  await prisma.orderType.create({
    data: {
      id: 'ot_complaint_v4',
      configVersionId: configV4.id,
      code: 'OT-COMPLAINT',
      name: '投诉建议',
      channels: '移动端 / Web',
      priority: '中',
      defaultFlowKey: 'standard',
      status: '已启用',
      sort: 20,
    },
  });

  await prisma.orderType.create({
    data: {
      id: 'ot_access_v4',
      configVersionId: configV4.id,
      code: 'OT-ACCESS',
      name: '门禁异常',
      channels: '移动端 / Agent',
      priority: '高',
      defaultFlowKey: 'standard',
      status: '草稿',
      sort: 30,
    },
  });

  // --- form fields for repair type (V3 + V4) ---
  await prisma.formField.createMany({
    data: [
      {
        configVersionId: configV3.id,
        orderTypeId: repairV3.id,
        code: 'project_context',
        label: '当前项目',
        fieldType: 'text',
        required: true,
        visible: '用户 / 员工 / Web',
        privacy: '系统校验',
        status: '必填',
        sort: 1,
      },
      {
        configVersionId: configV3.id,
        orderTypeId: repairV3.id,
        code: 'contact_phone',
        label: '联系电话',
        fieldType: 'phone',
        required: true,
        visible: '员工 / Web',
        privacy: '脱敏',
        status: '必填',
        sort: 2,
      },
      {
        configVersionId: configV3.id,
        orderTypeId: repairV3.id,
        code: 'description',
        label: '问题描述',
        fieldType: 'textarea',
        required: true,
        visible: '用户 / 员工 / Web',
        privacy: '普通',
        status: '必填',
        sort: 3,
      },
      {
        configVersionId: configV4.id,
        orderTypeId: repairV4.id,
        code: 'project_context',
        label: '当前项目',
        fieldType: 'text',
        required: true,
        visible: '用户 / 员工 / Web',
        privacy: '系统校验',
        status: '必填',
        sort: 1,
      },
      {
        configVersionId: configV4.id,
        orderTypeId: repairV4.id,
        code: 'contact_phone',
        label: '联系电话',
        fieldType: 'phone',
        required: true,
        visible: '员工 / Web',
        privacy: '脱敏',
        status: '必填',
        sort: 2,
      },
      {
        configVersionId: configV4.id,
        orderTypeId: repairV4.id,
        code: 'description',
        label: '问题描述',
        fieldType: 'textarea',
        required: true,
        visible: '用户 / 员工 / Web',
        privacy: '普通',
        status: '必填',
        sort: 3,
      },
      {
        configVersionId: configV4.id,
        orderTypeId: repairV4.id,
        code: 'expected_visit_at',
        label: '期望上门时间',
        fieldType: 'datetime',
        required: false,
        visible: '用户 / 员工 / Agent',
        privacy: '普通',
        status: 'V4 新增',
        sort: 4,
      },
    ],
  });

  // --- flow / SLA / dispatch (both versions) ---
  for (const cfg of [configV3, configV4]) {
    await prisma.flowDefinition.create({
      data: {
        configVersionId: cfg.id,
        flowKey: 'standard',
        name: '标准处理流程',
        definition: standardFlowDefinition,
        version: 1,
      },
    });

    await prisma.slaPolicy.create({
      data: {
        configVersionId: cfg.id,
        typeCode: 'OT-REPAIR',
        nodeKey: 'handle',
        timeoutHours: 24,
        escalationAction: 'EXCEPTION',
      },
    });

    await prisma.dispatchRule.createMany({
      data: [
        {
          configVersionId: cfg.id,
          name: '标准报修派单规则',
          typeCode: 'OT-REPAIR',
          scope: '全项目',
          roleName: '物管人员',
          teamName: '综合维修组',
          candidates: 4,
          status: '已启用',
        },
        {
          configVersionId: cfg.id,
          name: '门禁异常派单规则',
          typeCode: 'OT-ACCESS',
          scope: '全项目',
          roleName: '物管人员',
          teamName: team.name,
          candidates: 2,
          status: '已启用',
        },
      ],
    });
  }

  // --- work plans ---
  const now = new Date();
  const tonight = new Date(now);
  tonight.setHours(21, 0, 0, 0);
  if (tonight <= now) tonight.setDate(tonight.getDate() + 1);

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0);

  await prisma.workPlan.createMany({
    data: [
      {
        projectId: PROJECT_XINGLAN_ID,
        code: 'PLAN-001',
        name: '北区夜间巡更',
        scheduleRule: '每日 21:00',
        typeName: '保洁巡检工单',
        assigneeTeam: '夜班组',
        nextTriggerTime: tonight,
        status: '已启用',
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        code: 'PLAN-002',
        name: '消防设备月检',
        scheduleRule: '每月 1 日 09:00',
        typeName: '设备巡检工单',
        assigneeTeam: '工程维修组',
        nextTriggerTime: nextMonth,
        status: '已启用',
      },
    ],
  });

  // --- work orders ---
  await prisma.workOrder.createMany({
    data: [
      {
        projectId: PROJECT_XINGLAN_ID,
        workorderNo: 'WO-260901-031',
        typeCode: 'OT-REPAIR',
        typeName: '标准报修',
        title: '电梯运行异响',
        description: '2 号楼东侧客梯运行时有明显异响',
        spaceLabel: '2 号楼东侧客梯',
        status: '待分派',
        slaLabel: '已超时',
        creatorId: 'linyue',
        formData: { contact_phone: '138****1208', description: '电梯运行异响' },
        createdAt: new Date('2026-08-31T19:38:00+08:00'),
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        workorderNo: 'WO-260901-030',
        typeCode: 'OT-REPAIR',
        typeName: '标准报修',
        title: '厨房顶部渗水',
        description: '3 栋 1702 厨房顶部渗水',
        spaceLabel: '3 栋 1702 厨房',
        status: '待分派',
        slaLabel: '已超时',
        creatorId: 'linyue',
        formData: { contact_phone: '138****1208', description: '厨房顶部渗水' },
        createdAt: new Date('2026-08-31T19:24:00+08:00'),
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        workorderNo: 'WO-260901-029',
        typeCode: 'OT-REPAIR',
        typeName: '公区报修',
        title: '园区照明故障',
        description: '中心花园北侧路灯不亮',
        spaceLabel: '中心花园北侧',
        status: '处理中',
        slaLabel: '剩余 3 小时',
        creatorId: 'linyue',
        assigneeId: 'chenbin',
        assigneeName: '陈斌',
        formData: { contact_phone: '138****1208', description: '园区照明故障' },
        createdAt: new Date('2026-08-31T18:55:00+08:00'),
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        workorderNo: 'WO-260901-027',
        typeCode: 'OT-ACCESS',
        typeName: '门禁异常',
        title: '门禁刷卡无响应',
        description: '1 栋西侧门禁刷卡无响应',
        spaceLabel: '1 栋西侧门禁',
        status: '待接单',
        slaLabel: '剩余 48 分',
        creatorId: 'linyue',
        assigneeId: 'zhaoqing',
        assigneeName: '赵晴',
        formData: { contact_phone: '138****1208', description: '门禁刷卡无响应' },
        createdAt: new Date('2026-08-31T17:53:00+08:00'),
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        workorderNo: 'WO-260902-042',
        typeCode: 'OT-REPAIR',
        typeName: '标准报修',
        title: '卫生间地漏堵塞',
        description: '2 栋 1602 卫生间地漏排水缓慢',
        spaceLabel: '2 栋 / 1602',
        status: '待接单',
        slaLabel: '剩余 6 小时',
        creatorId: 'linyue',
        assigneeId: 'zhaoqing',
        assigneeName: '赵晴',
        formData: { contact_phone: '138****1208', description: '卫生间地漏堵塞' },
        createdAt: new Date('2026-09-02T09:20:00+08:00'),
      },
    ],
  });

  // --- inbox messages ---
  await prisma.inboxMessage.createMany({
    data: [
      {
        projectId: PROJECT_XINGLAN_ID,
        userId: 'zhaoqing',
        title: '工单待处理提醒',
        refNo: 'WO-260902-042',
        sender: '通知中心',
        channel: '站内 + 微信',
        status: '未读',
        createdAt: new Date('2026-09-02T09:42:00+08:00'),
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        userId: 'chenbin',
        title: '工单已完成',
        refNo: 'WO-260901-029',
        sender: '通知中心',
        channel: '站内',
        status: '已读',
        createdAt: new Date('2026-09-01T18:12:00+08:00'),
      },
    ],
  });

  // --- notify policies ---
  await prisma.notifyPolicy.createMany({
    data: [
      {
        projectId: PROJECT_XINGLAN_ID,
        name: '新待办立即通知',
        event: 'WorkItemAssigned',
        recipient: '冻结后的实际处理人',
        channel: '微信 + 站内',
        cadence: '立即',
        status: '已启用',
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        name: '临期提醒',
        event: 'WorkItemDueSoon',
        recipient: '当前处理人',
        channel: '微信 + 站内',
        cadence: '截止前 30 分钟',
        status: '已启用',
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        name: '超时升级',
        event: 'WorkItemOverdue',
        recipient: '处理人 + 项目管理员',
        channel: '微信 + 站内',
        cadence: '立即 / 每 2 小时',
        status: '已启用',
      },
    ],
  });

  // --- wechat template maps ---
  await prisma.wechatTemplateMap.createMany({
    data: [
      {
        projectId: PROJECT_XINGLAN_ID,
        name: '待办处理提醒',
        event: 'WorkItemAssigned',
        templateName: '服务进度通知',
        fieldCount: 4,
        h5Path: '/task/open?n={notice_id}',
        status: '已映射',
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        name: '工单完成通知',
        event: 'WorkOrderCompleted',
        templateName: '服务结果通知',
        fieldCount: 4,
        h5Path: '/order/detail?n={notice_id}',
        status: '已映射',
      },
    ],
  });

  // --- channel bindings ---
  await prisma.channelBinding.createMany({
    data: [
      {
        projectId: PROJECT_XINGLAN_ID,
        userId: 'zhaoqing',
        channel: '微信服务号',
        openId: 'oWX_***_7Q2',
        status: '已绑定',
        verifiedAt: new Date('2026-09-02T09:42:00+08:00'),
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        userId: 'chenbin',
        channel: '微信服务号',
        openId: 'oWX_***_2K8',
        status: '已绑定',
        verifiedAt: new Date('2026-09-01T16:18:00+08:00'),
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        userId: 'linzhou',
        channel: '微信服务号',
        openId: 'oWX_***_9P1',
        status: '身份失效',
        verifiedAt: new Date('2026-08-26T10:00:00+08:00'),
      },
    ],
  });

  // --- deliveries ---
  await prisma.delivery.create({
    data: {
      projectId: PROJECT_XINGLAN_ID,
      event: 'WorkItemAssigned',
      title: '工单待处理提醒',
      refLabel: 'WO-260902-042 / TASK-1042',
      recipient: '赵晴',
      channel: '微信',
      status: 'DELIVERED',
      attempts: 1,
      createdAt: new Date('2026-09-02T09:42:18+08:00'),
      attemptsLog: {
        create: [{ status: 'DELIVERED', detail: '微信接口返回成功' }],
      },
    },
  });

  await prisma.delivery.create({
    data: {
      projectId: PROJECT_XINGLAN_ID,
      event: 'WorkItemOverdue',
      title: '超时升级提醒',
      refLabel: 'WO-260901-031 / TASK-1038',
      recipient: '项目管理员',
      channel: '微信',
      status: 'RETRYABLE',
      errorCode: 'TIMEOUT',
      attempts: 2,
      nextRetryAt: new Date('2026-09-02T10:08:00+08:00'),
      impact: '待办不受影响',
      createdAt: new Date('2026-09-02T09:38:06+08:00'),
      attemptsLog: {
        create: [
          { status: 'FAILED', detail: '微信接口临时超时' },
          { status: 'FAILED', detail: '微信接口临时超时' },
        ],
      },
    },
  });

  // --- wechat integration ---
  await prisma.wechatIntegration.create({
    data: {
      projectId: PROJECT_XINGLAN_ID,
      appId: 'wx_demo_xinglan',
      appSecret: 'demo-secret',
      status: '已配置',
    },
  });

  // --- MCP tools MCP-01..10 ---
  await prisma.mcpTool.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        code: 'MCP-01',
        name: 'list_available_projects',
        kind: '查询',
        purpose: '列出当前用户可报事项目',
        scope: 'workorder.project.read',
        approval: '否',
        status: '已启用',
      },
      {
        tenantId: TENANT_ID,
        code: 'MCP-02',
        name: 'get_work_order_intake_schema',
        kind: '查询',
        purpose: '获取类型、字段与约束',
        scope: 'workorder.schema.read',
        approval: '否',
        status: '已启用',
      },
      {
        tenantId: TENANT_ID,
        code: 'MCP-03',
        name: 'search_work_orders',
        kind: '查询',
        purpose: '查询当前用户可见工单',
        scope: 'workorder.read',
        approval: '否',
        status: '已启用',
      },
      {
        tenantId: TENANT_ID,
        code: 'MCP-04',
        name: 'get_work_order',
        kind: '查询',
        purpose: '读取单张工单脱敏详情',
        scope: 'workorder.read',
        approval: '否',
        status: '已启用',
      },
      {
        tenantId: TENANT_ID,
        code: 'MCP-05',
        name: 'get_work_order_timeline',
        kind: '查询',
        purpose: '读取客户可见进度',
        scope: 'workorder.timeline.read',
        approval: '否',
        status: '已启用',
      },
      {
        tenantId: TENANT_ID,
        code: 'MCP-06',
        name: 'create_work_order_draft',
        kind: '写入',
        purpose: '生成待确认草稿',
        scope: 'workorder.draft.write',
        approval: '否',
        status: '已启用',
      },
      {
        tenantId: TENANT_ID,
        code: 'MCP-07',
        name: 'validate_work_order_draft',
        kind: '写入',
        purpose: '按配置版本校验草稿',
        scope: 'workorder.draft.write',
        approval: '否',
        status: '已启用',
      },
      {
        tenantId: TENANT_ID,
        code: 'MCP-08',
        name: 'submit_work_order',
        kind: '写入',
        purpose: '提交工单并触发流程',
        scope: 'workorder.submit',
        approval: '必须',
        status: '已启用',
      },
      {
        tenantId: TENANT_ID,
        code: 'MCP-09',
        name: 'add_work_order_message',
        kind: '写入',
        purpose: '追加客户可见说明',
        scope: 'workorder.message.write',
        approval: '按策略',
        status: '已启用',
      },
      {
        tenantId: TENANT_ID,
        code: 'MCP-10',
        name: 'cancel_work_order',
        kind: '写入',
        purpose: '取消本人工单',
        scope: 'workorder.cancel',
        approval: '必须',
        status: '已启用',
      },
    ],
  });

  // --- skill packages ---
  await prisma.skillPackage.createMany({
    data: [
      {
        tenantId: TENANT_ID,
        name: 'work-order-customer-service',
        version: 'v1.3',
        mcpCompat: 'v1.2',
        configCompat: 'V3–V4',
        evals: '28 / 28',
        status: '已发布',
      },
      {
        tenantId: TENANT_ID,
        name: 'work-order-customer-service',
        version: 'v1.4-beta',
        mcpCompat: 'v1.2',
        configCompat: 'V4',
        evals: '27 / 28',
        status: '草稿',
      },
    ],
  });

  // --- agent app + call logs ---
  const agentApp = await prisma.agentApp.create({
    data: {
      projectId: PROJECT_XINGLAN_ID,
      code: 'APP-WX-H5-001',
      name: '微信公众号 H5 Agent',
      env: '生产',
      identity: 'OAuth + 内部用户映射',
      projects: '用户绑定项目',
      rateLimit: '60 / 分钟 / 用户',
      status: '已启用',
      lastCallAt: new Date('2026-09-02T10:42:00+08:00'),
    },
  });

  await prisma.agentCallLog.createMany({
    data: [
      {
        appId: agentApp.id,
        toolName: 'create_work_order_draft',
        actor: 'USR-***28 / 星澜花园',
        durationMs: 286,
        status: '成功',
        audit: 'AUD-***421',
        createdAt: new Date('2026-09-02T10:42:18+08:00'),
      },
      {
        appId: agentApp.id,
        toolName: 'search_work_orders',
        actor: 'USR-***71 / 云栖雅苑',
        durationMs: 194,
        status: '成功',
        audit: 'AUD-***419',
        createdAt: new Date('2026-09-02T10:39:44+08:00'),
      },
      {
        appId: agentApp.id,
        toolName: 'submit_work_order',
        actor: 'USR-***12 / —',
        durationMs: 88,
        status: '已拒绝',
        audit: 'USER_NOT_BOUND',
        createdAt: new Date('2026-09-02T10:32:05+08:00'),
      },
    ],
  });

  // --- activity log ---
  await prisma.activityLog.createMany({
    data: [
      {
        projectId: PROJECT_XINGLAN_ID,
        title: '待办通知已送达',
        detail: 'WO-260902-042 · 赵晴',
        tone: 'ok',
        createdAt: new Date('2026-09-02T09:42:00+08:00'),
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        title: '工单转派',
        detail: '陈斌 → 林舟',
        tone: 'info',
        createdAt: new Date('2026-09-02T09:31:00+08:00'),
      },
      {
        projectId: PROJECT_XINGLAN_ID,
        title: 'Agent 创建草稿',
        detail: '标准报修 · 等待确认',
        tone: 'warning',
        createdAt: new Date('2026-09-02T09:18:00+08:00'),
      },
    ],
  });

  console.log('Astra seed complete', {
    tenantId: TENANT_ID,
    projectId: PROJECT_XINGLAN_ID,
    configV3: configV3.id,
    configV4: configV4.id,
    teamId: team.id,
    agentAppId: agentApp.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
