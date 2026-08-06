# e-PAPER

서브도메인용 e-PAPER(전자명패·예약 디스플레이) 랜딩 사이트입니다.

- **프론트**: `frontend/` → Netlify
- **문의 API**: 루트 FastAPI + MySQL → Railway
- **디자인 원본**: `design/signet-esl.pen` → [pen.dev](https://pen.dev) / Pencil에서 열기

## 로컬 실행

### 프론트

```bash
cd frontend
npx --yes serve -l 5500
```

브라우저: http://localhost:5500

### API (FastAPI)

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8080
```

API: http://localhost:8080/health

MySQL 없이 실행하면 로컬 SQLite(`data/inquiries.db`)를 사용합니다.

`frontend/js/config.js`의 `apiBaseUrl`이 `http://localhost:8080`인지 확인하세요.

## Netlify 배포

1. Netlify에 `frontend` 폴더를 배포 (publish directory: `frontend`)
2. Railway API URL을 받은 뒤 `frontend/js/config.js` 수정:

```js
window.SIGNET_CONFIG = {
  apiBaseUrl: "https://YOUR-SERVICE.up.railway.app",
};
```

## Railway 배포

1. Root Directory는 비워 두세요 (저장소 루트)
2. 같은 프로젝트에 **MySQL** 서비스 추가
3. Start Command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

4. Variables:

| 변수 | 예시 |
|------|------|
| `CORS_ORIGINS` | `https://esl.bluecs.co.kr` |
| `MYSQLHOST` | Railway MySQL 자동 주입 |
| `MYSQLPORT` | Railway MySQL 자동 주입 |
| `MYSQLUSER` | Railway MySQL 자동 주입 |
| `MYSQLPASSWORD` | Railway MySQL 자동 주입 |
| `MYSQLDATABASE` | Railway MySQL 자동 주입 |
| `INQUIRY_TO` | 수신 이메일 (SMTP 사용 시) |
| `SMTP_*` | 선택 — 메일 알림 |

문의는 MySQL `inquiries` 테이블에 저장됩니다. 앱 시작 시 테이블이 자동 생성됩니다.

### API

- `GET /health`
- `POST /api/inquiry`  
  body: `{ name, email, message, category, company?, phone? }`  
  category: `hospital` | `meeting` | `reservation` | `office` | `mixed`
- `GET /api/admin/inquiries` (관리자 PWA)  
  header: `X-Admin-Key: <ADMIN_API_KEY>`

## 관리자 PWA

- URL: `https://esl.bluecs.co.kr/admin/`
- 문의 목록 조회 + 30초마다 새 접수 확인 + 브라우저 알림
- Railway Variables에 `ADMIN_API_KEY` 설정 후 PWA 로그인 화면에서 입력
