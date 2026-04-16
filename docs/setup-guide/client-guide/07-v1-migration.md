# v1 → v2 코드 마이그레이션

v1은 `localStorage` 직접 읽기/쓰기, v2는 API 호출로 교체한다.

## 변경 패턴

```js
// v1
function save() {
  localStorage.setItem('taskflow_v3', JSON.stringify(tasks))
}

// v2
async function save() {
  await apiFetch('/tasks/bulk', {
    method: 'PUT',
    body: JSON.stringify(tasks)
  })
}
```

## 마이그레이션 우선순위

| 모듈 | 우선순위 | 이유 |
|---|---|---|
| `core.js` — `load()`, `save()` | 최우선 | 모든 모듈이 의존 |
| `data.js` — CRUD | 높음 | |
| `contacts.js` | 높음 | |
| `calendar.js`, `ledger.js` | 중간 | |
| `inventory.js` | 중간 | 자산관리 API 연동 |
| `ui.js`, `app.js` | 낮음 | 순수 UI 로직 |
