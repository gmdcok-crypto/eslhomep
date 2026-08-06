# e-PAPER

서브도메인용 e-PAPER(전자명패·예약 디스플레이) 랜딩 사이트입니다.

- **프론트**: `frontend/` → Netlify
- **문의 API**: `backend/` → Railway (FastAPI + MySQL)
- **디자인 원본**: `design/signet-esl.pen` → [pen.dev](https://pen.dev) / Pencil에서 열기

## 로컬 실행

### 프론트

```bash
cd frontend
npx --yes serve -l 5500
```

브라우저: http://localhost:5500

### 백엔드 (FastAPI)

```bash
cd backend
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

1. Netlify에 `frontend` 폴더를 배포 (Base directory: `frontend`)
2. Railway API URL을 받은 뒤 `frontend/js/config.js` 수정:

```js
window.SIGNET_CONFIG = {
  apiBaseUrl: "https://YOUR-SERVICE.up.railway.app",
};
```

또는 배포 전에 환경 변수로 주입하려면 `index.html`에 다음을 `config.js`보다 **앞에** 넣습니다.

```html
<script>window.SIGNET_API_BASE = "https://YOUR-SERVICE.up.railway.app";</script>
```

## Railway 배포

1. Railway 서비스 **Root Directory**를 반드시 `backend`로 설정
2. 같은 프로젝트에 **MySQL** 서비스 추가
3. **Start Command** (자동 감지 실패 시 수동 입력):

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

4. API 서비스 Variables 설정:

| 변수 | 예시 |
|------|------|
| `CORS_ORIGINS` | `https://esl.bluecs.co.kr` |
| `MYSQLHOST` | Railway MySQL에서 자동 주입 |
| `MYSQLPORT` | Railway MySQL에서 자동 주입 |
| `MYSQLUSER` | Railway MySQL에서 자동 주입 |
| `MYSQLPASSWORD` | Railway MySQL에서 자동 주입 |
| `MYSQLDATABASE` | Railway MySQL에서 자동 주입 |
| `INQUIRY_TO` | 수신 이메일 (SMTP 사용 시) |
| `SMTP_*` | 선택 — 메일 알림 |

4. 문의는 MySQL `inquiries` 테이블에 저장됩니다. 앱 시작 시 테이블이 자동 생성됩니다.

### API

- `GET /health`
- `POST /api/inquiry`  
  body: `{ name, email, message, category, company?, phone? }`  
  category: `hospital` | `meeting` | `reservation` | `office` | `mixed`

## pen.dev

1. Cursor/VS Code에 Pencil(pen.dev) 확장 설치
2. `design/signet-esl.pen` 열기
3. MCP가 연결되면 채팅에서 디자인 수정 → 코드 동기화 가능
