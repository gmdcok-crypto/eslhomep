# SIGNET ESL

서브도메인용 ESL(전자명패·예약 디스플레이) 랜딩 사이트입니다.

- **프론트**: `frontend/` → Netlify
- **문의 API**: `backend/` → Railway
- **디자인 원본**: `design/signet-esl.pen` → [pen.dev](https://pen.dev) / Pencil에서 열기

## 브랜드 · 솔루션

**SIGNET ESL** — 공간이 스스로 말하는 ESL명패

| 솔루션 | 설명 |
|--------|------|
| 병원 입원실 · 병상 네임텍 | 환자·주의사항·식사 등 실시간 표시 |
| 회의실 전자명패 | 회의 제목·시간·사용 상태 |
| 예약 룸 · 테이블 | 예약자·시간 정보 표시 |
| 관공서 · 기업 사무실 명패 | 부서·직책 무선 갱신 |

## 로컬 실행

### 프론트

```bash
cd frontend
npx --yes serve -l 5500
```

브라우저: http://localhost:5500

### 백엔드

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API: http://localhost:8080/health

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

1. `backend`를 Railway 프로젝트로 배포
2. Variables 설정:

| 변수 | 예시 |
|------|------|
| `CORS_ORIGINS` | `https://your-site.netlify.app,https://esl.yourdomain.com` |
| `INQUIRY_TO` | 수신 이메일 (SMTP 사용 시) |
| `SMTP_*` | 선택 — 메일 알림 |

3. 문의는 `data/inquiries.jsonl`에 저장됩니다. 영속화가 필요하면 Railway Volume을 붙이고 `DATA_DIR`을 지정하세요.

### API

- `GET /health`
- `POST /api/inquiry`  
  body: `{ name, email, message, category, company?, phone? }`  
  category: `hospital` | `meeting` | `reservation` | `office` | `mixed`

## pen.dev

1. Cursor/VS Code에 Pencil(pen.dev) 확장 설치
2. `design/signet-esl.pen` 열기
3. MCP가 연결되면 채팅에서 디자인 수정 → 코드 동기화 가능

현재 환경에 Pencil MCP가 없어 디자인 토큰·히어로·솔루션 프레임을 `.pen`으로 작성하고, 동일 비주얼 언어로 프론트를 구현했습니다.
