import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./prototype-main.js', import.meta.url), 'utf8')
const shell = readFileSync(new URL('./prototype-shell.html', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./prototype.css', import.meta.url), 'utf8')
const main = readFileSync(new URL('./main.js', import.meta.url), 'utf8')
const authApi = readFileSync(new URL('./api/auth.js', import.meta.url), 'utf8')

const approvedPages = [
  'dashboard', 'projects', 'spaces', 'people', 'roles', 'config', 'types',
  'fields', 'flow', 'dispatch', 'plans', 'publish', 'notificationCenter',
  'notifications', 'wechatTemplates', 'channelBindings', 'deliveryRecords',
  'deliveryFailures', 'wechatSettings', 'agentOverview', 'mcpTools',
  'skillPackages', 'agentApps', 'agentPlayground', 'agentLogs', 'messages',
  'workorders', 'exceptions',
]

describe('approved prototype UI contract', () => {
  it('keeps every approved page renderer', () => {
    const registry = source.match(/const pages\s*=\s*\{([\s\S]+?)\n\}/)?.[1] ?? ''
    expect(approvedPages).toHaveLength(28)
    approvedPages.forEach((page) => {
      expect(registry).toContain(`${page}:`)
      expect(source).toMatch(
        new RegExp(
          `function\\s+${page === 'people' ? 'peopleView' : page === 'workorders' ? 'workordersView' : page}\\s*\\(`,
        ),
      )
    })
  })

  it('keeps the approved application shell', () => {
    expect(shell).toContain('class="topbar"')
    expect(shell).toContain('class="sidebar"')
    expect(shell).toContain('class="tab-strip"')
    expect(shell).toContain('id="projectSelect"')
    expect(shell).toContain('id="portal"')
  })

  it('keeps page-specific layouts instead of generic substitutes', () => {
    ;[
      '.field-builder', '.role-layout', '.flow-track', '.sla-grid',
      '.notify-hero', '.notification-layout', '.phone-preview',
      '.agent-hero', '.architecture', '.playground', '.release-track',
      '.dialog-tabs', '.drawer-wrap', '.login-page',
    ].forEach((selector) => expect(styles).toContain(selector))
  })

  it('keeps critical dialog and workflow interactions', () => {
    ;[
      'flow-node-edit', 'wechat-preview', 'template-mapping',
      'binding-detail', 'delivery-detail', 'publish-agent-capability',
      'mcp-tool-detail', 'run-agent-demo', 'confirm-agent-submit',
      'agent-log-detail',
    ].forEach((action) => expect(source).toContain(`'${action}'`))
  })

  it('keeps real login gate as the frontend entry', () => {
    expect(main).toContain('renderLogin')
    expect(main).toContain("import('./prototype-main.js')")
    expect(main).toContain('loadBootstrap')
    expect(authApi).toContain('/auth/login')
    expect(source).toContain("data-action=\"logout\"")
  })
})
