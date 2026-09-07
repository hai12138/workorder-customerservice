/** In-memory workbench snapshot shared by page renderers. */

import { bootstrap as fetchBootstrap } from '../api/workbench.js'
import { getProjectId, setProjectId } from './session.js'

/** @type {import('../api/workbench.js') extends never ? any : any} */
let snapshot = null
let loading = null
let filteredProjects = null
let projectsFilterState = { keyword: '', status: '', province: '', city: '', district: '', businessType: '' }
let spacesFilterState = { keyword: '', status: '全部状态', type: '全部类型' }
let spacesCache = null
let selectedSpaceId = null

export function getSnapshot() {
  return snapshot
}

export function records(name) {
  if (name === 'projects' && filteredProjects !== null) {
    return filteredProjects
  }
  return snapshot?.records?.[name] ?? []
}

export function setFilteredProjects(projects) {
  filteredProjects = projects
}

export function clearFilteredProjects() {
  filteredProjects = null
}

export function getProjectsFilterState() {
  return projectsFilterState
}

export function setProjectsFilterState(keyword, status, province, city, district, businessType) {
  projectsFilterState = { keyword, status, province, city, district, businessType }
}

export function clearProjectsFilterState() {
  projectsFilterState = { keyword: '', status: '', province: '', city: '', district: '', businessType: '' }
}

export function getSpacesFilterState() {
  return spacesFilterState
}

export function setSpacesFilterState(keyword, status, type) {
  spacesFilterState = { keyword, status, type }
}

export function clearSpacesFilterState() {
  spacesFilterState = { keyword: '', status: '全部状态', type: '全部类型' }
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
  spacesCache = null
  return loadBootstrap(getProjectId() || undefined)
}

export function getSpacesCache() {
  return spacesCache
}

export function setSpacesCache(data) {
  spacesCache = data
}

export function getSelectedSpaceId() {
  return selectedSpaceId
}

export function setSelectedSpaceId(id) {
  selectedSpaceId = id
}

export function clearSelectedSpaceId() {
  selectedSpaceId = null
}
