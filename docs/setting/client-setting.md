# Client Setting — 프론트엔드 환경 구성

> 대상: Taskflow v2 프론트엔드 (Vite + Vanilla JS)
> OS: RHEL/Rocky Linux 8/9

---

## 목차

1. [개요](#1-개요)
2. [Node.js 설치](#2-nodejs-설치)
3. [프로젝트 구조](#3-프로젝트-구조)
4. [Vite 설정](#4-vite-설정)
5. [개발 서버 실행](#5-개발-서버-실행)
6. [프로덕션 빌드](#6-프로덕션-빌드)
7. [API 연동 구조](#7-api-연동-구조)
8. [v1 → v2 코드 마이그레이션](#8-v1--v2-코드-마이그레이션)

---

## 1. 개요

| 항목 | 내용 |
|---|---|
| 빌드 도구 | Vite 5 |
| 언어 | Vanilla JavaScript (ES Modules) |
| 스타일 | CSS 변수 기반 (프레임워크 없음) |
| 번들 결과 | `frontend/dist/` → Nginx가 정적 파일로 제공 |
| API 통신 | `/api/v1/*` → Nginx가 Go 백엔드로 프록시 |

### 아키텍처 흐름

```
브라우저
  ↓ 정적 파일 (HTML/CSS/JS)
Nginx (:80)
  ↓ /api/* 프록시
Go 백엔드 (:8080)
  ↓
PostgreSQL (:5432)
```

---

## 2. Node.js 설치

### 버전 확인

```bash
node --version   # v20.x.x 이상 필요
npm --version    # 10.x.x 이상
```

### 미설치 시 — nvm 사용 (권장)

```bash
# nvm 설치
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Node.js 20 LTS 설치 및 기본값 지정
nvm install 20
nvm use 20
nvm alias default 20

# 확인
node --version
```

### 또는 dnf 사용

```bash
sudo dnf module enable nodejs:20 -y
sudo dnf install -y nodejs npm
```

---

## 3. 프로젝트 구조

```
frontend/
├── src/
│   ├── index.html          # 메인 HTML (엔트리포인트)
│   ├── main.js             # JS 진입점 — API 클라이언트 초기화
│   ├── js/                 # 기존 v1 로직 (모듈화됨)
│   │   ├── core.js         # 전역 상태, 스토리지 유틸
│   │   ├── ui.js           # 공통 UI, 테마, 마크다운
│   │   ├── data.js         # 업무 CRUD
│   │   ├── calendar.js     # 대시보드, 캘린더
│   │   ├── kanban.js       # 칸반 보드
│   │   ├── ledger.js       # 업무 대장
│   │   ├── inventory.js    # 인벤토리
│   │   ├── contacts.js     # 연락처
│   │   ├── modal.js        # 모달
│   │   └── app.js          # 초기화 및 네비게이션
│   ├── css/
│   │   └── style.css       # 전체 스타일시트
│   └── api/                # v2 신규 — 백엔드 API 통신 레이어
│       ├── client.js       # fetch 기반 공통 클라이언트 (JWT 자동 첨부)
│       └── auth.js         # 로그인/로그아웃/토큰 관리
├── public/                 # 정적 자산 (이미지, 파비콘 등)
├── dist/                   # 빌드 결과물 (git 제외, Nginx가 바라봄)
├── package.json
└── vite.config.js
```

---

## 4. Vite 설정

### `frontend/vite.config.js`

```js
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',           // 소스 루트
  build: {
    outDir: '../dist',   // 빌드 출력 경로
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      // 개발 중 API 요청을 Go 백엔드로 프록시
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
})
```

### `frontend/package.json`

```json
{
  "name": "taskflow-frontend",
  "version": "2.0.0",
  "scripts": {
    "dev":     "vite",
    "build":   "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  }
}
```

### 의존성 설치

```bash
cd /opt/taskflow/frontend
npm install
```

---

## 5. 개발 서버 실행

로컬 개발 환경에서 핫 리로드와 함께 작업할 때 사용.

```bash
cd /opt/taskflow/frontend

# 개발 서버 시작 (포트 3000)
npm run dev

# 브라우저에서 접속
# http://localhost:3000
```

> Go 백엔드가 8080에서 실행 중이어야 `/api/*` 프록시가 동작한다.

---

## 6. 프로덕션 빌드

```bash
cd /opt/taskflow/frontend

# 빌드
npm run build

# 결과 확인
ls -lh dist/

# Nginx가 /opt/taskflow/frontend/dist 를 root로 바라보므로
# 빌드 후 바로 반영됨 (서버 재시작 불필요)
```

### 배포 자동화 스크립트 예시

```bash
#!/bin/bash
# /opt/taskflow/scripts/deploy-frontend.sh

set -e
cd /opt/taskflow
git pull origin main
cd frontend
npm install --production
npm run build
echo "프론트엔드 배포 완료: $(date)"
```

---

## 7. API 연동 구조

### `src/api/client.js` — 공통 fetch 클라이언트

모든 API 요청은 이 함수를 통해 처리한다. JWT 자동 첨부 및 토큰 만료 시 자동 갱신.

```js
// 사용 예시
import { apiFetch } from './api/client.js'

// GET
const res = await apiFetch('/tasks')
const tasks = await res.json()

// POST
const res = await apiFetch('/tasks', {
  method: 'POST',
  body: JSON.stringify({ title: '업무명', ... })
})
```

### `src/api/auth.js` — 인증

```js
import { login, logout, isLoggedIn } from './api/auth.js'

// 로그인
await login('admin', 'password')

// 로그인 여부 확인
if (!isLoggedIn()) window.location.href = '/login'

// 로그아웃
await logout()
```

### JWT 토큰 흐름

```
로그인 성공
  → Access Token  → localStorage('tf_access_token')  [15분]
  → Refresh Token → HttpOnly 쿠키                     [14일]

API 요청
  → Authorization: Bearer <access_token>

401 응답
  → /api/v1/auth/refresh 자동 호출 (쿠키로 refresh)
  → 새 access_token 발급 → 재요청
  → refresh도 실패 → 로그인 페이지로 이동
```

---

## 8. v1 → v2 코드 마이그레이션

v1의 JS 파일들은 `localStorage` 직접 읽기/쓰기를 사용한다.  
v2에서는 API 호출로 교체해야 한다.

### 변경 패턴

```js
// v1 (localStorage 직접)
function save() {
  localStorage.setItem('taskflow_v3', JSON.stringify(tasks))
}

// v2 (API 호출로 교체)
async function save() {
  await apiFetch('/tasks/bulk', {
    method: 'PUT',
    body: JSON.stringify(tasks)
  })
}
```

### 마이그레이션 우선순위

| 모듈 | 우선순위 | 비고 |
|---|---|---|
| `core.js` — `load()`, `save()` | 최우선 | 모든 모듈이 의존 |
| `data.js` — CRUD 함수 | 높음 | |
| `contacts.js` | 높음 | |
| `calendar.js`, `ledger.js` | 중간 | read-heavy |
| `inventory.js` | 중간 | 자산관리 API 연동 |
| `ui.js`, `app.js` | 낮음 | 순수 UI 로직 |
