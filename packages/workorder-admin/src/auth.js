/**
 * @deprecated Prefer store/session.js + api/auth.js
 * Kept as thin re-export for older imports.
 */
export { LOGIN_USERS as MOCK_USERS, getSession, setSession, clearSession } from './store/session.js'
export { login as mockLogin } from './api/auth.js'
