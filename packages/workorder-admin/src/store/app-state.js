/** In-memory workbench snapshot shared by page renderers. */

import { bootstrap as fetchBootstrap } from '../api/workbench.js'
import { getProjectId, setProjectId } from './session.js'

/** @type {import('../api/workbench.js') extends never ? any : any} */
let snapshot = null
let loading = null

export function getSnapshot() {
  return snapshot
}

export function records(name) {
  return snapshot?.records?.[name] ?? []
}

export function projectId() {
  return snapshot?.projectId || getProjectId()
}

export function dashboard() {
  return snapshot?.dashboard ?? { metrics: [], attention: [] }
}

export function activities() {
  return snapshot?.activities ?? []
}

export async function loadBootstrap(forceProjectId) {
  if (loading) return loading
  loading = (async () => {
    const pid = forceProjectId || getProjectId()
    snapshot = await fetchBootstrap(pid || undefined)
    if (snapshot?.projectId) setProjectId(snapshot.projectId)
    return snapshot
  })()
  try {
    return await loading
  } finally {
    loading = null
  }
}

export async function refresh() {
  return loadBootstrap(getProjectId() || undefined)
}
