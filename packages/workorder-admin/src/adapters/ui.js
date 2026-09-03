/** Shared HTML helpers matching prototype class names. */

export const badge = (t, c = '') => `<span class="badge ${c}">${t}</span>`
export const btn = (t, a = 'toast', c = '') =>
  `<button class="btn ${c}" data-action="${a}" data-message="${t}：操作已触发">${t}</button>`
export const head = (title, code, sub, actions = '') =>
  `<div class="page-head"><div><div class="eyebrow">物业客服 Web 端业务闭环</div><h1>${title}<span class="code">${code}</span></h1><p class="sub">${sub}</p></div><div class="actions">${actions}</div></div>`
export const filters = (search = '搜索名称或编号') =>
  `<div class="filters"><input id="keyword" placeholder="${search}"><select><option>全部状态</option><option>已启用</option><option>未启用</option></select><select><option>全部类型</option><option>住宅公寓</option><option>商业园区</option></select><button class="btn primary" data-action="query">查询</button><button class="btn" data-action="reset-filter">重置</button></div>`
export const table = (headers, rows) =>
  `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
export const footer = (n = '共 0 条') =>
  `<div class="table-footer"><span>${n}</span><div class="pager"><button>‹</button><button class="on">1</button><button>›</button></div></div>`

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function toneBadge(status, tone) {
  const map = { ok: 'ok', warning: 'warn', danger: 'bad', info: 'blue', neutral: '' }
  return badge(status, map[tone] || (status.includes('有效') || status.includes('启用') || status.includes('服务') ? 'ok' : status.includes('停') || status.includes('失败') ? 'bad' : 'warn'))
}
