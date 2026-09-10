/**
 * 空间树选择器：上级空间（禁选自身及子孙）与常用空间（任意层级，可清空）共用。
 */
import { esc } from '../adapters/ui.js'

function containsId(node, id) {
  if (!id || !node) return false
  if (node.id === id) return true
  return (node.children || []).some((child) => containsId(child, id))
}

function descendantIdsOf(spaceMap, spaceId) {
  const ids = new Set([spaceId])
  const space = spaceMap.get(spaceId)
  if (space?.children) {
    space.children.forEach((child) => {
      descendantIdsOf(spaceMap, child.id).forEach((id) => ids.add(id))
    })
  }
  return ids
}

export function buildSpaceTreePicker(spaces, options = {}) {
  const selectedId = options.selectedId ?? ''
  const disableDescendantsOf = options.disableDescendantsOf || null
  const emptyLabel = options.emptyLabel ?? '未绑定'
  const showEmpty = options.showEmpty !== false
  const list = Array.isArray(spaces) ? spaces : []

  if (!list.length && !showEmpty) {
    return '<div class="tree-picker-empty">暂无可选空间</div>'
  }

  const spaceMap = new Map()
  list.forEach((s) => spaceMap.set(s.id, { ...s, children: [] }))

  const rootNodes = []
  list.forEach((s) => {
    const node = spaceMap.get(s.id)
    if (!s.parentId) {
      rootNodes.push(node)
    } else {
      const parent = spaceMap.get(s.parentId)
      if (parent) parent.children.push(node)
    }
  })

  const disabledIds = disableDescendantsOf ? descendantIdsOf(spaceMap, disableDescendantsOf) : new Set()

  const renderNode = (node, level = 1) => {
    const hasChildren = node.children && node.children.length > 0
    const isDisabled = disabledIds.has(node.id)
    const isSelected = node.id === selectedId
    const indent = (level - 1) * 20
    const expanded = Boolean(
      hasChildren && selectedId && node.children.some((child) => containsId(child, selectedId)),
    )

    const classes = ['tree-picker-item']
    if (isDisabled) classes.push('disabled')
    if (isSelected) classes.push('selected')
    let html = `<div class="${classes.join(' ')}" data-space-id="${esc(node.id)}" data-disabled="${isDisabled}" style="padding-left: ${indent}px">`
    if (hasChildren) {
      html += `<span class="tree-picker-expand" data-space-id="${esc(node.id)}">${expanded ? '▾' : '▸'}</span>`
    } else {
      html += `<span class="tree-picker-spacer"></span>`
    }
    html += `<span class="tree-picker-label">${esc(node.name)}</span></div>`
    if (hasChildren) {
      html += `<div class="tree-picker-children" data-parent-id="${esc(node.id)}" style="display: ${expanded ? 'block' : 'none'};">`
      node.children.forEach((child) => {
        html += renderNode(child, level + 1)
      })
      html += `</div>`
    }
    return html
  }

  let html = '<div class="tree-picker">'
  if (showEmpty) {
    const emptySelected = selectedId === '' || selectedId == null
    html += `<div class="tree-picker-item no-parent${emptySelected ? ' selected' : ''}" data-space-id="" data-disabled="false">
    <span class="tree-picker-spacer"></span>
    <span class="tree-picker-label">${esc(emptyLabel)}</span>
  </div>`
  }
  if (!rootNodes.length) {
    html += '<div class="tree-picker-empty">暂无可选空间</div>'
  } else {
    rootNodes.forEach((node) => {
      html += renderNode(node)
    })
  }
  html += '</div>'
  return html
}

/** 空间上级：禁选当前节点及其子孙；空选 = 项目根。 */
export function buildParentTreePicker(spaces, currentSpaceId = null, selectedParentId = null) {
  if (!spaces || spaces.length === 0) {
    return '<div class="tree-picker-empty">暂无可选空间</div>'
  }
  return buildSpaceTreePicker(spaces, {
    selectedId: selectedParentId ?? '',
    disableDescendantsOf: currentSpaceId,
    emptyLabel: '无上级（项目根节点）',
  })
}

/** 常用空间：当前项目任意层级可点；空选 = 未绑定。不禁选子孙。 */
export function buildAnyNodeTreePicker(spaces, selectedId = null) {
  return buildSpaceTreePicker(spaces, {
    selectedId: selectedId ?? '',
    disableDescendantsOf: null,
    emptyLabel: '未绑定',
  })
}

export function initTreePicker(containerId, onSelect) {
  const container = document.getElementById(containerId)
  if (!container) return

  let selectedId = null

  container.addEventListener('click', (e) => {
    const expandBtn = e.target.closest('.tree-picker-expand')
    if (expandBtn) {
      e.stopPropagation()
      const spaceId = expandBtn.dataset.spaceId
      const childrenDiv = container.querySelector(`.tree-picker-children[data-parent-id="${spaceId}"]`)
      if (childrenDiv) {
        const isExpanded = childrenDiv.style.display !== 'none'
        childrenDiv.style.display = isExpanded ? 'none' : 'block'
        expandBtn.textContent = isExpanded ? '▸' : '▾'
      }
      return
    }

    const item = e.target.closest('.tree-picker-item')
    if (item && item.dataset.disabled !== 'true') {
      const spaceId = item.dataset.spaceId
      container.querySelectorAll('.tree-picker-item').forEach((el) => {
        el.classList.remove('selected')
      })
      item.classList.add('selected')
      selectedId = spaceId
      if (onSelect) onSelect(spaceId)
    }
  })

  return {
    getSelectedId: () => selectedId,
    setSelectedId: (id) => {
      selectedId = id
      container.querySelectorAll('.tree-picker-item').forEach((el) => {
        el.classList.toggle('selected', el.dataset.spaceId === id)
      })
    },
  }
}
