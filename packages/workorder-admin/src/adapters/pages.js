/**
 * Live page renderers — DOM class names stay identical to the approved prototype.
 */
import { records, dashboard as dashboardState, activities, projectId, getProjectsFilterState } from '../store/app-state.js'
import { badge, btn, head, filters, table, footer, esc, toneBadge } from './ui.js'

function metricCards(items) {
  const tones = { ok: 'green', warning: 'gray', info: '', neutral: 'gray', danger: 'gray' }
  return `<div class="metrics">${(items || [])
    .map(
      (m) =>
        `<div class="metric ${tones[m.tone] || ''}"><div class="label">${esc(m.label)}</div><strong>${esc(m.value)}</strong><small>${esc(m.detail || '')}</small></div>`,
    )
    .join('')}</div>`
}

export function dashboard() {
  const dash = dashboardState()
  const metrics = dash.metrics?.length
    ? dash.metrics
    : [
        { label: '今日新增', value: '0', detail: '今日创建工单', tone: 'info' },
        { label: '待分派', value: '0', detail: '暂无积压', tone: 'ok' },
        { label: '处理中', value: '0', detail: '待接单+处理中', tone: 'warning' },
        { label: '今日已完成', value: '0', detail: '—', tone: 'ok' },
      ]
  const projectName = dash.projectName || '当前项目'
  const projectStatus = dash.projectStatus || '—'
  const publishedLabel = dash.publishedLabel || '—'
  const draftLabel = dash.draftLabel || '—'
  const healthOk = /服务|启用/.test(String(projectStatus))

  const acts = activities()
    .slice(0, 6)
    .map(
      (a) =>
        `<div class="feed-item"><div class="feed-icon">◉</div><div><b>${esc(a.title)}</b><div class="muted">${esc(a.at)} · ${esc(a.detail)}</div></div></div>`,
    )
    .join('')

  const attention = (dash.attention || [])
    .map(
      (w) =>
        `<div class="feed-item"><div class="feed-icon">!</div><div><b>${esc(w.title)}</b><div class="muted">${esc(w.workorderNo)} · ${esc(w.status)} · ${esc(w.slaLabel)}</div></div><button class="text-btn" data-page="workorders">查看</button></div>`,
    )
    .join('')

  const workorders = records('workorders')
  const typeCount = {}
  for (const w of workorders) {
    const t = String(w.values?.type || w.subtitle || '其他')
    typeCount[t] = (typeCount[t] || 0) + 1
  }
  const typeEntries = Object.entries(typeCount).slice(0, 6)
  const typeLines = typeEntries.length
    ? typeEntries.map(([name, n]) => `${esc(name)} ${n}`).join(' · ')
    : `已配置类型 ${records('types').length} 个（暂无正式工单）`

  const totalWo = workorders.length || 1
  const topShare = typeEntries[0] ? Math.round((typeEntries[0][1] / totalWo) * 100) : 0

  return (
    head(
      '运营总览',
      'OPS-01',
      `${esc(projectName)} · ${esc(projectStatus)} | 线上 ${esc(publishedLabel)} · 草稿 ${esc(draftLabel)}`,
      btn('刷新', 'refresh-bootstrap') + `<button class="btn primary" data-page="workorders">进入工单台账</button>`,
    ) +
    `<div class="health"><div class="health-title">配置健康 ${badge(projectStatus, healthOk ? 'ok' : 'warn')}</div><p class="sub">当前项目配置版本：线上 ${esc(publishedLabel)}，草稿 ${esc(draftLabel)}。变更后请走发布检查。</p><div class="bar"><i style="width:${healthOk ? 82 : 45}%"></i></div><div class="actions">${badge(healthOk ? '项目服务中' : '需检查配置', healthOk ? 'ok' : 'warn')}${badge(`待分派 ${metrics[1]?.value ?? 0}`, Number(metrics[1]?.value) > 0 ? 'warn' : 'ok')}<span style="margin-left:auto"></span><button class="btn" data-page="publish">前往上线检查</button></div></div>` +
    metricCards(metrics) +
    `<div class="section-grid"><div class="card"><h2>需关注工单</h2><div class="card-note">待分派 / 待接单 / 处理中（最多 5 条）</div><div class="feed">${attention || '<p class="muted">当前没有积压工单</p>'}</div><div style="margin-top:12px"><h2>最近动态</h2><div class="feed">${acts || '<p class="muted">暂无动态</p>'}</div></div></div><div class="card"><h2>工单类型分布</h2><div class="card-note">按当前项目正式工单 type 聚合</div><div class="donut" data-pct="${topShare}%" style="background:conic-gradient(#4d70ef 0 ${topShare}%,#e7ebf4 ${topShare}%)"></div><div style="text-align:center;line-height:1.6">${typeLines}</div></div></div>`
  )
}

export function projects() {
  const list = records('projects')
  const serving = list.filter((p) => p.status.includes('服务')).length
  const draft = list.filter((p) => !p.status.includes('服务') && !p.status.includes('停')).length
  const rows = list.map(
    (p) => [
      `<div class="namecell"><strong>${esc(p.title)}</strong><span class="muted">${esc(p.subtitle)}</span></div>`,
      esc(p.id),
      esc(p.values?.region || '—'),
      esc(p.values?.businessType || '—'),
      esc(p.values?.phone || '—'),
      esc(p.values?.manager || '—'),
      toneBadge(p.status, p.tone),
      `<div class="row-actions"><button class="text-btn" data-action="project-detail" data-id="${esc(p.id)}">详情</button><button class="text-btn" data-action="project-edit" data-id="${esc(p.id)}">编辑</button></div>`,
    ],
  )
  const filterState = getProjectsFilterState()
  const statusOptions = ['全部状态', '服务中', '筹备中', '未启用', '已停用']
  const businessTypeOptions = ['全部业态', '住宅公寓', '产业园区', '写字楼', '商业综合体']
  const statusSelect = statusOptions.map((opt) => `<option${filterState.status === opt ? ' selected' : ''}>${opt}</option>`).join('')
  const businessTypeSelect = businessTypeOptions.map((opt) => `<option${filterState.businessType === opt ? ' selected' : ''}>${opt}</option>`).join('')
  const pcaCascader = `<div class="cascader-wrap" id="filter-pca-wrap">
    <div class="cascader-input placeholder" id="filter-pca-input" tabindex="0">
      <span id="filter-pca-display">选择省份 / 城市 / 区县</span>
    </div>
    <span class="cascader-arrow">▼</span>
    <div class="cascader-panel" id="filter-pca-panel"></div>
    <input type="hidden" id="filter-pca-province" value="${esc(filterState.province)}">
    <input type="hidden" id="filter-pca-city" value="${esc(filterState.city)}">
    <input type="hidden" id="filter-pca-district" value="${esc(filterState.district)}">
  </div>`
  const projectFilters = `<div class="filters">
    <input id="keyword" placeholder="搜索项目名称或编号" value="${esc(filterState.keyword)}">
    <select id="status-select">${statusSelect}</select>
    ${pcaCascader}
    <select id="businessType-select">${businessTypeSelect}</select>
    <button class="btn primary" data-action="query">查询</button>
    <button class="btn" data-action="reset-filter">重置</button>
  </div>`
  return (
    head('项目管理', 'WEB-01', '维护项目基础信息、客服电话与服务状态', btn('导出项目', 'export-projects') + `<button class="btn primary" data-action="new-project">新建项目</button>`) +
    metricCards([
      { label: '项目总数', value: String(list.length), detail: '当前授权项目', tone: 'info' },
      { label: '服务中', value: String(serving), detail: '已通过上线检查', tone: 'ok' },
      { label: '未启用', value: String(draft), detail: '需补齐配置', tone: 'warning' },
      { label: '已停用', value: '0', detail: '—', tone: 'neutral' },
    ]) +
    projectFilters +
    table(['项目名称', '项目编号', '地区', '业态', '客服电话', '项目管理员', '服务状态', '操作'], rows) +
    footer(`共 ${list.length} 个项目`)
  )
}

export function spaces() {
  const list = records('spaces')
  const roots = list.filter((s) => {
    const parent = String(s.values?.parent ?? '')
    return !list.some((x) => x.title === parent)
  })
  const childrenOf = (title) => list.filter((s) => String(s.values?.parent) === title)
  const icon = (type) => {
    const t = String(type || '')
    if (t.includes('车库')) return '▦'
    if (t.includes('绿化') || t.includes('花园')) return '♧'
    if (t.includes('楼层')) return ''
    return '▤'
  }
  let tree = `<div class="tree-row on">⌂ 当前项目</div>`
  for (const r of roots) {
    const ic = icon(r.values?.type)
    tree += `<div class="tree-row l2">${ic ? ic + ' ' : ''}${esc(r.title)}</div>`
    for (const c of childrenOf(r.title)) {
      tree += `<div class="tree-row l3">${esc(c.title)}</div>`
    }
  }
  const rows = list.map((s) => [
    `<strong>${esc(s.title)}</strong>`,
    esc(s.values?.type || '—'),
    esc(s.subtitle || '—'),
    esc(s.values?.code || s.id),
    toneBadge(s.status, s.tone),
    esc(s.values?.updated || '—'),
    `<div class="row-actions"><button class="text-btn" data-action="space-detail" data-id="${esc(s.id)}">查看</button></div>`,
  ])
  return (
    head('空间管理', 'WEB-02', '维护楼栋、楼层、房间、公区与车位', btn('下载模板') + btn('导入空间') + `<button class="btn primary" data-action="new-space">新增空间</button>`) +
    `<div class="split"><div class="tree"><h3>空间树 <span class="muted">${list.length} 个节点</span></h3>${tree}</div><div>${filters('搜索空间名称')}${table(['空间名称', '空间类型', '完整路径', '外部编号', '状态', '更新时间', '操作'], rows)}${footer(`共 ${list.length} 个空间`)}</div></div>`
  )
}

export function peopleView() {
  const list = records('people')
  const rows = list.map((p) => [
    `<div class="namecell"><strong>${esc(p.title)}</strong><span class="muted">${esc(p.subtitle)}</span></div>`,
    esc(p.values?.identity || '—'),
    esc(p.values?.space || '—'),
    toneBadge(p.status, p.tone),
    esc(p.values?.channel || '—'),
    esc(p.values?.project || '—'),
    `<div class="row-actions"><button class="text-btn" data-action="person-detail" data-id="${esc(p.id)}">查看</button><button class="text-btn" data-action="person-edit" data-id="${esc(p.id)}">编辑</button></div>`,
  ])
  return (
    head('用户与员工管理', 'WEB-03', '维护项目用户资料与员工账号', btn('下载模板') + btn('导入项目用户') + `<button class="btn primary" data-action="new-person">新增项目用户</button>`) +
    `<div class="tabs"><button class="tab-btn on">全部用户</button><button class="tab-btn" data-action="toast">员工账号</button></div>` +
    filters('姓名 / 手机号') +
    table(['姓名 / 手机号', '身份', '空间/班组', '状态', '渠道', '项目', '操作'], rows) +
    footer(`共 ${list.length} 位`)
  )
}

export function roles() {
  const list = records('roles')
  const selected = list[0]
  const perms = [
    '查看项目数据',
    '查看本人任务',
    '查看全部工单',
    '派单',
    '接单',
    '提交处理记录',
    '完成工单',
    '转派',
    'AI 助手代客报单',
    '知识问询',
    '工单配置',
    '异常处理',
  ]
  const enabledCount = Number(selected?.values?.permissions ?? 0)
  const roleList = list
    .map(
      (r, i) =>
        `<div class="role ${i === 0 ? 'on' : ''}" data-action="select-role" data-id="${esc(r.id)}"><strong>${esc(r.title)}</strong><div class="muted">${esc(r.subtitle)} · ${esc(r.values?.scope)}</div></div>`,
    )
    .join('')
  const matrix = perms
    .map((x, i) => `<div class="perm">${x}<span style="float:right" class="switch ${i < enabledCount ? 'on' : ''}"></span></div>`)
    .join('')
  return (
    head('角色权限', 'WEB-04', '维护角色功能权限矩阵、数据范围与授权', `<button class="btn primary" data-action="new-role">＋ 新建自定义角色</button>`) +
    `<div class="role-layout"><div class="role-list">${roleList || '<p class="muted">暂无角色</p>'}</div><div class="card"><div class="actions"><h2 style="margin-right:auto">${esc(selected?.title || '角色')} · 功能权限</h2>${badge('只读', 'blue')}</div><p class="card-note">数据来自后端角色列表；开关保存将在后续迭代开放写入。</p><div class="matrix">${matrix}</div><div class="health" style="margin-top:15px"><b>范围与影响</b><p>项目数据范围：${esc(selected?.values?.scope || '—')}　·　授权人数：${esc(selected?.values?.members ?? 0)} 人　·　已开启权限：${enabledCount} / ${perms.length}</p></div></div></div>`
  )
}

export function config() {
  const types = records('types').length
  const fields = records('fields').length
  const plans = records('plans').length
  const items = [
    ['工单类型', `${types} 个类型`, types ? '正常' : '警告', 'types'],
    ['表单字段', `${fields} 个字段`, '正常', 'fields'],
    ['流程 / SLA', '标准处理流程', '正常', 'flow'],
    ['派单规则', `${records('dispatch').length} 条规则`, '正常', 'dispatch'],
    ['通知中心', `${records('policies').length} 条策略`, '正常', 'notificationCenter'],
    ['Agent 接入', `${records('tools').length} 个工具`, '正常', 'agentOverview'],
    ['计划工单', `${plans} 条计划`, '正常', 'plans'],
    ['版本记录', '线上 / 草稿', '正常', 'publish'],
  ]
  return (
    head('配置总览', 'WEB-06', `项目 ${esc(projectId())}`, btn('运行发布校验') + `<button class="btn primary" data-page="publish">进入发布</button>`) +
    metricCards([
      { label: '工单类型', value: String(types), detail: '当前配置', tone: 'info' },
      { label: '表单字段', value: String(fields), detail: '当前配置', tone: 'info' },
      { label: '派单规则', value: String(records('dispatch').length), detail: '当前配置', tone: 'info' },
      { label: '计划工单', value: String(plans), detail: '当前配置', tone: 'info' },
    ]) +
    `<div class="config-list">${items.map((i) => `<div class="config-item"><div><h3>${i[0]} ${badge(i[2], i[2] === '正常' ? 'ok' : 'warn')}</h3><p>${i[1]}</p></div><button class="text-btn" data-page="${i[3]}">前往 →</button></div>`).join('')}</div>`
  )
}

export function types() {
  const list = records('types')
  const rows = list.map((t) => [
    `<strong>${esc(t.title)}</strong><div class="muted">${esc(t.id)}</div>`,
    esc(t.subtitle),
    esc(t.values?.fields ?? '—'),
    esc(t.values?.priority ?? '—'),
    esc(t.values?.flow ?? '—'),
    esc(t.values?.version ?? '—'),
    toneBadge(t.status, t.tone),
    `<button class="text-btn" data-action="type-detail" data-id="${esc(t.id)}">查看详情</button>`,
  ])
  return (
    head('工单类型', 'WEB-07', '线上 / 草稿配置', `<button class="btn primary" data-action="new-type">＋ 新增工单类型</button>`) +
    filters('类型名称或编码') +
    table(['类型名称 / 编码', '入口渠道', '字段数', '默认优先级', '关联流程', '配置版本', '状态', '操作'], rows) +
    footer(`共 ${list.length} 个类型`)
  )
}

export function fields() {
  const list = records('fields')
  const rows = list
    .map((f, i) => `<div class="field-row ${i === 0 ? 'on' : ''}">${esc(f.title)} ${f.status === '必填' ? '*' : ''}<span style="float:right">↑ ↓</span></div>`)
    .join('')
  const first = list[0]
  return (
    head('表单字段', 'WEB-08', '字段设计器 · 数据来自配置版本', btn('运行字段校验') + `<button class="btn primary" data-action="new-field">＋ 新增字段</button>`) +
    `<div class="field-builder"><div class="field-list"><h3>字段清单</h3>${rows || '<p class="muted">暂无字段</p>'}</div><div class="field-props"><h3>字段属性 · ${esc(first?.title || '—')}</h3><div class="form-row"><label>字段名称</label><input value="${esc(first?.title || '')}"></div><div class="form-row"><label>编码</label><input value="${esc(first?.values?.code || '')}"></div><div class="form-row"><label>类型</label><input value="${esc(first?.subtitle || '')}"></div><button class="btn primary" data-action="toast">保存草稿</button></div><div class="preview"><h3>表单预览</h3><div class="preview-box">${list.slice(0, 6).map((f) => `<label>${esc(f.title)}</label><div class="fake-input">${esc(f.values?.code || '—')}</div>`).join('')}</div></div></div>`
  )
}

export function flow() {
  return (
    head('流程与 SLA', 'WEB-09', '标准处理流程 · 可保存到草稿', btn('查看历史版本') + btn('运行流程校验') + btn('保存草稿', 'save-flow', 'primary')) +
    `<section class="card flow-surface"><div class="section-title-row"><div><div class="section-kicker">WORKFLOW</div><h2>业务状态 · 标准流程</h2><p class="sub">流程节点负责生成待办；通知策略只负责触达。</p></div><button class="btn small" data-action="flow-node-edit" data-node="待接单">配置节点</button></div><div class="flow-track"><article class="flow-node" data-action="flow-node-edit" data-node="待分派"><div class="flow-number">1</div><h3>待分派</h3><p>工单进入客服池。</p></article><div class="flow-connector"></div><article class="flow-node" data-action="flow-node-edit" data-node="待接单"><div class="flow-number">2</div><h3>待接单</h3><p>责任人响应。</p></article><div class="flow-connector"></div><article class="flow-node" data-action="flow-node-edit" data-node="处理中"><div class="flow-number">3</div><h3>处理中</h3><p>现场处理。</p></article><div class="flow-connector"></div><article class="flow-node done" data-action="flow-node-edit" data-node="已完成"><div class="flow-number">4</div><h3>已完成</h3><p>结果归档。</p></article></div></section><section class="card sla-panel"><div class="sla-header"><div><div class="section-kicker">SERVICE LEVEL</div><h2>SLA 阶段时限</h2></div><button class="btn small" data-action="save-sla">保存 SLA</button></div><div class="sla-grid"><article class="sla-stage"><div class="stage-icon">⌁</div><span>首次分派</span><strong>30 分钟</strong><p>超时通知项目管理员。</p></article><article class="sla-stage"><div class="stage-icon">◷</div><span>责任人接单</span><strong>2 小时</strong><p>截止前 30 分钟提醒。</p></article><article class="sla-stage"><div class="stage-icon">✓</div><span>完成处理</span><strong>24 小时</strong><p>到期产生升级通知。</p></article></div></section>`
  )
}

export function dispatch() {
  const list = records('dispatch')
  const rows = list.map((d) => [
    `<strong>${esc(d.title)}</strong><div class="muted">${esc(d.id)}</div>`,
    esc(d.subtitle),
    esc(d.values?.scope || '—'),
    esc(d.values?.role || '—'),
    esc(d.values?.team || '—'),
    esc(d.values?.candidates ?? '—'),
    toneBadge(d.status, d.tone),
    `<button class="text-btn" data-action="candidate-test">测试候选</button>`,
  ])
  return (
    head('派单规则', 'WEB-10', '人工派单 · 规则决定合法候选', `<button class="btn primary" data-action="new-rule">＋ 新增规则</button>`) +
    `<div class="health"><b>首期由客服或项目管理员人工派单</b><p class="sub">候选为空时工单保留在待分派。</p></div>` +
    table(['规则名称', '适用类型', '空间范围', '候选角色', '候选班组', '候选人数', '状态', '操作'], rows) +
    footer(`${list.length} 条规则`)
  )
}

export function plans() {
  const list = records('plans')
  const cards = list
    .map(
      (p) =>
        `<div class="plan-card"><h3>${esc(p.title)} ${toneBadge(p.status, p.tone)}</h3><p class="muted">${esc(p.subtitle)}</p><div class="plan-info"><div><span>类型</span><b>${esc(p.values?.type || '—')}</b></div><div><span>执行人</span><b>${esc(p.values?.assignee || '—')}</b></div><div><span>下次</span><b>${esc(p.values?.next || '—')}</b></div></div><button class="btn" data-action="toast">触发测试</button></div>`,
    )
    .join('')
  return (
    head('计划工单', 'WEB-12', '周期触发自动建单', `<button class="btn primary" data-action="new-plan">＋ 新建计划</button>`) +
    `<div class="plan-grid">${cards || '<p class="muted">暂无计划</p>'}</div>`
  )
}

export function publish() {
  return (
    head('配置版本与发布', 'WEB-13', '草稿发布后仅影响新建工单', btn('重新校验', 'run-config-diff') + `<button class="btn primary" data-action="publish-confirm">发布草稿</button>`) +
    `<div class="publish-layout"><div class="version"><div class="muted">当前线上</div><div class="version-number">V3</div><p class="sub">已发布配置</p></div><div class="version"><div class="muted">当前草稿</div><div class="version-number">V4</div><p class="sub">可发布</p><button class="btn" data-action="ensure-draft">确保草稿存在</button></div></div><div class="health" id="publish-health"><b>发布前请运行差异校验</b><p class="sub">点击「重新校验」加载 /config/diff</p></div>`
  )
}

export function notificationCenter() {
  const policies = records('policies').length
  const failures = records('failures').length
  const deliveries = records('deliveries').length
  return (
    head('通知总览', 'WEB-11', '工单事件驱动 · Simulator 渠道', `<button class="btn" data-action="refresh-bootstrap">刷新状态</button><button class="btn primary" data-action="simulate-notification">联调测试</button>`) +
    `<div class="notify-hero"><section class="hero-main"><div class="section-kicker">NOTIFICATION CONTROL</div><h2>业务待办与渠道触达分离运行</h2><p>策略 ${policies} · 投递 ${deliveries} · 失败 ${failures}</p><div class="actions" style="margin-top:18px"><button class="btn primary" data-page="notifications">管理策略</button><button class="btn" data-page="deliveryRecords">查看投递记录</button></div></section><aside class="hero-status"><span class="muted">失败待处理</span><strong>${failures}</strong><span>Simulator 渠道</span></aside></div>` +
    `<div class="notify-grid"><article class="notify-card"><div class="notify-icon">⌁</div><h3>通知策略</h3><p>${policies} 条</p><button class="text-btn card-link" data-page="notifications">管理策略 →</button></article><article class="notify-card"><div class="notify-icon">微</div><h3>微信模板</h3><p>${records('templates').length} 个映射</p><button class="text-btn card-link" data-page="wechatTemplates">查看映射 →</button></article><article class="notify-card"><div class="notify-icon">人</div><h3>渠道绑定</h3><p>${records('bindings').length} 条</p><button class="text-btn card-link" data-page="channelBindings">治理身份 →</button></article><article class="notify-card"><div class="notify-icon">↗</div><h3>投递记录</h3><p>${deliveries} 条</p><button class="text-btn card-link" data-page="deliveryRecords">查看台账 →</button></article><article class="notify-card"><div class="notify-icon">!</div><h3>失败与重试</h3><p>${failures} 条</p><button class="text-btn card-link" data-page="deliveryFailures">处理异常 →</button></article><article class="notify-card"><div class="notify-icon">⚙</div><h3>微信接入</h3><p>Simulator</p><button class="text-btn card-link" data-page="wechatSettings">接入设置 →</button></article></div>`
  )
}

export function notifications() {
  const list = records('policies')
  const rows = list.map((p) => [
    `<strong>${esc(p.title)}</strong><div class="muted">${esc(p.id)}</div>`,
    esc(p.subtitle),
    esc(p.values?.recipient || '—'),
    esc(p.values?.cadence || '—'),
    esc(p.values?.channel || '—'),
    toneBadge(p.status, p.tone),
    `<button class="text-btn" data-action="edit-policy" data-id="${esc(p.id)}">编辑</button>`,
  ])
  return (
    head('通知策略', 'WEB-11A', '策略只负责触达，不修改工单状态', btn('策略校验') + `<button class="btn primary" data-action="edit-policy">＋ 新建策略</button>`) +
    table(['策略名称', '业务事件', '接收对象', '触发', '渠道', '状态', '操作'], rows) +
    footer(`${list.length} 条策略`)
  )
}

export function wechatTemplates() {
  const list = records('templates')
  const rows = list.map((t) => [
    `<strong>${esc(t.title)}</strong><div class="muted">${esc(t.id)}</div>`,
    esc(t.subtitle),
    esc(t.values?.template || '—'),
    esc(t.values?.h5 || '—'),
    toneBadge(t.status, t.tone),
    `<button class="text-btn" data-action="template-mapping">编辑映射</button>`,
  ])
  return (
    head('微信模板映射', 'WEB-11B', '模板 ID 使用占位；不回显密钥', btn('同步模板库') + `<button class="btn primary" data-action="template-mapping">新增映射</button>`) +
    table(['模板名称', '业务用途', '模板', 'H5', '状态', '操作'], rows) +
    footer(`${list.length} 个模板`)
  )
}

export function channelBindings() {
  const list = records('bindings')
  const rows = list.map((b) => [
    `<div class="namecell"><strong>${esc(b.title)}</strong><span class="muted">${esc(b.subtitle)}</span></div>`,
    esc(b.values?.channel || '—'),
    esc(b.values?.openid || '—'),
    toneBadge(b.status, b.tone),
    esc(b.values?.verified || '—'),
    `<button class="text-btn" data-action="binding-detail" data-id="${esc(b.id)}">详情</button>`,
  ])
  return (
    head('用户渠道绑定', 'WEB-11C', '内部用户为主身份', btn('导出绑定') + `<button class="btn primary" data-action="binding-invite">生成绑定邀请</button>`) +
    metricCards([
      { label: '绑定记录', value: String(list.length), detail: '当前项目', tone: 'info' },
      { label: '已绑定', value: String(list.filter((b) => b.status.includes('绑定')).length), detail: '—', tone: 'ok' },
      { label: '异常', value: String(list.filter((b) => b.tone === 'warning' || b.tone === 'danger').length), detail: '—', tone: 'warning' },
      { label: '渠道', value: '微信', detail: 'Simulator', tone: 'neutral' },
    ]) +
    filters('姓名 / OpenID') +
    table(['用户', '渠道', 'OpenID', '状态', '最近验证', '操作'], rows) +
    footer(`共 ${list.length} 条`)
  )
}

export function deliveryRecords() {
  const list = records('deliveries')
  const rows = list.map((d) => [
    esc(d.id),
    esc(d.subtitle),
    esc(d.values?.event || '—'),
    esc(d.values?.recipient || '—'),
    esc(d.values?.channel || '—'),
    toneBadge(d.status, d.tone),
    esc(d.values?.at || '—'),
    `<button class="text-btn" data-action="delivery-detail" data-id="${esc(d.id)}">详情</button>`,
  ])
  return (
    head('投递记录', 'WEB-11D', '接口受理不等于最终送达', btn('导出记录') + btn('刷新回执', 'refresh-bootstrap')) +
    metricCards([
      { label: '投递记录', value: String(list.length), detail: '当前项目', tone: 'info' },
      { label: '成功', value: String(list.filter((d) => /DELIVER|成功|ok/i.test(d.status)).length), detail: '—', tone: 'ok' },
      { label: '重试中', value: String(list.filter((d) => /RETRY|重试/i.test(d.status)).length), detail: '—', tone: 'warning' },
      { label: '失败', value: String(list.filter((d) => d.tone === 'danger').length), detail: '—', tone: 'danger' },
    ]) +
    filters('通知编号 / 工单') +
    table(['通知编号', '业务对象', '事件', '收件人', '渠道', '状态', '时间', '操作'], rows) +
    footer(`${list.length} 条`)
  )
}

export function deliveryFailures() {
  const list = records('failures')
  const rows = list.map((f) => [
    esc(f.id),
    esc(f.subtitle),
    esc(f.title),
    esc(f.values?.code || '—'),
    toneBadge(f.status, f.tone),
    esc(f.values?.next || '—'),
    `<button class="text-btn" data-action="retry-delivery" data-id="${esc(f.id)}">立即重试</button>`,
  ])
  return (
    head('失败与重试', 'WEB-11E', '失败不回滚业务状态', btn('刷新队列', 'refresh-bootstrap') + `<button class="btn primary" data-action="retry-all">重试可恢复项</button>`) +
    `<div class="health"><b>当前 ${list.length} 条失败记录</b><p class="sub">重试走 /failures/:id/retry（Simulator）。</p></div>` +
    table(['编号', '关联', '原因', '错误码', '状态', '下次', '操作'], rows) +
    footer(`${list.length} 条异常`)
  )
}

export function wechatSettings() {
  return (
    head('微信接入配置', 'WEB-11F', '密钥不在前端回显 · Simulator', btn('接口诊断') + `<button class="btn primary" data-action="wechat-connect">编辑接入</button>`) +
    `<div class="notify-hero"><section class="hero-main"><div class="section-kicker">WECHAT OFFICIAL ACCOUNT</div><h2>示例物业服务号</h2><p>当前使用 SimulatorChannel，不调用真实微信接口。</p></section><aside class="hero-status"><span class="muted">接入模式</span><strong>模拟</strong><span>可联调投递链路</span></aside></div>`
  )
}

export function agentOverview() {
  const tools = records('tools').length
  const apps = records('apps').length
  const logs = records('logs').length
  return (
    head('接入总览', 'AI-01', '工单系统为业务数据真源', `<button class="btn" data-page="agentPlayground">开始联调</button><button class="btn primary" data-action="publish-agent-capability">发布 Agent 能力</button>`) +
    `<div class="agent-hero"><section class="agent-hero-main"><div class="section-kicker">WORK ORDER AGENT GATEWAY</div><h2>让 H5 Agent 安全调用工单能力</h2><p>工具 ${tools} · 应用 ${apps} · 今日日志 ${logs}</p></section><aside class="agent-hero-side"><div><small>MCP 工具</small><strong style="display:block">${tools}</strong></div></aside></div>` +
    metricCards([
      { label: 'MCP 工具', value: String(tools), detail: '已启用目录', tone: 'ok' },
      { label: 'Skill 包', value: String(records('skills').length), detail: '—', tone: 'info' },
      { label: '授权应用', value: String(apps), detail: '—', tone: 'info' },
      { label: '调用日志', value: String(logs), detail: '最近', tone: 'neutral' },
    ]) +
    `<div class="agent-grid"><article class="agent-card"><div class="agent-icon">⌘</div><h3>MCP 工具目录</h3><p>统一管理工具契约。</p><button class="text-btn" data-page="mcpTools">查看工具 →</button></article><article class="agent-card"><div class="agent-icon">◇</div><h3>Skill 包</h3><p>对话策略与评测。</p><button class="text-btn" data-page="skillPackages">管理 Skill →</button></article><article class="agent-card"><div class="agent-icon">◎</div><h3>应用与权限</h3><p>按应用控制 scopes。</p><button class="text-btn" data-page="agentApps">查看授权 →</button></article></div>`
  )
}

export function mcpTools() {
  const list = records('tools')
  const rows = list.map((t, i) => [
    `<span class="tool-name">${esc(t.title)}</span>`,
    esc(t.subtitle),
    esc(t.values?.purpose || '—'),
    esc(t.values?.scope || '—'),
    toneBadge(t.status, t.tone),
    `<button class="text-btn" data-action="mcp-tool-detail" data-tool="${i}">详情</button>`,
  ])
  return (
    head('MCP 工具目录', 'AI-02', 'Contract 列表来自后端', btn('导出 Manifest') + `<button class="btn primary" data-action="publish-agent-capability">发布能力</button>`) +
    table(['工具', '类别', '用途', 'Scope', '状态', '操作'], rows) +
    footer(`${list.length} 个工具`)
  )
}

export function skillPackages() {
  const list = records('skills')
  const rows = list.map((s) => [
    `<strong>${esc(s.title)}</strong>`,
    esc(s.values?.version || s.subtitle),
    esc(s.values?.mcp || '—'),
    esc(s.values?.config || '—'),
    esc(s.values?.evals || '—'),
    toneBadge(s.status, s.tone),
    `<button class="text-btn" data-action="skill-detail">详情</button>`,
  ])
  return (
    head('Skill 包管理', 'AI-03', '生产与候选版本', btn('下载包', 'download-skill') + `<button class="btn primary" data-action="publish-agent-capability">发布能力</button>`) +
    table(['Skill', '版本', 'MCP', '配置', '评测', '状态', '操作'], rows) +
    footer(`${list.length} 个包`)
  )
}

export function agentApps() {
  const list = records('apps')
  const cards = list
    .map(
      (a) =>
        `<article class="app-card"><div class="app-card-head"><div class="app-logo">应</div><div><h3>${esc(a.title)}</h3><span class="muted">${esc(a.id)} · ${esc(a.subtitle)}</span></div><span style="margin-left:auto">${toneBadge(a.status, a.tone)}</span></div><div class="kv" style="margin-top:18px"><div><span>身份</span><b>${esc(a.values?.identity || '—')}</b></div><div><span>项目</span><b>${esc(a.values?.projects || '—')}</b></div><div><span>限流</span><b>${esc(a.values?.rate || '—')}</b></div><div><span>最近</span><b>${esc(a.values?.last || '—')}</b></div></div><div class="actions"><button class="btn" data-action="agent-app-detail">查看权限</button></div></article>`,
    )
    .join('')
  return (
    head('应用与权限', 'AI-04', '应用级授权 · 凭证不回显', `<button class="btn primary" data-action="new-agent-app">＋ 新建应用</button>`) +
    `<div class="agent-apps">${cards || '<p class="muted">暂无应用</p>'}</div>`
  )
}

export function agentPlayground() {
  return (
    head('联调测试台', 'AI-05', '沙箱提交 · 不走生产密钥', btn('重置', 'reset-agent-demo') + `<button class="btn primary" data-action="run-agent-demo">运行联调</button>`) +
    `<div class="playground"><div class="chat-panel"><div class="panel-head"><b>会话预览</b></div><div class="chat-body"><div class="bubble user">电梯有异响，帮我报修</div><div class="bubble agent">已识别为标准报修。请确认后提交。</div><div class="call-card">将调用 submit_work_order · 需确认</div></div></div><div class="trace-panel"><div class="panel-head"><b>调用轨迹</b></div><div class="trace-list"><div class="trace-row"><b>身份映射</b><code>通过</code></div><div class="trace-row"><b>Schema</b><code>已加载</code></div><div class="trace-row"><b>确认点</b><code>等待</code></div></div></div></div>`
  )
}

export function agentLogs() {
  const list = records('logs')
  const rows = list.map((l) => [
    esc(l.id),
    esc(l.title),
    esc(l.subtitle),
    toneBadge(l.status, l.tone),
    esc(l.values?.duration || '—'),
    esc(l.values?.at || '—'),
    `<button class="text-btn" data-action="agent-log-detail" data-id="${esc(l.id)}">详情</button>`,
  ])
  return (
    head('调用日志', 'AI-06', '已脱敏审计视图', btn('导出审计')) +
    table(['Trace', '工具', '应用', '结果', '耗时', '时间', '操作'], rows) +
    footer(`${list.length} 条`)
  )
}

export function messages() {
  const list = records('messages')
  const unread = list.filter((m) => m.status.includes('未读')).length
  const feed = list
    .map(
      (m) =>
        `<div class="feed-item"><div class="feed-icon">♧</div><div><b>${esc(m.title)}</b><div class="muted">${esc(m.values?.at || '')} · ${esc(m.subtitle)} · ${esc(m.values?.channel || '')}</div></div>${toneBadge(m.status, m.tone)}</div>`,
    )
    .join('')
  return (
    head('消息中心', 'WEB-14', `未读 ${unread}`, btn('全部标记已读')) +
    metricCards([
      { label: '全部', value: String(list.length), detail: '—', tone: 'info' },
      { label: '未读', value: String(unread), detail: '—', tone: 'warning' },
      { label: '已读', value: String(list.length - unread), detail: '—', tone: 'ok' },
      { label: '渠道', value: '站内/微信', detail: '—', tone: 'neutral' },
    ]) +
    `<div class="feed">${feed || '<div class="empty"><div class="ico">◎</div><strong>暂无消息</strong></div>'}</div>`
  )
}

export function workordersView() {
  const list = records('workorders')
  const by = (s) => list.filter((w) => w.status.includes(s)).length
  const rows = list.map((w, i) => [
    `<strong>${esc(w.id)}</strong>`,
    esc(w.title),
    esc(w.subtitle),
    toneBadge(w.status, w.tone),
    esc(w.values?.assignee || '—'),
    esc(w.values?.sla || '—'),
    esc(w.values?.created || '—'),
    `<div class="row-actions"><button class="text-btn" data-action="work-detail" data-row="${i}" data-id="${esc(w.id)}">详情</button><button class="text-btn" data-action="assign" data-row="${i}" data-id="${esc(w.id)}">派单</button></div>`,
  ])
  return (
    head('工单台账', 'WEB-17', '正式工单列表', btn('导出台账') + `<button class="btn primary" data-action="refresh-bootstrap">刷新</button>`) +
    metricCards([
      { label: '全部', value: String(list.length), detail: '当前项目', tone: 'info' },
      { label: '待分派', value: String(by('待分派')), detail: '—', tone: 'danger' },
      { label: '处理中', value: String(by('处理') + by('待接')), detail: '—', tone: 'warning' },
      { label: '已完成', value: String(by('完成')), detail: '—', tone: 'ok' },
    ]) +
    filters('搜索工单编号或标题') +
    table(['工单号', '问题', '位置', '状态', '责任人', 'SLA', '创建', '操作'], rows) +
    footer(`共 ${list.length} 条`)
  )
}

export function exceptions() {
  const list = records('exceptions')
  const rows = list.map((e) => [
    esc(e.id),
    esc(e.title),
    esc(e.subtitle),
    toneBadge(e.status, e.tone),
    `<button class="text-btn" data-action="toast">处理</button>`,
  ])
  return (
    head('异常列表', 'WEB-18', 'SLA / 派单 / 通知异常', btn('刷新', 'refresh-bootstrap')) +
    (list.length
      ? table(['编号', '异常', '关联', '状态', '操作'], rows) + footer(`${list.length} 条`)
      : `<div class="empty"><div class="ico">◎</div><strong>暂无异常</strong><span>当前项目没有未处理异常。</span></div>`)
  )
}
