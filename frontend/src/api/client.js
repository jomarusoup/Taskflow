// API 클라이언트 — 모든 fetch 요청의 기반
const BASE = '/api/v1'

export async function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('tf_access_token')
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(BASE + path, { ...opts, headers })

  if (res.status === 401) {
    // 토큰 만료 → 리프레시 시도
    const refreshed = await refreshToken()
    if (!refreshed) { redirectToLogin(); return }
    headers['Authorization'] = `Bearer ${localStorage.getItem('tf_access_token')}`
    return fetch(BASE + path, { ...opts, headers })
  }

  return res
}

async function refreshToken() {
  const res = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include', // HttpOnly 쿠키 자동 전송
  })
  if (!res.ok) return false
  const data = await res.json()
  localStorage.setItem('tf_access_token', data.access_token)
  return true
}

function redirectToLogin() {
  localStorage.removeItem('tf_access_token')
  window.location.href = '/login'
}
