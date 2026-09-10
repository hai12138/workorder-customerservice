import { describe, expect, it } from 'vitest'
import { buildAnyNodeTreePicker, buildParentTreePicker } from './space-tree-picker.js'

const spaces = [
  { id: 'bldg', name: 'A栋', parentId: null },
  { id: 'floor', name: '1层', parentId: 'bldg' },
  { id: 'room', name: '101', parentId: 'floor' },
]

describe('space tree picker variants', () => {
  it('parent picker disables current node and descendants, keeps 无上级', () => {
    const html = buildParentTreePicker(spaces, 'floor', 'bldg')
    expect(html).toContain('无上级（项目根节点）')
    expect(html).not.toContain('未绑定')
    expect(html).toMatch(/data-space-id="floor"[^>]*data-disabled="true"/)
    expect(html).toMatch(/data-space-id="room"[^>]*data-disabled="true"/)
    expect(html).toMatch(/data-space-id="bldg"[^>]*data-disabled="false"/)
    expect(html).toMatch(/class="tree-picker-item selected"[^>]*data-space-id="bldg"/)
  })

  it('any-node picker allows every level and can clear', () => {
    const html = buildAnyNodeTreePicker(spaces, 'room')
    expect(html).toContain('未绑定')
    expect(html).not.toContain('无上级（项目根节点）')
    expect(html).not.toContain('data-disabled="true"')
    expect(html).toContain('data-space-id="bldg"')
    expect(html).toContain('data-space-id="floor"')
    expect(html).toContain('data-space-id="room"')
    expect(html).toContain('data-space-id="room"')
    expect(html).toMatch(/data-parent-id="floor"[^>]*display: block/)
    expect(html).toMatch(/data-parent-id="bldg"[^>]*display: block/)
  })

  it('any-node empty tree still offers 未绑定', () => {
    const html = buildAnyNodeTreePicker([], null)
    expect(html).toContain('未绑定')
    expect(html).toContain('暂无可选空间')
    expect(html).toContain('no-parent selected')
  })
})
