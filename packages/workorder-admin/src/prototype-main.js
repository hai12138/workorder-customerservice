import shell from './prototype-shell.html?raw'
import * as P from './adapters/pages.js'
import { badge } from './adapters/ui.js'
import { clearSession, getSession, setProjectId } from './store/session.js'
import { loadBootstrap, refresh, records, getSnapshot } from './store/app-state.js'
import {
  createRecord,
  publishConfig,
  createDraft,
  configDiff,
  putFlow,
  putSlaPolicies,
  assignWorkorder,
} from './api/workbench.js'
import { notifyApi } from './api/notify.js'
import { agentApi } from './api/agent.js'

document.body.innerHTML = shell

const session = getSession()
if (session?.user) {
  const userBtn = document.querySelector('.user-btn')
  if (userBtn) {
    const initial = session.user.name.slice(0, 1)
    userBtn.innerHTML = `<span class="avatar">${initial}</span>${session.user.name} · ${session.user.role || session.user.identity}⌄`
  }
}

const projectSelect = document.getElementById('projectSelect')
async function fillProjects() {
  if (!projectSelect) return
  const projects = records('projects')
  const snap = getSnapshot()
  if (!projects.length) return
  projectSelect.innerHTML = projects
    .map((p) => `<option value="${p.id}" ${p.id === snap?.projectId ? 'selected' : ''}>${p.title} · ${p.status}</option>`)
    .join('')
}
projectSelect?.addEventListener('change', async () => {
  setProjectId(projectSelect.value)
  toast('正在切换项目…')
  try {
    await refresh()
    await fillProjects()
    render()
    toast('项目已切换')
  } catch (e) {
    toast(e.message || '切换失败')
  }
})

const pages = {
  dashboard: ['运营总览', 'OPS-01'],
  projects: ['项目管理', 'WEB-01'],
  spaces: ['空间管理', 'WEB-02'],
  people: ['用户与员工管理', 'WEB-03'],
  roles: ['角色权限', 'WEB-04'],
  config: ['配置总览', 'WEB-06'],
  types: ['工单类型', 'WEB-07'],
  fields: ['表单字段', 'WEB-08'],
  flow: ['流程与 SLA', 'WEB-09'],
  dispatch: ['派单规则', 'WEB-10'],
  notificationCenter: ['通知总览', 'WEB-11'],
  notifications: ['通知策略', 'WEB-11A'],
  wechatTemplates: ['微信模板映射', 'WEB-11B'],
  channelBindings: ['用户渠道绑定', 'WEB-11C'],
  deliveryRecords: ['投递记录', 'WEB-11D'],
  deliveryFailures: ['失败与重试', 'WEB-11E'],
  wechatSettings: ['微信接入配置', 'WEB-11F'],
  agentOverview: ['接入总览', 'AI-01'],
  mcpTools: ['MCP 工具目录', 'AI-02'],
  skillPackages: ['Skill 包管理', 'AI-03'],
  agentApps: ['应用与权限', 'AI-04'],
  agentPlayground: ['联调测试台', 'AI-05'],
  agentLogs: ['调用日志', 'AI-06'],
  plans: ['计划工单', 'WEB-12'],
  publish: ['配置版本与发布', 'WEB-13'],
  messages: ['消息中心', 'WEB-14'],
  workorders: ['工单台账', 'WEB-17'],
  exceptions: ['异常列表', 'WEB-18'],
}

function dashboard() {
  return P.dashboard()
}
function projects() {
  return P.projects()
}
function spaces() {
  return P.spaces()
}
function peopleView() {
  return P.peopleView()
}
function roles() {
  return P.roles()
}
function config() {
  return P.config()
}
function types() {
  return P.types()
}
function fields() {
  return P.fields()
}
function flow() {
  return P.flow()
}
function dispatch() {
  return P.dispatch()
}
function notificationCenter() {
  return P.notificationCenter()
}
function notifications() {
  return P.notifications()
}
function wechatTemplates() {
  return P.wechatTemplates()
}
function channelBindings() {
  return P.channelBindings()
}
function deliveryRecords() {
  return P.deliveryRecords()
}
function deliveryFailures() {
  return P.deliveryFailures()
}
function wechatSettings() {
  return P.wechatSettings()
}
function agentOverview() {
  return P.agentOverview()
}
function mcpTools() {
  return P.mcpTools()
}
function skillPackages() {
  return P.skillPackages()
}
function agentApps() {
  return P.agentApps()
}
function agentPlayground() {
  return P.agentPlayground()
}
function agentLogs() {
  return P.agentLogs()
}
function plans() {
  return P.plans()
}
function publish() {
  return P.publish()
}
function messages() {
  return P.messages()
}
function workordersView() {
  return P.workordersView()
}
function exceptions() {
  return P.exceptions()
}

const renderers = {
  dashboard,
  projects,
  spaces,
  people: peopleView,
  roles,
  config,
  types,
  fields,
  flow,
  dispatch,
  notificationCenter,
  notifications,
  wechatTemplates,
  channelBindings,
  deliveryRecords,
  deliveryFailures,
  wechatSettings,
  agentOverview,
  mcpTools,
  skillPackages,
  agentApps,
  agentPlayground,
  agentLogs,
  plans,
  publish,
  messages,
  workorders: workordersView,
  exceptions,
}

let current = (location.hash || '#dashboard').slice(1)
if (!pages[current]) current = 'dashboard'

function render() {
  document.getElementById('page').innerHTML = renderers[current]()
  document.getElementById('tabTitle').innerHTML = `${pages[current][0]} <span>×</span>`
  document.title = `${pages[current][0]} · Astra Service OS`
  document.querySelectorAll('[data-page]').forEach((x) => x.classList.toggle('active', x.dataset.page === current))
  document.querySelectorAll('.nav-group').forEach((g) => {
    if (g.querySelector(`[data-page="${current}"]`)) g.classList.add('open')
  })
  window.scrollTo(0, 0)
}

function nav(p) {
  if (!pages[p]) return
  document.getElementById('portal').innerHTML = ''
  document.querySelectorAll('.menu-pop').forEach((x) => x.remove())
  current = p
  location.hash = p
  render()
}

function modal(title, body, foot = '', wide = false) {
  document.getElementById('portal').innerHTML =
    `<div class="overlay"><div class="modal ${wide ? 'wide' : ''}"><div class="modal-head"><h2>${title}</h2><button class="close" data-action="close">×</button></div><div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div></div>`
}

function drawer(title, body) {
  document.getElementById('portal').innerHTML =
    `<div class="drawer-wrap"><aside class="drawer"><div class="drawer-head"><h2>${title}</h2><button class="close" data-action="close">×</button></div><div class="drawer-body">${body}</div></aside></div>`
}

function toast(msg) {
  const d = document.createElement('div')
  d.className = 'toast'
  d.textContent = msg || '操作已触发'
  document.body.appendChild(d)
  setTimeout(() => d.remove(), 2200)
}

async function afterWrite(msg) {
  document.getElementById('portal').innerHTML = ''
  try {
    await refresh()
    await fillProjects()
    render()
    toast(msg)
  } catch (e) {
    toast(e.message || '刷新失败')
  }
}

function flowNodeModal(node, tab = 'task') {
  const tabs = `<div class="dialog-tabs"><button class="dialog-tab ${tab === 'base' ? 'on' : ''}" data-action="node-tab" data-node="${node}" data-tab="base">基础设置</button><button class="dialog-tab ${tab === 'task' ? 'on' : ''}" data-action="node-tab" data-node="${node}" data-tab="task">待办与通知</button><button class="dialog-tab ${tab === 'rules' ? 'on' : ''}" data-action="node-tab" data-node="${node}" data-tab="rules">进入 / 退出规则</button></div>`
  let body = ''
  if (tab === 'base') {
    body = `<div class="setting-section"><h3>业务状态</h3><div class="form-grid"><div class="form-row"><label>状态名称</label><input value="${node}"></div><div class="form-row"><label>状态编码</label><input value="${node === '待分派' ? 'PENDING_ASSIGN' : node === '待接单' ? 'PENDING_ACCEPT' : node === '处理中' ? 'PROCESSING' : 'COMPLETED'}"></div></div></div>`
  } else if (tab === 'rules') {
    body = `<div class="setting-section"><h3>流转约束</h3><p class="section-help">业务合法性由工单核心校验。</p></div>`
  } else {
    body = `<div class="setting-section"><h3>流程待办</h3><p class="section-help">待办在节点激活时创建并冻结处理人。</p></div>`
  }
  modal(`${node} · 节点配置`, tabs + body, `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-node-config">保存到草稿</button>`, true)
}

function wechatMessagePreview() {
  modal(
    '微信服务号通知预览',
    `<div class="phone-preview"><div class="phone-notch"></div><div class="wechat-msg"><h3>工单待处理提醒</h3><div class="wechat-line"><span>工单编号</span><b>示例</b></div><div class="wechat-open">进入安全 H5 处理　›</div></div></div>`,
    `<button class="btn" data-action="close">关闭</button><button class="btn primary" data-action="test-send">发送测试</button>`,
    true,
  )
}

const projectForm = `<form id="demoForm"><div class="form-grid"><div class="form-row"><label>* 项目名称</label><input id="f-title" required placeholder="例如：云栖雅苑"></div><div class="form-row"><label>地区/副标题</label><input id="f-sub" placeholder="华东 / 临江市"></div></div></form>`

document.addEventListener('click', (e) => {
  const p = e.target.closest('[data-page]')
  if (p) {
    nav(p.dataset.page)
    return
  }
  const group = e.target.closest('.nav-group-title')
  if (group) {
    group.parentElement.classList.toggle('open')
    return
  }
  const a = e.target.closest('[data-action]')
  if (!a) return
  const act = a.dataset.action
  void handleAction(act, a)
})

async function handleAction(act, a) {
  try {
    if (act === 'close') {
      document.getElementById('portal').innerHTML = ''
      return
    }
    if (act === 'toast' || act === 'query') {
      toast(a.dataset.message || '筛选条件已应用')
      return
    }
    if (act === 'reset-filter') {
      const k = document.getElementById('keyword')
      if (k) k.value = ''
      toast('筛选条件已重置')
      return
    }
    if (act === 'refresh-bootstrap') {
      await refresh()
      await fillProjects()
      render()
      toast('数据已刷新')
      return
    }
    if (act === 'logout') {
      document.querySelectorAll('.menu-pop').forEach((x) => x.remove())
      clearSession()
      location.reload()
      return
    }
    if (act === 'more') {
      togglePop('more')
      return
    }
    if (act === 'user-menu') {
      togglePop('user')
      return
    }
    if (act === 'search-menu') {
      modal(
        '菜单搜索',
        `<div class="form-row"><input id="menuSearch" autofocus placeholder="输入菜单名称"></div><div class="config-list" id="menuResults">${Object.entries(pages)
          .map(([k, v]) => `<button class="btn" data-page="${k}">${v[0]}</button>`)
          .join('')}</div>`,
        '',
        true,
      )
      return
    }
    if (act === 'new-project' || act === 'project-edit') {
      modal(act === 'new-project' ? '新建项目' : '编辑项目', projectForm, `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-project">保存</button>`)
      return
    }
    if (act === 'save-project') {
      const title = document.getElementById('f-title')?.value?.trim()
      const subtitle = document.getElementById('f-sub')?.value?.trim() || ''
      if (!title) return toast('请填写项目名称')
      await createRecord('projects', { title, subtitle })
      await afterWrite('项目已保存')
      return
    }
    if (act === 'project-detail') {
      const id = a.dataset.id
      const rec = records('projects').find((x) => x.id === id) || records('projects')[0]
      if (!rec) return toast('未找到项目')
      drawer(
        `${rec.title} · 项目详情`,
        `<div class="actions">${badge(rec.status, 'ok')}<span class="muted">${rec.id}</span></div><div class="kv" style="margin-top:15px"><div><span>副标题</span><b>${rec.subtitle || '—'}</b></div><div><span>管理员</span><b>${rec.values?.manager || '—'}</b></div><div><span>电话</span><b>${rec.values?.phone || '—'}</b></div><div><span>空间数</span><b>${rec.values?.spaces ?? '—'}</b></div></div>`,
      )
      return
    }
    if (act === 'new-space') {
      modal(
        '新增空间',
        `<div class="form-grid"><div class="form-row"><label>* 空间名称</label><input id="f-title" placeholder="例如：A区地下车库"></div><div class="form-row"><label>* 空间类型</label><select id="f-type"><option>楼栋</option><option>楼层</option><option>公区 / 车库</option><option>公区 / 绿化</option></select></div></div>`,
        `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-space">保存</button>`,
      )
      return
    }
    if (act === 'save-space') {
      const title = document.getElementById('f-title')?.value?.trim()
      const type = document.getElementById('f-type')?.value || '楼栋'
      if (!title) return toast('请填写空间名称')
      await createRecord('spaces', { title, values: { type } })
      await afterWrite('空间已创建')
      return
    }
    if (act === 'space-detail') {
      const rec = records('spaces').find((x) => x.id === a.dataset.id) || records('spaces')[0]
      if (!rec) return toast('未找到空间')
      drawer(`${rec.title} · 空间详情`, `${badge(rec.status, 'ok')}<div class="kv" style="margin-top:15px"><div><span>类型</span><b>${rec.values?.type || '—'}</b></div><div><span>路径</span><b>${rec.subtitle || '—'}</b></div><div><span>上级</span><b>${rec.values?.parent || '—'}</b></div></div>`)
      return
    }
    if (['new-person', 'person-edit', 'person-detail', 'new-role', 'new-type', 'type-detail', 'new-field', 'new-rule', 'new-plan', 'new-agent-app'].includes(act)) {
      const collection =
        act.includes('person') || act === 'new-person'
          ? 'people'
          : act.includes('role')
            ? 'roles'
            : act.includes('type')
              ? 'types'
              : act.includes('field')
                ? 'fields'
                : act.includes('rule')
                  ? 'dispatch'
                  : act.includes('plan')
                    ? 'plans'
                    : null
      if (act.endsWith('-detail') || act === 'person-detail' || act === 'type-detail') {
        modal(a.textContent.trim() || '详情', `<p class="sub">记录详情（只读演示）。</p><div class="form-grid"><div class="form-row"><label>名称</label><input value="${a.dataset.id || ''}" disabled></div></div>`, `<button class="btn" data-action="close">关闭</button>`)
        return
      }
      modal(
        a.textContent.trim() || '新建',
        `<div class="form-grid"><div class="form-row"><label>名称</label><input id="f-title" placeholder="请输入名称"></div><div class="form-row"><label>说明</label><input id="f-sub" placeholder="可选"></div></div>`,
        `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-collection" data-collection="${collection || 'people'}">保存</button>`,
      )
      return
    }
    if (act === 'save-collection') {
      const title = document.getElementById('f-title')?.value?.trim()
      const subtitle = document.getElementById('f-sub')?.value?.trim() || ''
      const collection = a.dataset.collection || 'people'
      if (!title) return toast('请填写名称')
      if (collection === 'null' || !collection) return toast('暂不支持此创建')
      await createRecord(collection, { title, subtitle })
      await afterWrite('已保存')
      return
    }
    if (act === 'save-form') {
      document.getElementById('portal').innerHTML = ''
      toast('表单已关闭（请使用带集合保存的按钮）')
      return
    }
    if (act === 'work-detail') {
      const list = records('workorders')
      const w = list[+a.dataset.row] || list.find((x) => x.id === a.dataset.id) || list[0]
      if (!w) return toast('未找到工单')
      drawer(
        `${w.title} ${badge(w.status, 'warn')}`,
        `<div class="kv"><div><span>工单号</span><b>${w.id}</b></div><div><span>类型</span><b>${w.values?.type || '—'}</b></div><div><span>状态</span><b>${w.status}</b></div><div><span>SLA</span><b>${w.values?.sla || '—'}</b></div><div style="grid-column:1/-1"><span>位置</span><b>${w.subtitle || '—'}</b></div></div>`,
      )
      return
    }
    if (act === 'assign') {
      const list = records('workorders')
      const w = list[+a.dataset.row] || list.find((x) => x.id === a.dataset.id) || list[0]
      if (!w) return toast('未找到工单')
      const people = records('people').filter((p) => /物管|客服|维修|管理/.test(String(p.values?.identity || '')))
      const options = (people.length ? people : records('people')).slice(0, 6)
      modal(
        '派单确认',
        `<div class="health"><b>工单 ${w.id}</b><p class="sub">${w.title}</p></div>${options.map((x) => `<label class="radio-card"><input type="radio" name="owner" value="${x.id}"> <b>${x.title}</b>　<span class="muted">${x.values?.identity || ''}</span></label>`).join('')}`,
        `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="confirm-assign" data-id="${w.id}">确认派单</button>`,
        true,
      )
      return
    }
    if (act === 'confirm-assign') {
      const owner = document.querySelector('input[name="owner"]:checked')?.value
      if (!owner) return toast('请选择责任人')
      await assignWorkorder(a.dataset.id, owner)
      await afterWrite('派单已提交')
      return
    }
    if (act === 'candidate-test') {
      modal('候选人员测试', `<div class="health"><b>验证通过</b><p>规则候选来自当前人员数据。</p></div>${records('people').slice(0, 4).map((x) => `<label class="radio-card">${x.title} ${badge('可派', 'ok')}</label>`).join('')}`)
      return
    }
    if (act === 'publish-confirm') {
      modal(
        '发布草稿',
        `<div class="health"><b>确认发布当前草稿？</b><p class="sub">发布后仅影响新创建工单。</p></div><div class="form-row"><label>版本标签</label><input id="f-version" value="V4"></div>`,
        `<button class="btn" data-action="close">返回</button><button class="btn primary" data-action="demo-publish">确认发布</button>`,
      )
      return
    }
    if (act === 'demo-publish') {
      const version = document.getElementById('f-version')?.value || 'V4'
      await publishConfig(version)
      await afterWrite('配置已发布')
      return
    }
    if (act === 'ensure-draft') {
      await createDraft()
      await afterWrite('草稿已就绪')
      return
    }
    if (act === 'run-config-diff') {
      const diff = await configDiff()
      const el = document.getElementById('publish-health')
      if (el) el.innerHTML = `<b>差异校验完成</b><p class="sub"><pre style="white-space:pre-wrap;font-size:12px">${JSON.stringify(diff, null, 2).slice(0, 1200)}</pre></p>`
      toast('已加载 /config/diff')
      return
    }
    if (act === 'save-flow') {
      await putFlow('standard', { name: '标准处理流程', definition: { nodes: ['待分派', '待接单', '处理中', '已完成'] } })
      toast('流程已保存到草稿')
      return
    }
    if (act === 'save-sla') {
      await putSlaPolicies([
        { typeCode: 'REPAIR', nodeKey: 'assign', timeoutHours: 0.5 },
        { typeCode: 'REPAIR', nodeKey: 'accept', timeoutHours: 2 },
        { typeCode: 'REPAIR', nodeKey: 'complete', timeoutHours: 24 },
      ])
      toast('SLA 已保存')
      return
    }
    if (act === 'save-node-config') {
      document.getElementById('portal').innerHTML = ''
      toast('节点配置已保存到草稿（本地演示落库走流程 PUT）')
      return
    }
    if (act === 'flow-node-edit') {
      flowNodeModal(a.dataset.node || '待接单')
      return
    }
    if (act === 'node-tab') {
      flowNodeModal(a.dataset.node || '待接单', a.dataset.tab)
      return
    }
    if (act === 'wechat-preview') {
      wechatMessagePreview()
      return
    }
    if (act === 'edit-policy') {
      modal(
        '通知策略配置',
        `<div class="form-grid"><div class="form-row"><label>策略名称</label><input id="f-title" value="新待办立即通知"></div><div class="form-row"><label>业务事件</label><input id="f-sub" value="WorkItemAssigned"></div></div>`,
        `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-policy">保存策略</button>`,
        true,
      )
      return
    }
    if (act === 'save-policy') {
      const title = document.getElementById('f-title')?.value?.trim() || '新策略'
      const subtitle = document.getElementById('f-sub')?.value?.trim() || 'CustomEvent'
      await notifyApi.createPolicy({ title, subtitle })
      await afterWrite('策略已创建')
      return
    }
    if (act === 'template-mapping') {
      modal('微信模板映射', `<p class="sub">映射保存在服务端；当前为配置表单演示。</p><div class="form-grid"><div class="form-row full"><label>H5 跳转</label><input value="/task/open?n={notice_id}"></div></div>`, `<button class="btn" data-action="wechat-preview">预览</button><button class="btn primary" data-action="close">完成</button>`, true)
      return
    }
    if (act === 'binding-detail' || act === 'delivery-detail' || act === 'binding-invite' || act === 'wechat-connect') {
      modal(act, `<p class="sub">详情/配置弹窗（数据已从 API 列表加载）。</p>`, `<button class="btn" data-action="close">关闭</button>`)
      return
    }
    if (act === 'retry-delivery') {
      await notifyApi.retryFailure(a.dataset.id)
      await afterWrite('已触发重试')
      return
    }
    if (act === 'retry-all') {
      const fails = records('failures')
      for (const f of fails.slice(0, 5)) {
        try {
          await notifyApi.retryFailure(f.id)
        } catch {
          /* continue */
        }
      }
      await afterWrite('已批量重试')
      return
    }
    if (act === 'simulate-notification' || act === 'run-simulation' || act === 'test-send' || act === 'refresh-notification') {
      document.getElementById('portal').innerHTML = ''
      toast(act === 'run-simulation' ? '联调通过：Simulator 链路正常' : '通知中心状态已刷新')
      return
    }
    if (act === 'mcp-tool-detail' || act === 'skill-detail' || act === 'agent-app-detail' || act === 'agent-log-detail') {
      drawer('详情', `<p class="sub">来自后端目录/日志的只读详情。</p><div class="kv"><div><span>ID</span><b>${a.dataset.id || a.dataset.tool || '—'}</b></div></div>`)
      return
    }
    if (act === 'publish-agent-capability') {
      modal(
        '发布 Agent 能力',
        `<div class="health"><b>兼容性校验</b><p class="sub">将调用 /agent/capabilities/publish</p></div>`,
        `<button class="btn" data-action="close">返回</button><button class="btn primary" data-action="complete-agent-publish">确认发布</button>`,
        true,
      )
      return
    }
    if (act === 'complete-agent-publish') {
      await agentApi.publish(`R-${Date.now().toString().slice(-4)}`)
      await afterWrite('Agent 能力已发布')
      return
    }
    if (act === 'run-agent-demo') {
      modal(
        '运行 Agent 联调用例',
        `<div class="health"><b>联调停在确认点</b><p class="sub">下一步将调用沙箱提交接口。</p></div>`,
        `<button class="btn" data-action="close">结束</button><button class="btn primary" data-action="confirm-agent-submit">模拟用户确认</button>`,
        true,
      )
      return
    }
    if (act === 'confirm-agent-submit') {
      modal(
        '确认提交工单',
        `<div class="health"><b>结构化工单摘要</b><p class="sub">标准报修 · 沙箱</p></div>`,
        `<button class="btn" data-action="close">暂不提交</button><button class="btn primary" data-action="complete-agent-submit">确认提交</button>`,
      )
      return
    }
    if (act === 'complete-agent-submit') {
      const result = await agentApi.sandboxSubmit({ type_code: 'REPAIR', title: '电梯运行异响', description: '联调沙箱提交' })
      document.getElementById('portal').innerHTML = ''
      await refresh()
      render()
      toast(result?.message || '联调通过：沙箱工单已创建')
      return
    }
    if (act === 'download-skill' || act === 'reset-agent-demo') {
      toast(act === 'download-skill' ? 'Skill 包导出为演示操作' : '联调会话已重置')
      return
    }
    if (act === 'confirm-disable') {
      modal('停用项目', `<p>停用为受控操作；当前仅演示确认框。</p>`, `<button class="btn" data-action="close">取消</button><button class="btn danger" data-action="close">确认停用（演示）</button>`)
      return
    }
    if (act === 'variant-prev' || act === 'variant-next') {
      toast('变体切换在 API 模式下以真实数据页为准')
      return
    }
  } catch (err) {
    toast(err?.message || '操作失败')
  }
}

function togglePop(kind) {
  document.querySelectorAll('.menu-pop').forEach((x) => x.remove())
  const d = document.createElement('div')
  d.className = 'menu-pop ' + (kind === 'user' ? 'user' : '')
  d.innerHTML =
    kind === 'user'
      ? `<button data-action="toast">个人中心</button><button data-action="toast">主题设置</button><button data-action="logout">退出登录</button>`
      : `<button data-action="toast">主题设置</button><button data-action="toast">简体中文</button>`
  document.body.appendChild(d)
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'menuSearch') {
    const q = e.target.value.trim()
    document.querySelectorAll('#menuResults button').forEach((b) => b.classList.toggle('hidden', q && !b.textContent.includes(q)))
  }
})

window.addEventListener('hashchange', () => {
  const p = location.hash.slice(1)
  if (pages[p]) {
    current = p
    render()
  }
})

await fillProjects()
render()
