from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from app.database import init_db
from app.routers import admin, health, inquiry

settings = get_settings()

app = FastAPI(title="e-PAPER Inquiry API", version="1.0.0")
app.state.limiter = inquiry.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_origin_regex=r"https://.*\.netlify\.app",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(inquiry.router)
app.include_router(admin.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    errors = [str(error.get("msg", "입력값을 확인해 주세요.")) for error in exc.errors()]
    return JSONResponse(status_code=400, content={"message": errors[0], "errors": errors})


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    print(f"unexpected error: {exc}")
    return JSONResponse(status_code=500, content={"message": "서버 오류로 접수에 실패했습니다."})
