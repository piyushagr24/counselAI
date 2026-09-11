from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.routers import upload, qa, summary, clauses, obligations, deadlines, risks, compare, auth

app = FastAPI(title="AI Legal Contract Assistant API")

cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if "*" in cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins if cors_origins else ["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(qa.router)
app.include_router(summary.router)
app.include_router(clauses.router)
app.include_router(obligations.router)
app.include_router(deadlines.router)
app.include_router(risks.router)
app.include_router(compare.router)


import logging

logger = logging.getLogger(__name__)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc: Exception):
    logger.exception("Unhandled error on %s: %s", request.url.path, exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error occurred."})


@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok"}
