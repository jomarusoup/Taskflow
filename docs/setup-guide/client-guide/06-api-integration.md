# API 연동 구조

## client.js — 공통 fetch 클라이언트

JWT 자동 첨부, 토큰 만료 시 자동 갱신.

```js
// 사용 예시
import { apiFetch } from './api/client.js'

const res = await apiFetch('/tasks')
const tasks = await res.json()

await apiFetch('/tasks', {
  method: 'POST',
  body: JSON.stringify({ title: '업무명' })
})
```

## auth.js — 인증

```js
import { login, logout, isLoggedIn } from './api/auth.js'

await login('admin', 'password')
if (!isLoggedIn()) window.location.href = '/login'
await logout()
```

## JWT 토큰 흐름

```
로그인 성공
  → Access Token  → localStorage('tf_access_token')  [15분]
  → Refresh Token → HttpOnly 쿠키                     [14일]

API 요청 → Authorization: Bearer <token>

401 수신
  → /api/v1/auth/refresh 자동 호출
  → 성공: 새 토큰 발급 후 재요청
  → 실패: 로그인 페이지 이동
```
