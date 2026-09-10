import shell from './prototype-shell.html?raw'
import * as P from './adapters/pages.js'
import { badge } from './adapters/ui.js'
import { clearSession, getSession, setProjectId } from './store/session.js'
import { loadBootstrap, refresh, records, getSnapshot, setFilteredProjects, clearFilteredProjects, setProjectsFilterState, clearProjectsFilterState, setSpacesCache, getSpacesCache, setSelectedSpaceId, clearSelectedSpaceId, setSpacesFilterState, clearSpacesFilterState, setPeopleTab, getPeopleTab, getPeopleFilterState, setPeopleFilterState, clearPeopleFilterState, getPeopleListCache, setPeopleListCache, clearPeopleListCache } from './store/app-state.js'
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
  updateProject,
  getSpaces,
  createSpace,
  updateSpace,
  deleteSpace,
  downloadSpaceTemplate,
  importSpaces,
} from './api/workbench.js'
import {
  DEFAULT_STAFF_IDENTITY,
  DEFAULT_USER_IDENTITY,
  STAFF_ROLE_LABELS,
  USER_IDENTITIES,
  applyPeopleClientFilter,
  createPerson,
  dash,
  downloadPeopleTemplate,
  importPeople,
  isProjectUserIdentity,
  isValidPhone,
  listPeople,
  peopleImportSuccessCount,
  peopleIoApiMessage,
  personApiMessage,
  preferredSpaceDisplay,
  scopeFromTab,
  staffRoleLabel,
  toPersonRecord,
  updatePerson,
} from './api/people.js'
import { buildAnyNodeTreePicker, buildParentTreePicker, initTreePicker } from './ui/space-tree-picker.js'
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
  clearSelectedSpaceId()
  clearPeopleListCache()
  const portal = document.getElementById('portal')
  if (portal) portal.innerHTML = ''
  toast('正在切换项目…')
  try {
    await refresh()
    if (current === 'spaces') {
      await loadSpacesData()
    }
    if (current === 'people') {
      await loadPeopleList()
    }
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

async function loadSpacesData() {
  try {
    const result = await getSpaces(getSnapshot()?.projectId, true)
    const tree = result
    const listResult = await getSpaces(getSnapshot()?.projectId, false)
    const list = Array.isArray(listResult) ? listResult : []
    setSpacesCache({ tree, list })
  } catch (e) {
    console.error('Failed to load spaces:', e)
    setSpacesCache({ tree: { name: '当前项目', children: [] }, list: [] })
  }
}

function findPerson(id) {
  const cached = getPeopleListCache()?.items?.find((p) => p.id === id)
  if (cached) return cached
  const rec = records('people').find((p) => p.id === id)
  return rec ? toPersonRecord(rec) : null
}

async function loadPeopleList({ silent = false } = {}) {
  const tab = getPeopleTab()
  const scope = scopeFromTab(tab)
  const filter = getPeopleFilterState()
  try {
    const result = await listPeople({
      scope,
      q: filter.keyword,
      identity: filter.identity,
    })
    setPeopleListCache({ items: result.items, source: 'api', error: null })
    return result
  } catch (e) {
    const fallback = applyPeopleClientFilter(
      records('people').map(toPersonRecord).filter(Boolean),
      { scope, keyword: filter.keyword, identity: filter.identity },
    )
    setPeopleListCache({ items: fallback, source: 'bootstrap', error: e })
    if (!silent) toast(personApiMessage(e, '人员列表 GET'))
    return null
  }
}

function personForm(rec, scope, spaces = []) {
  const name = rec?.title || rec?.values?.name || ''
  const phone = rec?.values?.phone || ''
  if (scope === 'users') {
    const current = USER_IDENTITIES.includes(rec?.values?.identity)
      ? rec.values.identity
      : DEFAULT_USER_IDENTITY
    const opts = USER_IDENTITIES.map(
      (i) => `<option${i === current ? ' selected' : ''}>${esc(i)}</option>`,
    ).join('')
    return `<div class="form-grid">
      <div class="form-row"><label>* 姓名</label><input id="f-name" value="${esc(name)}" placeholder="请输入姓名"></div>
      <div class="form-row"><label>* 手机号</label><input id="f-phone" value="${esc(phone)}" placeholder="11 位手机号" maxlength="11"></div>
      <div class="form-row"><label>项目用户类型</label><select id="f-identity">${opts}</select></div>
      <div class="form-row full"><label>常用空间</label>
        <div class="tree-picker-container" id="preferred-space-picker">${buildAnyNodeTreePicker(spaces, rec?.values?.spaceId || '')}</div>
        <input type="hidden" id="f-space" value="${esc(rec?.values?.spaceId || '')}">
      </div>
    </div>`
  }
  const currentLabel = staffRoleLabel(rec?.values?.identity) || DEFAULT_STAFF_IDENTITY
  const selected = STAFF_ROLE_LABELS.includes(currentLabel) ? currentLabel : DEFAULT_STAFF_IDENTITY
  const opts = STAFF_ROLE_LABELS.map(
    (i) => `<option${i === selected ? ' selected' : ''}>${esc(i)}</option>`,
  ).join('')
  const employeeNo = rec?.values?.employeeNo || rec?.id || ''
  return `<div class="form-grid">
    <div class="form-row"><label>* 姓名</label><input id="f-name" value="${esc(name)}" placeholder="请输入姓名"></div>
    <div class="form-row"><label>* 手机号</label><input id="f-phone" value="${esc(phone)}" placeholder="11 位手机号" maxlength="11"></div>
    <div class="form-row"><label>员工编号</label><input id="f-employee-no" value="${esc(employeeNo)}" readonly placeholder="保存后返回 id"></div>
    <div class="form-row"><label>* 部门/班组</label><input id="f-team" value="${esc(rec?.values?.teamName || '')}" placeholder="请输入部门/班组"></div>
    <div class="form-row"><label>项目角色</label><select id="f-identity">${opts}</select></div>
  </div>`
}

function bindPreferredSpacePicker(selectedId = '') {
  const picker = initTreePicker('preferred-space-picker', (spaceId) => {
    const input = document.getElementById('f-space')
    if (input) input.value = spaceId || ''
  })
  picker?.setSelectedId(selectedId || '')
}

async function openPersonModal(rec, scope) {
  let spaces = []
  if (scope === 'users') {
    await loadSpacesData()
    spaces = getSpacesCache()?.list || []
  }
  const isNew = !rec
  modal(
    scope === 'staff' ? (isNew ? '新增员工' : '编辑员工') : isNew ? '新增项目用户' : '编辑项目用户',
    personForm(rec, scope, spaces),
    `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-person"${rec ? ` data-id="${esc(rec.id)}"` : ''} data-scope="${scope}">保存</button>`,
  )
  if (scope === 'users') {
    setTimeout(() => bindPreferredSpacePicker(rec?.values?.spaceId || ''), 0)
  }
}

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
  const pageEl = document.getElementById('page')
  if (scopebar) scopebar.style.display = current === 'projects' ? 'none' : ''
  if (pageEl) pageEl.classList.toggle('full-radius', current === 'projects')
  
  // Initialize project filters if on projects page
  if (current === 'projects') {
    setTimeout(() => initProjectFilters(), 0)
  }
  
  // Load spaces data if on spaces page
  if (current === 'spaces') {
    setTimeout(() => {
      void loadSpacesData().then(() => {
        document.getElementById('page').innerHTML = renderers[current]()
      })
    }, 0)
  }

  if (current === 'people' && !getPeopleListCache()) {
    setTimeout(() => {
      void loadPeopleList().then(() => {
        if (current === 'people') document.getElementById('page').innerHTML = renderers[current]()
      })
    }, 0)
  }
  
  window.scrollTo(0, 0)
}

function nav(p) {
  if (!pages[p]) return
  document.getElementById('portal').innerHTML = ''
  document.querySelectorAll('.menu-pop').forEach((x) => x.remove())
  
  // Clear space filter when leaving spaces page
  if (current === 'spaces' && p !== 'spaces') {
    clearSelectedSpaceId()
  }
  
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
    
    // Reload spaces if on spaces page
    if (current === 'spaces') {
      await loadSpacesData()
    }
    if (current === 'people') {
      await loadPeopleList({ silent: true })
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

// Cascader component for province-city-district selection
function createCascader(id, initialValue = { province: '', city: '', district: '' }, requireDistrict = true) {
  const placeholder = requireDistrict ? '请选择省市区' : '选择省份 / 城市 / 区县'
  const displayText = initialValue.province 
    ? [initialValue.province, initialValue.city, initialValue.district].filter(Boolean).join(' / ')
    : ''
  
  return `<div class="cascader-wrap" id="${id}-wrap">
    <div class="cascader-input ${displayText ? '' : 'placeholder'}" id="${id}-input" tabindex="0">
      <span id="${id}-display">${displayText || placeholder}</span>
    </div>
    <span class="cascader-arrow">▼</span>
    <div class="cascader-panel" id="${id}-panel"></div>
    <input type="hidden" id="${id}-province" value="${initialValue.province || ''}">
    <input type="hidden" id="${id}-city" value="${initialValue.city || ''}">
    <input type="hidden" id="${id}-district" value="${initialValue.district || ''}">
  </div>`
}

function initCascader(id, requireDistrict = true) {
  const input = document.getElementById(`${id}-input`)
  const panel = document.getElementById(`${id}-panel`)
  const display = document.getElementById(`${id}-display`)
  const provinceInput = document.getElementById(`${id}-province`)
  const cityInput = document.getElementById(`${id}-city`)
  const districtInput = document.getElementById(`${id}-district`)
  const arrow = input?.parentElement?.querySelector('.cascader-arrow')
  
  if (!input || !panel) return
  
  let selectedProvince = provinceInput?.value || ''
  let selectedCity = cityInput?.value || ''
  let selectedDistrict = districtInput?.value || ''
  let hoverProvince = ''
  let hoverCity = ''
  let hoverTimeout = null
  
  function updateDisplay() {
    const parts = [selectedProvince, selectedCity, selectedDistrict].filter(Boolean)
    if (parts.length > 0) {
      display.textContent = parts.join(' / ')
      input.classList.remove('placeholder')
    } else {
      display.textContent = requireDistrict ? '请选择省市区' : '选择省份 / 城市 / 区县'
      input.classList.add('placeholder')
    }
    if (provinceInput) provinceInput.value = selectedProvince
    if (cityInput) cityInput.value = selectedCity
    if (districtInput) districtInput.value = selectedDistrict
  }
  
  function closePanel() {
    panel.classList.remove('open')
    if (arrow) arrow.classList.remove('open')
  }
  
  function renderProvinceColumn() {
    let html = '<div class="cascader-column" data-column="province">'
    CHINA_PCA.forEach(prov => {
      const isSelected = prov.name === selectedProvince
      const isHovered = prov.name === (hoverProvince || selectedProvince)
      html += `<div class="cascader-item ${isSelected ? 'selected' : ''} ${isHovered && !isSelected ? 'hovered' : ''}" data-level="province" data-value="${esc(prov.name)}">${esc(prov.name)}</div>`
    })
    html += '</div>'
    return html
  }
  
  function renderCityColumn(provinceName) {
    if (!provinceName) return ''
    const province = CHINA_PCA.find(p => p.name === provinceName)
    if (!province) return ''
    
    let html = '<div class="cascader-column" data-column="city">'
    province.cities.forEach(city => {
      const isSelected = city.name === selectedCity && provinceName === selectedProvince
      const isHovered = city.name === (hoverCity || selectedCity) && provinceName === hoverProvince
      html += `<div class="cascader-item ${isSelected ? 'selected' : ''} ${isHovered && !isSelected ? 'hovered' : ''}" data-level="city" data-value="${esc(city.name)}">${esc(city.name)}</div>`
    })
    html += '</div>'
    return html
  }
  
  function renderDistrictColumn(provinceName, cityName) {
    if (!provinceName || !cityName) return ''
    const province = CHINA_PCA.find(p => p.name === provinceName)
    if (!province) return ''
    const city = province.cities.find(c => c.name === cityName)
    if (!city) return ''
    
    let html = '<div class="cascader-column" data-column="district">'
    city.districts.forEach(district => {
      const isSelected = district === selectedDistrict && cityName === selectedCity && provinceName === selectedProvince
      html += `<div class="cascader-item ${isSelected ? 'selected' : ''}" data-level="district" data-value="${esc(district)}">${esc(district)}</div>`
    })
    html += '</div>'
    return html
  }
  
  function renderPanel(useHoverProvince = '', useHoverCity = '') {
    const displayProvince = useHoverProvince || selectedProvince
    const displayCity = useHoverCity || selectedCity
    
    const columns = panel.querySelectorAll('.cascader-column')
    const existingProvinceCol = columns[0]?.dataset.column === 'province' ? columns[0] : null
    const existingCityCol = columns[1]?.dataset.column === 'city' ? columns[1] : null
    const existingDistrictCol = columns[2]?.dataset.column === 'district' ? columns[2] : null
    
    // Initial render: build all columns
    if (!existingProvinceCol) {
      let html = renderProvinceColumn()
      html += renderCityColumn(displayProvince)
      html += renderDistrictColumn(displayProvince, displayCity)
      panel.innerHTML = html
      return
    }
    
    // Incremental update: only rebuild changed columns
    // Update province column items (highlight only, no rebuild to preserve scroll)
    if (existingProvinceCol) {
      existingProvinceCol.querySelectorAll('.cascader-item').forEach(item => {
        const provName = item.dataset.value
        const isSelected = provName === selectedProvince
        const isHovered = provName === displayProvince
        item.className = `cascader-item ${isSelected ? 'selected' : ''} ${isHovered && !isSelected ? 'hovered' : ''}`
      })
    }
    
    // Rebuild city column if province changed
    const lastDisplayedProvince = existingCityCol?.dataset.province
    if (displayProvince && displayProvince !== lastDisplayedProvince) {
      const cityHtml = renderCityColumn(displayProvince)
      if (existingCityCol) {
        existingCityCol.outerHTML = cityHtml
      } else {
        existingProvinceCol.insertAdjacentHTML('afterend', cityHtml)
      }
      const newCityCol = panel.querySelector('[data-column="city"]')
      if (newCityCol) newCityCol.dataset.province = displayProvince
      
      // Remove district column when city column changes
      const districtCol = panel.querySelector('[data-column="district"]')
      if (districtCol) districtCol.remove()
    } else if (!displayProvince && existingCityCol) {
      // Remove city and district if no province
      existingCityCol.remove()
      if (existingDistrictCol) existingDistrictCol.remove()
    } else if (existingCityCol && displayProvince) {
      // Update city column items (highlight only, preserve scroll)
      existingCityCol.querySelectorAll('.cascader-item').forEach(item => {
        const cityName = item.dataset.value
        const isSelected = cityName === selectedCity && displayProvince === selectedProvince
        const isHovered = cityName === displayCity && displayProvince === hoverProvince
        item.className = `cascader-item ${isSelected ? 'selected' : ''} ${isHovered && !isSelected ? 'hovered' : ''}`
      })
    }
    
    // Rebuild district column if city changed
    const currentCityCol = panel.querySelector('[data-column="city"]')
    const lastDisplayedCity = currentCityCol?.dataset.city
    if (displayProvince && displayCity && displayCity !== lastDisplayedCity) {
      const districtHtml = renderDistrictColumn(displayProvince, displayCity)
      const currentDistrictCol = panel.querySelector('[data-column="district"]')
      if (currentDistrictCol) {
        currentDistrictCol.outerHTML = districtHtml
      } else if (currentCityCol) {
        currentCityCol.insertAdjacentHTML('afterend', districtHtml)
      }
      const newDistrictCol = panel.querySelector('[data-column="district"]')
      if (newDistrictCol) newDistrictCol.dataset.city = displayCity
    } else if (displayProvince && !displayCity) {
      // Remove district if no city
      const districtCol = panel.querySelector('[data-column="district"]')
      if (districtCol) districtCol.remove()
    } else if (existingDistrictCol && displayProvince && displayCity) {
      // Update district column items (highlight only)
      existingDistrictCol.querySelectorAll('.cascader-item').forEach(item => {
        const districtName = item.dataset.value
        const isSelected = districtName === selectedDistrict && displayCity === selectedCity && displayProvince === selectedProvince
        item.className = `cascader-item ${isSelected ? 'selected' : ''}`
      })
    }
  }
  
  function openPanel() {
    hoverProvince = ''
    hoverCity = ''
    renderPanel()
    panel.classList.add('open')
    if (arrow) arrow.classList.add('open')
  }
  
  input.addEventListener('click', (e) => {
    e.stopPropagation()
    if (panel.classList.contains('open')) {
      closePanel()
    } else {
      openPanel()
    }
  })
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (panel.classList.contains('open')) {
        closePanel()
      } else {
        openPanel()
      }
    }
  })
  
  // Hover to reveal next level
  panel.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.cascader-item')
    if (!item) return
    
    const level = item.dataset.level
    const value = item.dataset.value
    
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
    }
    
    hoverTimeout = setTimeout(() => {
      if (level === 'province') {
        hoverProvince = value
        hoverCity = ''
        renderPanel(hoverProvince, '')
      } else if (level === 'city') {
        hoverCity = value
        renderPanel(hoverProvince || selectedProvince, hoverCity)
      }
    }, 80)
  })
  
  // Click to select/confirm
  panel.addEventListener('click', (e) => {
    const item = e.target.closest('.cascader-item')
    if (!item) return
    
    const level = item.dataset.level
    const value = item.dataset.value
    
    if (level === 'province') {
      selectedProvince = value
      selectedCity = ''
      selectedDistrict = ''
      hoverProvince = value
      hoverCity = ''
      updateDisplay()
      renderPanel(hoverProvince, '')
    } else if (level === 'city') {
      if (hoverProvince) {
        selectedProvince = hoverProvince
      }
      selectedCity = value
      selectedDistrict = ''
      hoverCity = value
      updateDisplay()
      renderPanel(hoverProvince || selectedProvince, hoverCity)
    } else if (level === 'district') {
      if (hoverProvince) {
        selectedProvince = hoverProvince
      }
      if (hoverCity) {
        selectedCity = hoverCity
      }
      selectedDistrict = value
      updateDisplay()
      setTimeout(() => closePanel(), 150)
    }
  })
  
  // Avoid stacking document click listeners - remove old handler if exists
  if (input._cascaderClickHandler) {
    document.removeEventListener('click', input._cascaderClickHandler)
  }
  
  const documentClickHandler = (e) => {
    if (!input.contains(e.target) && !panel.contains(e.target)) {
      closePanel()
    }
  }
  
  document.addEventListener('click', documentClickHandler)
  input._cascaderClickHandler = documentClickHandler
  
  // Initial render
  if (selectedProvince) {
    updateDisplay()
  }
}

function projectForm(rec) {
  const initialPCA = {
    province: rec?.values?.province || '',
    city: rec?.values?.city || '',
    district: rec?.values?.district || ''
  }
  
  return `<form id="demoForm">
    <div class="form-grid">
      <div class="form-row">
        <label>* 项目名称</label>
        <input id="f-title" required placeholder="例如：云栖雅苑" value="${rec ? esc(rec.title) : ''}">
      </div>
      <div class="form-row full">
        <label>* 省市区</label>
        ${createCascader('f-pca', initialPCA, true)}
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


// Helper function to initialize project page filters
function initProjectFilters() {
  const keywordInput = document.getElementById('keyword')
  const statusSelect = document.getElementById('status-select')
  const businessTypeSelect = document.getElementById('businessType-select')
  
  if (keywordInput) keywordInput.value = currentFilterState.keyword
  if (statusSelect) statusSelect.value = currentFilterState.status
  if (businessTypeSelect) businessTypeSelect.value = currentFilterState.businessType
  
  // Initialize cascader with current filter state
  const initialPCA = {
    province: currentFilterState.province || '',
    city: currentFilterState.city || '',
    district: currentFilterState.district || ''
  }
  
  // Set the hidden inputs to current state
  const provinceInput = document.getElementById('filter-pca-province')
  const cityInput = document.getElementById('filter-pca-city')
  const districtInput = document.getElementById('filter-pca-district')
  const display = document.getElementById('filter-pca-display')
  const input = document.getElementById('filter-pca-input')
  
  if (provinceInput && initialPCA.province) {
    const parts = [initialPCA.province, initialPCA.city, initialPCA.district].filter(Boolean)
    if (parts.length > 0 && display && input) {
      display.textContent = parts.join(' / ')
      input.classList.remove('placeholder')
    }
  }
  
  initCascader('filter-pca', false)
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
    if (act === 'select-role') {
      P.setSelectedRoleId(a.dataset.id)
      render()
      return
    }
    if (act === 'new-role' || act === 'edit-role') {
      toast('后续')
      return
    }
    if (act === 'query') {
      if (current === 'projects') {
        const keyword = document.getElementById('keyword')?.value?.trim() || ''
        const statusSelect = document.getElementById('status-select')?.value || ''
        const provinceSelect = document.getElementById('filter-pca-province')?.value || ''
        const citySelect = document.getElementById('filter-pca-city')?.value || ''
        const districtSelect = document.getElementById('filter-pca-district')?.value || ''
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
      } else if (current === 'spaces') {
        const typeSelect = document.getElementById('type-select')?.value || '全部'
        const statusSelect = document.getElementById('status-select')?.value || '全部'
        const keyword = document.getElementById('keyword')?.value?.trim() || ''
        setSpacesFilterState(keyword, typeSelect, statusSelect)
        render()
        toast('筛选条件已应用')
      } else if (current === 'people') {
        const keyword = document.getElementById('keyword')?.value?.trim() || ''
        const identity = document.getElementById('people-identity-select')?.value || ''
        setPeopleFilterState(keyword, identity)
        const result = await loadPeopleList()
        render()
        if (result) toast(`已加载 ${applyPeopleClientFilter(result.items, { scope: scopeFromTab(getPeopleTab()), keyword, identity }).length} 位`)
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
      
      // Reset cascader (only for projects page)
      if (current === 'projects') {
        const pcaProvince = document.getElementById('filter-pca-province')
        const pcaCity = document.getElementById('filter-pca-city')
        const pcaDistrict = document.getElementById('filter-pca-district')
        const pcaDisplay = document.getElementById('filter-pca-display')
        const pcaInput = document.getElementById('filter-pca-input')
        if (pcaProvince) pcaProvince.value = ''
        if (pcaCity) pcaCity.value = ''
        if (pcaDistrict) pcaDistrict.value = ''
        if (pcaDisplay) pcaDisplay.textContent = '选择省份 / 城市 / 区县'
        if (pcaInput) pcaInput.classList.add('placeholder')
        
        // Reset filter state
        currentFilterState = {
          keyword: '',
          status: '全部状态',
          province: '',
          city: '',
          district: '',
          businessType: '全部业态'
        }
        
        clearFilteredProjects()
        clearProjectsFilterState()
        render()
      } else if (current === 'spaces') {
        clearSpacesFilterState()
        render()
      } else if (current === 'people') {
        clearPeopleFilterState()
        await loadPeopleList({ silent: true })
        render()
      }
      toast('筛选条件已重置')
      return
    }
    if (act === 'refresh-bootstrap') {
      await refresh()
      await fillProjects()
      if (current === 'people') await loadPeopleList({ silent: true })
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
      setTimeout(() => initCascader('f-pca', true), 0)
      return
    }
    if (act === 'project-edit') {
      const id = a.dataset.id
      const rec = records('projects').find((x) => x.id === id)
      if (!rec) return toast('未找到项目')
      modal('编辑项目', projectForm(rec), `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-project" data-id="${id}">保存</button>`)
      setTimeout(() => initCascader('f-pca', true), 0)
      return
    }
    if (act === 'save-project') {
      const title = document.getElementById('f-title')?.value?.trim()
      const province = document.getElementById('f-pca-province')?.value?.trim() || ''
      const city = document.getElementById('f-pca-city')?.value?.trim() || ''
      const district = document.getElementById('f-pca-district')?.value?.trim() || ''
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
      const pcaPath = [rec.values?.province, rec.values?.city, rec.values?.district].filter(Boolean).join(' / ') || '—'
      const longitude = rec.values?.longitude ? String(rec.values.longitude) : '—'
      const latitude = rec.values?.latitude ? String(rec.values.latitude) : '—'
      drawer(
        `${rec.title} · 项目详情`,
        `<div class="actions">${badge(rec.status, 'ok')}<span class="muted">${rec.id}</span></div><div class="kv" style="margin-top:15px"><div style="grid-column:1/-1"><span>省市区</span><b>${pcaPath}</b></div><div style="grid-column:1/-1"><span>详细地址</span><b>${rec.values?.address || '—'}</b></div><div><span>业态</span><b>${rec.values?.businessType || '—'}</b></div><div><span>管理员</span><b>${rec.values?.manager || '—'}</b></div><div><span>电话</span><b>${rec.values?.phone || '—'}</b></div><div><span>经度</span><b>${longitude}</b></div><div><span>纬度</span><b>${latitude}</b></div></div>`,
      )
      return
    }
    if (act === 'new-space') {
      const cache = getSpacesCache()
      const spaces = cache?.list || []
      const parentTreeHtml = buildParentTreePicker(spaces, null, null)
      
      modal(
        '新增空间',
        `<div class="form-grid">
          <div class="form-row">
            <label>* 空间名称</label>
            <input id="f-name" placeholder="例如：A栋" required>
          </div>
          <div class="form-row">
            <label>* 空间类型</label>
            <select id="f-type" required>
              <option value="楼栋">楼栋</option>
              <option value="楼层">楼层</option>
              <option value="房间">房间</option>
              <option value="公区">公区</option>
              <option value="车位">车位</option>
            </select>
          </div>
          <div class="form-row">
            <label>* 状态</label>
            <select id="f-status">
              <option value="可用">可用</option>
              <option value="停用">停用</option>
            </select>
          </div>
          <div class="form-row full">
            <label>上级空间</label>
            <div class="tree-picker-container" id="parent-picker-container">
              ${parentTreeHtml}
            </div>
            <input type="hidden" id="f-parent" value="">
          </div>
        </div>`,
        `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-space">保存</button>`,
      )
      
      setTimeout(() => {
        initTreePicker('parent-picker-container', (spaceId) => {
          document.getElementById('f-parent').value = spaceId
        })
      }, 0)
      return
    }
    if (act === 'save-space') {
      const name = document.getElementById('f-name')?.value?.trim()
      const type = document.getElementById('f-type')?.value
      const status = document.getElementById('f-status')?.value
      const parentId = document.getElementById('f-parent')?.value || undefined
      
      if (!name) return toast('请填写空间名称')
      if (!type) return toast('请选择空间类型')
      
      const data = { name, type, status: status || '可用' }
      if (parentId) data.parentId = parentId
      
      const spaceId = a.dataset.id
      if (spaceId) {
        await updateSpace(spaceId, data)
        await afterWrite('空间已更新')
      } else {
        await createSpace(data)
        await afterWrite('空间已创建')
      }
      return
    }
    if (act === 'space-edit') {
      const cache = getSpacesCache()
      const spaces = cache?.list || []
      const space = spaces.find((x) => x.id === a.dataset.id)
      if (!space) return toast('未找到空间')
      
      const parentTreeHtml = buildParentTreePicker(spaces, space.id, space.parentId || '')
      
      modal(
        '编辑空间',
        `<div class="form-grid">
          <div class="form-row">
            <label>* 空间名称</label>
            <input id="f-name" value="${esc(space.name)}" required>
          </div>
          <div class="form-row">
            <label>* 空间类型</label>
            <select id="f-type" required>
              <option value="楼栋" ${space.type === '楼栋' ? 'selected' : ''}>楼栋</option>
              <option value="楼层" ${space.type === '楼层' ? 'selected' : ''}>楼层</option>
              <option value="房间" ${space.type === '房间' ? 'selected' : ''}>房间</option>
              <option value="公区" ${space.type === '公区' ? 'selected' : ''}>公区</option>
              <option value="车位" ${space.type === '车位' ? 'selected' : ''}>车位</option>
            </select>
          </div>
          <div class="form-row">
            <label>* 状态</label>
            <select id="f-status">
              <option value="可用" ${space.status === '可用' ? 'selected' : ''}>可用</option>
              <option value="停用" ${space.status === '停用' ? 'selected' : ''}>停用</option>
            </select>
          </div>
          <div class="form-row full">
            <label>上级空间</label>
            <div class="tree-picker-container" id="parent-picker-container">
              ${parentTreeHtml}
            </div>
            <input type="hidden" id="f-parent" value="${esc(space.parentId || '')}">
          </div>
        </div>`,
        `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-space" data-id="${esc(space.id)}">保存</button>`,
      )
      
      setTimeout(() => {
        const picker = initTreePicker('parent-picker-container', (spaceId) => {
          document.getElementById('f-parent').value = spaceId
        })
        if (space.parentId) {
          picker.setSelectedId(space.parentId)
        } else {
          picker.setSelectedId('')
        }
      }, 0)
      return
    }
    if (act === 'space-delete') {
      const cache = getSpacesCache()
      const spaces = cache?.list || []
      const space = spaces.find((x) => x.id === a.dataset.id)
      if (!space) return toast('未找到空间')
      
      modal(
        '删除空间',
        `<div class="health"><b>确认删除 ${esc(space.name)} ？</b><p class="sub">删除后不可恢复。如果该空间下存在子空间，将无法删除。</p></div>`,
        `<button class="btn" data-action="close">取消</button><button class="btn danger" data-action="confirm-delete-space" data-id="${esc(space.id)}">确认删除</button>`,
      )
      return
    }
    if (act === 'confirm-delete-space') {
      try {
        await deleteSpace(a.dataset.id)
        await afterWrite('空间已删除')
      } catch (err) {
        const message = err?.message || '删除失败'
        toast(message)
      }
      return
    }
    if (act === 'download-space-template') {
      try {
        await downloadSpaceTemplate()
        toast('模板已下载')
      } catch (err) {
        toast(err?.message || '下载失败')
      }
      return
    }
    if (act === 'import-spaces') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.xlsx'
      input.onchange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        
        modal(
          '导入空间',
          `<div class="health"><b>确认导入空间数据？</b><p class="sub">文件：${esc(file.name)}<br>导入失败时不会写入数据库</p></div>`,
          `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="confirm-import-spaces">确认导入</button>`,
        )
        
        // Store file in a temporary place for the confirm action
        window._importSpaceFile = file
      }
      input.click()
      return
    }
    if (act === 'confirm-import-spaces') {
      const file = window._importSpaceFile
      delete window._importSpaceFile
      
      if (!file) {
        toast('未选择文件')
        return
      }
      
      try {
        document.getElementById('portal').innerHTML = '<div class="overlay"><div class="modal"><div class="modal-body"><p>正在导入，请稍候...</p></div></div></div>'
        const result = await importSpaces(file)
        await afterWrite(`成功导入 ${result.imported || 0} 个空间`)
      } catch (err) {
        document.getElementById('portal').innerHTML = ''
        const message = err?.message || '导入失败'
        modal(
          '导入失败',
          `<div class="health"><b>数据验证失败</b><p class="sub" style="white-space: pre-wrap; max-height: 300px; overflow-y: auto;">${esc(message)}</p></div>`,
          `<button class="btn primary" data-action="close">关闭</button>`,
        )
      }
      return
    }
    if (act === 'space-detail') {
      const cache = getSpacesCache()
      const spaces = cache?.list || []
      const space = spaces.find((x) => x.id === a.dataset.id)
      if (!space) return toast('未找到空间')
      
      const buildPath = (s) => {
        if (!s.parentId) return s.name
        const parent = spaces.find(p => p.id === s.parentId)
        if (!parent) return s.name
        return buildPath(parent) + ' / ' + s.name
      }
      
      const fullPath = buildPath(space)
      const parentName = space.parentId ? (spaces.find(p => p.id === space.parentId)?.name || '—') : '无'
      const updatedAt = space.updatedAt ? new Date(space.updatedAt).toLocaleString('zh-CN') : space.createdAt ? new Date(space.createdAt).toLocaleString('zh-CN') : '—'
      const statusBadge = space.status === '可用' ? badge('可用', 'ok') : badge('停用', 'neutral')
      
      drawer(
        `${space.name} · 空间详情`,
        `<div class="actions">${statusBadge}<span class="muted">${esc(space.id)}</span></div>
        <div class="kv" style="margin-top:15px">
          <div><span>名称</span><b>${esc(space.name)}</b></div>
          <div><span>类型</span><b>${esc(space.type)}</b></div>
          <div style="grid-column:1/-1"><span>完整路径</span><b>${esc(fullPath)}</b></div>
          <div><span>上级空间</span><b>${esc(parentName)}</b></div>
          <div><span>状态</span><b>${esc(space.status)}</b></div>
          <div style="grid-column:1/-1"><span>更新时间</span><b>${updatedAt}</b></div>
        </div>`,
      )
      return
    }
    if (act === 'select-space-node') {
      const spaceId = a.dataset.spaceId
      const isRoot = a.dataset.isRoot === 'true'
      
      if (isRoot || spaceId === 'root') {
        clearSelectedSpaceId()
      } else {
        setSelectedSpaceId(spaceId)
      }
      
      render()
      return
    }
    if (act === 'download-people-template') {
      const scope =
        a.dataset.scope === 'users' || a.dataset.scope === 'staff'
          ? a.dataset.scope
          : scopeFromTab(getPeopleTab())
      try {
        await downloadPeopleTemplate({ scope })
        toast('模板已下载')
      } catch (err) {
        toast(peopleIoApiMessage(err, '下载模板'))
      }
      return
    }
    if (act === 'import-people') {
      const scope =
        a.dataset.scope === 'users' || a.dataset.scope === 'staff'
          ? a.dataset.scope
          : scopeFromTab(getPeopleTab())
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.xlsx'
      input.onchange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!String(file.name || '').toLowerCase().endsWith('.xlsx')) {
          toast('仅支持 xlsx 文件')
          return
        }
        const label = scope === 'staff' ? '员工' : '项目用户'
        modal(
          `导入${label}`,
          `<div class="health"><b>确认导入${label}数据？</b><p class="sub">文件：${esc(file.name)}<br>仅支持 xlsx；导入失败时不会写入数据库</p></div>`,
          `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="confirm-import-people" data-scope="${scope}">确认导入</button>`,
        )
        window._importPeopleFile = file
        window._importPeopleScope = scope
      }
      input.click()
      return
    }
    if (act === 'confirm-import-people') {
      const file = window._importPeopleFile
      const scope =
        a.dataset.scope === 'users' || a.dataset.scope === 'staff'
          ? a.dataset.scope
          : window._importPeopleScope || scopeFromTab(getPeopleTab())
      delete window._importPeopleFile
      delete window._importPeopleScope

      if (!file) {
        toast('未选择文件')
        return
      }

      try {
        document.getElementById('portal').innerHTML =
          '<div class="overlay"><div class="modal"><div class="modal-body"><p>正在导入，请稍候...</p></div></div></div>'
        const result = await importPeople(file, { scope })
        const count = peopleImportSuccessCount(result)
        const label = scope === 'staff' ? '员工' : '项目用户'
        await afterWrite(`成功导入 ${count} 位${label}`)
      } catch (err) {
        document.getElementById('portal').innerHTML = ''
        if (err?.status === 404) {
          toast(peopleIoApiMessage(err, '人员导入'))
          return
        }
        const message = err?.message || '导入失败'
        modal(
          '导入失败',
          `<div class="health"><b>数据验证失败</b><p class="sub" style="white-space: pre-wrap; max-height: 300px; overflow-y: auto;">${esc(message)}</p></div>`,
          `<button class="btn primary" data-action="close">关闭</button>`,
        )
      }
      return
    }
    if (act === 'people-tab') {
      setPeopleTab(a.dataset.tab === 'staff' ? 'staff' : 'projectUsers')
      clearPeopleListCache()
      await loadPeopleList({ silent: true })
      render()
      return
    }
    if (act === 'new-person') {
      const scope = scopeFromTab(getPeopleTab())
      await openPersonModal(null, scope)
      return
    }
    if (act === 'person-edit') {
      const rec = findPerson(a.dataset.id)
      if (!rec) return toast('未找到人员')
      const scope = isProjectUserIdentity(rec.values?.identity) ? 'users' : 'staff'
      await openPersonModal(rec, scope)
      return
    }
    if (act === 'person-detail') {
      const rec = findPerson(a.dataset.id)
      if (!rec) return toast('未找到人员')
      const isUser = isProjectUserIdentity(rec.values?.identity)
      const fields = isUser
        ? `
          <div><span>姓名</span><b>${esc(dash(rec.title))}</b></div>
          <div><span>手机号</span><b>${esc(dash(rec.values?.phone))}</b></div>
          <div><span>项目用户类型</span><b>${esc(dash(rec.values?.identity))}</b></div>
          <div><span>常用空间</span><b>${esc(preferredSpaceDisplay(rec.values))}</b></div>
          <div><span>项目关系状态</span><b>${esc(dash(rec.values?.relationStatus))}</b></div>
          <div><span>关系来源</span><b>${esc(dash(rec.values?.relationSource))}</b></div>
          <div><span>更新时间</span><b>${esc(dash(rec.values?.updatedAt))}</b></div>`
        : `
          <div><span>姓名</span><b>${esc(dash(rec.title))}</b></div>
          <div><span>手机号</span><b>${esc(dash(rec.values?.phone))}</b></div>
          <div><span>员工编号</span><b>${esc(dash(rec.values?.employeeNo))}</b></div>
          <div><span>部门/班组</span><b>${esc(dash(rec.values?.teamName))}</b></div>
          <div><span>当前项目角色</span><b>${esc(dash(rec.values?.roleName || staffRoleLabel(rec.values?.identity)))}</b></div>
          <div><span>在线状态</span><b>${esc(dash(rec.values?.onlineStatus))}</b></div>
          <div><span>更新时间</span><b>${esc(dash(rec.values?.updatedAt))}</b></div>`
      drawer(
        `${esc(rec.title)} · ${isUser ? '项目用户' : '员工'}详情`,
        `<div class="actions">${badge(rec.status, String(rec.status).includes('停') ? 'neutral' : 'ok')}<span class="muted">${esc(rec.id)}</span></div>
        <div class="kv" style="margin-top:15px">${fields}</div>`,
      )
      return
    }
    if (act === 'save-person') {
      const scope = a.dataset.scope === 'users' ? 'users' : 'staff'
      const name = document.getElementById('f-name')?.value?.trim()
      const phone = document.getElementById('f-phone')?.value?.trim() || ''
      const identity =
        document.getElementById('f-identity')?.value?.trim() ||
        (scope === 'users' ? DEFAULT_USER_IDENTITY : DEFAULT_STAFF_IDENTITY)
      if (!name) return toast('请填写姓名')
      if (!isValidPhone(phone)) return toast('请填写 11 位手机号')
      const id = a.dataset.id
      try {
        if (scope === 'users') {
          // 树选：合法 id 绑定；未绑定显式 null 清空。启停走 updatePerson({ status }) 省略 spaceId 不改绑定。
          const spaceRaw = document.getElementById('f-space')?.value
          const spaceId = spaceRaw && String(spaceRaw).trim() ? String(spaceRaw).trim() : null
          if (id) {
            await updatePerson(id, { name, phone, identity, scope, spaceId })
            await afterWrite('项目用户已更新')
          } else {
            await createPerson({ name, phone, identity, scope, spaceId })
            await afterWrite('项目用户已创建')
          }
        } else {
          const teamName = document.getElementById('f-team')?.value?.trim() || ''
          if (!teamName) return toast('请填写部门/班组')
          if (id) {
            await updatePerson(id, { name, phone, identity, scope })
            await afterWrite('员工信息已更新')
          } else {
            await createPerson({ name, phone, identity, scope })
            await afterWrite('员工已创建')
          }
        }
      } catch (e) {
        toast(personApiMessage(e, id ? '编辑人员 PUT' : '新建人员 POST'))
      }
      return
    }
    if (act === 'person-toggle-status') {
      const id = a.dataset.id
      const status = a.dataset.status
      if (!id || !status) return toast('缺少启停参数')
      try {
        await updatePerson(id, { status })
        await afterWrite(status === '停用' ? '已停用' : '已启用')
      } catch (e) {
        toast(personApiMessage(e, '启停员工 PUT'))
      }
      return
    }
    if (['new-type', 'type-detail', 'new-field', 'new-rule', 'new-plan', 'new-agent-app'].includes(act)) {
      const collection =
        act.includes('type')
          ? 'types'
          : act.includes('field')
            ? 'fields'
            : act.includes('rule')
              ? 'dispatch'
              : act.includes('plan')
                ? 'plans'
                : null
      if (act.endsWith('-detail') || act === 'type-detail') {
        modal(a.textContent.trim() || '详情', `<p class="sub">记录详情（只读演示）。</p><div class="form-grid"><div class="form-row"><label>名称</label><input value="${a.dataset.id || ''}" disabled></div></div>`, `<button class="btn" data-action="close">关闭</button>`)
        return
      }
      modal(
        a.textContent.trim() || '新建',
        `<div class="form-grid"><div class="form-row"><label>名称</label><input id="f-title" placeholder="请输入名称"></div><div class="form-row"><label>说明</label><input id="f-sub" placeholder="可选"></div></div>`,
        `<button class="btn" data-action="close">取消</button><button class="btn primary" data-action="save-collection" data-collection="${collection || ''}">保存</button>`,
      )
      return
    }
    if (act === 'save-collection') {
      const title = document.getElementById('f-title')?.value?.trim()
      const subtitle = document.getElementById('f-sub')?.value?.trim() || ''
      const collection = a.dataset.collection || ''
      if (!title) return toast('请填写名称')
      if (collection === 'null' || !collection) return toast('暂不支持此创建')
      if (collection === 'people') {
        return toast('人员请走 POST /api/v1/people，不再使用 workbench collections')
      }
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
