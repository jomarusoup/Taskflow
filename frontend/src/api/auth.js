// 인증 API
import { apiFetch } from './client.js'

export async function login(username, password) {
  const res = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error('로그인 실패')
  const data = await res.json()
  localStorage.setItem('tf_access_token', data.access_token)
  return data
}

export async function logout() {
  await apiFetch('/auth/logout', { method: 'POST', credentials: 'include' })
  localStorage.removeItem('tf_access_token')
  window.location.href = '/login'
}

export function isLoggedIn() {
  return !!localStorage.getItem('tf_access_token')
}
