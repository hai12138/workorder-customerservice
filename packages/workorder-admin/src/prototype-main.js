import shell from './prototype-shell.html?raw'
import * as P from './adapters/pages.js'
import { badge } from './adapters/ui.js'
import { clearSession, getSession, setProjectId } from './store/session.js'
import { loadBootstrap, refresh, records, getSnapshot, setFilteredProjects, clearFilteredProjects, setProjectsFilterState, clearProjectsFilterState } from './store/app-state.js'
import {
  createRecord,
  publishConfig,
  createDraft,
  configDiff,
  putFlow,
  putSlaPolicies,
  assignWorkorder,
  runCommand,
  queryProjects,
} from './api/workbench.js'
import { notifyApi } from './api/notify.js'
import { agentApi } from './api/agent.js'
import { CHINA_PCA, BUSINESS_TYPES } from './data/china-pca.js'

document.body.innerHTML = shell

const session = getSession()
if (session?.user) {
  const userBtn = document.querySelector('.user-btn')
  if (userBtn) {
    const initial = session.user.name.slice(0, 1)
    userBtn.innerHTML = `<span class="avatar">${initial}</span>${session.user.name} · ${session.user.role || session.user.identity}⌄`
  }
  const tag = document.querySelector('.prototype-tag')
  if (tag) tag.textContent = `已连接 API · ${session.user.name}`
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
  config: ['工单配置总览', 'WEB-06'],
  types: ['工单类型', 'WEB-07'],
  fields: ['表单字段', 'WEB-08'],
  flow: ['流程与 SLA', 'WEB-09'],
  dispatch: ['派单规则', 'WEB-10'],
  notificationCenter: ['通知中心', 'WEB-11'],
  notifications: ['通知策略', 'WEB-11A'],
  wechatTemplates: ['微信模板映射', 'WEB-11B'],
  channelBindings: ['用户渠道绑定', 'WEB-11C'],
  deliveryRecords: ['通知投递记录', 'WEB-11D'],
  deliveryFailures: ['失败与重试', 'WEB-11E'],
  wechatSettings: ['微信接入配置', 'WEB-11F'],
  agentOverview: ['Agent 接入总览', 'AI-01'],
  mcpTools: ['MCP 工具目录', 'AI-02'],
  skillPackages: ['Skill 包管理', 'AI-03'],
  agentApps: ['应用与权限', 'AI-04'],
  agentPlayground: ['联调测试台', 'AI-05'],
  agentLogs: ['调用日志', 'AI-06'],
  plans: ['计划工单', 'WEB-12'],
  publish: ['配置版本与发布', 'WEB-13'],
  messages: ['消息中心', 'WEB-14'],
  workorders: ['工单台账', 'WEB-17'],
  exceptions: ['异常中心', 'WEB-18'],
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
  
  // Hide scopebar on projects page (managing project list itself)
  const scopebar = document.querySelector('.scopebar')
  if (scopebar) scopebar.style.display = current === 'projects' ? 'none' : ''
  
  // Initialize project filters if on projects page
  if (current === 'projects') {
    setTimeout(() => initProjectFilters(), 0)
  }
  
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
    // If we have active filters, re-apply them
    const hasFilters = currentFilterState.keyword || 
                      currentFilterState.status !== '全部状态' ||
                      currentFilterState.province ||
                      currentFilterState.businessType !== '全部业态'
    
    if (current === 'projects' && hasFilters) {
      const projects = await queryProjects(
        currentFilterState.keyword,
        currentFilterState.status,
        currentFilterState.province,
        currentFilterState.city,
        currentFilterState.district,
        currentFilterState.businessType
      )
      setFilteredProjects(projects)
    } else {
      await refresh()
    }
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

function projectForm(rec) {
  return `<form id="demoForm">
    <div class="form-grid">
      <div class="form-row">
        <label>* 项目名称</label>
        <input id="f-title" required placeholder="例如：云栖雅苑" value="${rec ? esc(rec.title) : ''}">
      </div>
      <div class="form-row">
        <label>* 省份</label>
        <select id="f-province" required>
          <option value="">请选择省份</option>
        </select>
      </div>
      <div class="form-row">
        <label>* 城市</label>
        <select id="f-city" required disabled>
          <option value="">请先选择省份</option>
        </select>
      </div>
      <div class="form-row">
        <label>* 区/县</label>
        <select id="f-district" required disabled>
          <option value="">请先选择城市</option>
        </select>
      </div>
      <div class="form-row">
        <label>* 详细地址</label>
        <input id="f-address" required placeholder="例如：某某街道123号" value="${rec?.values?.address || ''}">
      </div>
      <div class="form-row">
        <label>* 业态</label>
        <select id="f-businessType" required>
          <option value="">请选择业态</option>
          <option ${rec?.values?.businessType === '住宅公寓' ? 'selected' : ''}>住宅公寓</option>
          <option ${rec?.values?.businessType === '产业园区' ? 'selected' : ''}>产业园区</option>
          <option ${rec?.values?.businessType === '写字楼' ? 'selected' : ''}>写字楼</option>
          <option ${rec?.values?.businessType === '商业综合体' ? 'selected' : ''}>商业综合体</option>
        </select>
      </div>
      <div class="form-row">
        <label>经度（可选）</label>
        <input id="f-longitude" type="number" step="any" placeholder="例如：120.123456" value="${rec?.values?.longitude || ''}">
      </div>
      <div class="form-row">
        <label>纬度（可选）</label>
        <input id="f-latitude" type="number" step="any" placeholder="例如：30.123456" value="${rec?.values?.latitude || ''}">
      </div>
      <div class="form-row">
        <label>客服电话</label>
        <input id="f-phone" placeholder="例如：400-123-4567" value="${rec?.values?.phone || ''}">
      </div>
      <div class="form-row">
        <label>项目负责人</label>
        <input id="f-manager" placeholder="例如：张经理" value="${rec?.values?.manager || ''}">
      </div>
    </div>
  </form>`
}

function esc(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

// Store filter state globally
let currentFilterState = {
  keyword: '',
  status: '全部状态',
  province: '',
  city: '',
  district: '',
  businessType: '全部业态'
}

// Helper function to populate PCA cascades
function initPCACascade(rec = null) {
  const provinceSelect = document.getElementById('f-province')
  const citySelect = document.getElementById('f-city')
  const districtSelect = document.getElementById('f-district')
  
  if (!provinceSelect) return
  
  // Populate provinces
  CHINA_PCA.forEach(prov => {
    const opt = document.createElement('option')
    opt.value = prov.name
    opt.textContent = prov.name
    if (rec?.values?.province === prov.name) opt.selected = true
    provinceSelect.appendChild(opt)
  })
  
  // Handle province change
  provinceSelect.addEventListener('change', () => {
    const selectedProvince = provinceSelect.value
    citySelect.innerHTML = '<option value="">请选择城市</option>'
    districtSelect.innerHTML = '<option value="">请先选择城市</option>'
    citySelect.disabled = !selectedProvince
    districtSelect.disabled = true
    
    if (selectedProvince) {
      const province = CHINA_PCA.find(p => p.name === selectedProvince)
      if (province) {
        province.cities.forEach(city => {
          const opt = document.createElement('option')
          opt.value = city.name
          opt.textContent = city.name
          citySelect.appendChild(opt)
        })
      }
    }
  })
  
  // Handle city change
  citySelect.addEventListener('change', () => {
    const selectedProvince = provinceSelect.value
    const selectedCity = citySelect.value
    districtSelect.innerHTML = '<option value="">请选择区/县</option>'
    districtSelect.disabled = !selectedCity
    
    if (selectedProvince && selectedCity) {
      const province = CHINA_PCA.find(p => p.name === selectedProvince)
      if (province) {
        const city = province.cities.find(c => c.name === selectedCity)
        if (city) {
          city.districts.forEach(district => {
            const opt = document.createElement('option')
            opt.value = district
            opt.textContent = district
            districtSelect.appendChild(opt)
          })
        }
      }
    }
  })
  
  // If editing, populate city and district
  if (rec?.values?.province) {
    const province = CHINA_PCA.find(p => p.name === rec.values.province)
    if (province) {
      citySelect.innerHTML = '<option value="">请选择城市</option>'
      province.cities.forEach(city => {
        const opt = document.createElement('option')
        opt.value = city.name
        opt.textContent = city.name
        if (rec.values.city === city.name) opt.selected = true
        citySelect.appendChild(opt)
      })
      citySelect.disabled = false
      
      if (rec.values.city) {
        const city = province.cities.find(c => c.name === rec.values.city)
        if (city) {
          districtSelect.innerHTML = '<option value="">请选择区/县</option>'
          city.districts.forEach(district => {
            const opt = document.createElement('option')
            opt.value = district
            opt.textContent = district
            if (rec.values.district === district) opt.selected = true
            districtSelect.appendChild(opt)
          })
          districtSelect.disabled = false
        }
      }
    }
  }
}

// Helper function to initialize project page filters
function initProjectFilters() {
  const provinceFilter = document.getElementById('province-select')
  const cityFilter = document.getElementById('city-select')
  const districtFilter = document.getElementById('district-select')
  
  if (!provinceFilter) return
  
  // Populate province filter
  CHINA_PCA.forEach(prov => {
    const opt = document.createElement('option')
    opt.value = prov.name
    opt.textContent = prov.name
    if (currentFilterState.province === prov.name) opt.selected = true
    provinceFilter.appendChild(opt)
  })
  
  // Handle province filter change
  provinceFilter.addEventListener('change', () => {
    const selectedProvince = provinceFilter.value
    cityFilter.innerHTML = '<option value="">全部城市</option>'
    districtFilter.innerHTML = '<option value="">全部区县</option>'
    cityFilter.disabled = !selectedProvince
    districtFilter.disabled = true
    currentFilterState.province = selectedProvince
    currentFilterState.city = ''
    currentFilterState.district = ''
    
    if (selectedProvince) {
      const province = CHINA_PCA.find(p => p.name === selectedProvince)
      if (province) {
        province.cities.forEach(city => {
          const opt = document.createElement('option')
          opt.value = city.name
          opt.textContent = city.name
          cityFilter.appendChild(opt)
        })
      }
    }
  })
  
  // Handle city filter change
  cityFilter.addEventListener('change', () => {
    const selectedProvince = provinceFilter.value
    const selectedCity = cityFilter.value
    districtFilter.innerHTML = '<option value="">全部区县</option>'
    districtFilter.disabled = !selectedCity
    currentFilterState.city = selectedCity
    currentFilterState.district = ''
    
    if (selectedProvince && selectedCity) {
      const province = CHINA_PCA.find(p => p.name === selectedProvince)
      if (province) {
        const city = province.cities.find(c => c.name === selectedCity)
        if (city) {
          city.districts.forEach(district => {
            const opt = document.createElement('option')
            opt.value = district
            opt.textContent = district
            districtFilter.appendChild(opt)
          })
        }
      }
    }
  })
  
  // Handle district filter change
  districtFilter.addEventListener('change', () => {
    currentFilterState.district = districtFilter.value
  })
  
  // Restore filter state
  if (currentFilterState.province) {
    const province = CHINA_PCA.find(p => p.name === currentFilterState.province)
    if (province) {
      cityFilter.innerHTML = '<option value="">全部城市</option>'
      province.cities.forEach(city => {
        const opt = document.createElement('option')
        opt.value = city.name
        opt.textContent = city.name
        if (currentFilterState.city === city.name) opt.selected = true
        cityFilter.appendChild(opt)
      })
      cityFilter.disabled = false
      
      if (currentFilterState.city) {
        const city = province.cities.find(c => c.name === currentFilterState.city)
        if (city) {
          districtFilter.innerHTML = '<option value="">全部区县</option>'
          city.districts.forEach(district => {
            const opt = document.createElement('option')
            opt.value = district
            opt.textContent = district
            if (currentFilterState.district === district) opt.selected = true
            districtFilter.appendChild(opt)
          })
          districtFilter.disabled = false
        }
      }
    }
  }
  
  // Restore other filter values
  const keywordInput = document.getElementById('keyword')
  const statusSelect = document.getElementById('status-select')
  const businessTypeSelect = document.getElementById('businessType-select')
  
  if (keywordInput) keywordInput.value = currentFilterState.keyword
  if (statusSelect) statusSelect.value = currentFilterState.status
  if (businessTypeSelect) businessTypeSelect.value = currentFilterState.businessType
}


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
    if (act === 'toast') {
      toast(a.dataset.message || '操作已触发')
      return
    }
    if (act === 'query') {
      if (current === 'projects') {
        const keyword = document.getElementById('keyword')?.value?.trim() || ''
        const statusSelect = document.getElementById('status-select')?.value || ''
        const provinceSelect = document.getElementById('province-select')?.value || ''
        const citySelect = document.getElementById('city-select')?.value || ''
        const districtSelect = document.getElementById('district-select')?.value || ''
        const businessTypeSelect = document.getElementById('businessType-select')?.value || ''
        
        // Save filter state using both methods
        setProjectsFilterState(keyword, statusSelect, provinceSelect, citySelect, districtSelect, businessTypeSelect)
        currentFilterState.keyword = keyword
        currentFilterState.status = statusSelect
        currentFilterState.province = provinceSelect
        currentFilterState.city = citySelect
        currentFilterState.district = districtSelect
        currentFilterState.businessType = businessTypeSelect
        
        try {
          const projects = await queryProjects(keyword, statusSelect, provinceSelect, citySelect, districtSelect, businessTypeSelect)
          setFilteredProjects(projects)
          render()
          toast(`已加载 ${projects.length} 个项目`)
        } catch (e) {
          toast(e.message || '查询失败')
        }
      } else {
        toast('筛选条件已应用')
      }
      return
    }
    if (act === 'reset-filter') {
      const k = document.getElementById('keyword')
      if (k) k.value = ''
      const selects = document.querySelectorAll('.filters select')
      selects.forEach((s) => (s.selectedIndex = 0))
      
      // Reset filter state
      currentFilterState = {
        keyword: '',
        status: '全部状态',
        province: '',
        city: '',
        district: '',
        businessType: '全部业态'
      }
      
      if (current === 'projects') {
        clearFilteredProjects()
        clearProjectsFilterState()
        render()
      }
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
    if (act === 'new-project') {
      modal('新建项目', projectForm(null), `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-project">保存</button>`)
      setTimeout(() => initPCACascade(), 0)
      return
    }
    if (act === 'project-edit') {
      const id = a.dataset.id
      const rec = records('projects').find((x) => x.id === id)
      if (!rec) return toast('未找到项目')
      modal('编辑项目', projectForm(rec), `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-project" data-id="${id}">保存</button>`)
      setTimeout(() => initPCACascade(rec), 0)
      return
    }
    if (act === 'save-project') {
      const title = document.getElementById('f-title')?.value?.trim()
      const province = document.getElementById('f-province')?.value?.trim() || ''
      const city = document.getElementById('f-city')?.value?.trim() || ''
      const district = document.getElementById('f-district')?.value?.trim() || ''
      const address = document.getElementById('f-address')?.value?.trim() || ''
      const businessType = document.getElementById('f-businessType')?.value?.trim() || ''
      const longitude = document.getElementById('f-longitude')?.value?.trim()
      const latitude = document.getElementById('f-latitude')?.value?.trim()
      const manager = document.getElementById('f-manager')?.value?.trim() || ''
      const phone = document.getElementById('f-phone')?.value?.trim() || ''
      
      if (!title) return toast('请填写项目名称')
      if (!province || !city || !district) return toast('请选择完整的省市区')
      if (!address) return toast('请填写详细地址')
      if (!businessType) return toast('请选择业态')
      
      const data = { name: title, province, city, district, address, businessType, manager, phone }
      if (longitude) data.longitude = parseFloat(longitude)
      if (latitude) data.latitude = parseFloat(latitude)
      
      const id = a.dataset.id
      if (id) {
        await updateProject(id, data)
      } else {
        await createRecord('projects', { title, values: data })
      }
      await afterWrite(id ? '项目信息已更新' : '项目已创建')
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
    if (act === 'export-projects') {
      const list = records('projects')
      const headers = ['项目名称', '项目编号', '省份', '城市', '区/县', '详细地址', '业态', '经度', '纬度', '客服电话', '项目负责人', '服务状态']
      const rows = list.map((p) => [
        p.title,
        p.id,
        p.values?.province || '',
        p.values?.city || '',
        p.values?.district || '',
        p.values?.address || '',
        p.values?.businessType || '',
        p.values?.longitude || '',
        p.values?.latitude || '',
        p.values?.phone || '',
        p.values?.manager || '',
        p.status,
      ])
      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `项目列表_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast('项目列表已导出')
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
