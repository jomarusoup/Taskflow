# TASKFLOW API 명세

> 백엔드 세션과 프론트엔드 세션의 유일한 접점.
> 엔드포인트 추가·변경 시 **백엔드가 먼저 이 파일을 갱신**한다.

Base URL: `/api/v1`

---

## 인증

| Method | Path | 설명 |
|---|---|---|
| POST | `/auth/login` | 로그인 (Access Token + Refresh Cookie 발급) |
| POST | `/auth/logout` | 로그아웃 (Refresh Cookie 삭제) |
| POST | `/auth/refresh` | Access Token 갱신 |

---

## 업무 (Tasks)

| Method | Path | 설명 |
|---|---|---|
| GET | `/tasks` | 목록 조회 (필터·정렬 쿼리 파라미터) |
| POST | `/tasks` | 업무 생성 |
| GET | `/tasks/:id` | 단일 조회 |
| PUT | `/tasks/:id` | 수정 |
| DELETE | `/tasks/:id` | 삭제 |

---

## 연락처 (Contacts)

| Method | Path | 설명 |
|---|---|---|
| GET | `/contacts` | 목록 조회 |
| POST | `/contacts` | 생성 |
| PUT | `/contacts/:id` | 수정 |
| DELETE | `/contacts/:id` | 삭제 |

---

## 일정 (Schedules)

| Method | Path | 설명 |
|---|---|---|
| GET | `/schedules` | 월별 조회 (`?year=&month=`) |
| POST | `/schedules` | 생성 |
| PUT | `/schedules/:id` | 수정 |
| DELETE | `/schedules/:id` | 삭제 |

---

> 상세 요청/응답 스키마는 추후 OpenAPI(Swagger) YAML로 확장 예정.
