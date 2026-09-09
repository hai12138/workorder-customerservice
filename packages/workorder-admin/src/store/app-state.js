/** In-memory workbench snapshot shared by page renderers. */

import { bootstrap as fetchBootstrap } from '../api/workbench.js'
import { getProjectId, setProjectId } from './session.js'

/** @type {import('../api/workbench.js') extends never ? any : any} */
let snapshot = null
let loading = null
let filteredProjects = null
let projectsFilterState = { keyword: '', status: '', province: '', city: '', district: '', businessType: '' }
let spacesFilterState = { keyword: '', type: '全部', status: '全部' }
let spacesCache = null
let selectedSpaceId = null
let peopleTab = 'all'
let peopleFilterState = { keyword: '', status: '全部' }
let peopleListCache = null

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

export function setSpacesFilterState(keyword, type, status) {
  spacesFilterState = { keyword, type, status }
}

export function clearSpacesFilterState() {
  spacesFilterState = { keyword: '', type: '全部', status: '全部' }
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
  peopleListCache = null
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

export function getPeopleTab() {
  return peopleTab
}

export function setPeopleTab(tab) {
  peopleTab = tab === 'staff' ? 'staff' : 'all'
}

export function getPeopleFilterState() {
  return peopleFilterState
}

export function setPeopleFilterState(keyword, status) {
  peopleFilterState = { keyword: keyword || '', status: status || '全部' }
}

export function clearPeopleFilterState() {
  peopleFilterState = { keyword: '', status: '全部' }
}

export function getPeopleListCache() {
  return peopleListCache
}

export function setPeopleListCache(data) {
  peopleListCache = data
}

export function clearPeopleListCache() {
  peopleListCache = null
}
