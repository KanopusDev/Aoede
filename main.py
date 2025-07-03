"""
Main FastAPI application entry point
"""
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
import structlog
import uvicorn
import time
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db
from app.core.logging import setup_logging
from app.api.routes import api_router
from app.middleware.limitter import RateLimitMiddleware, init_rate_limiter
from app.middleware.security import SecurityMiddleware
from app.middleware.monitoring import MonitoringMiddleware
from app.services.models import ai_model_service
import redis.asyncio as redis

# Setup structured logging
setup_logging()
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    logger.info("Starting Aoede application")
    
    try:
        # Initialize database
        await init_db()
        logger.info("Database initialized")
        
        # Initialize Redis client for rate limiting
        redis_client = None
        try:
            redis_client = redis.from_url(settings.REDIS_URL)
            await redis_client.ping()
            logger.info("Redis client initialized for rate limiting")
        except Exception as e:
            logger.warning(f"Redis not available, using in-memory rate limiting: {e}")
            redis_client = None
        
        # Initialize rate limiter with Redis client
        await init_rate_limiter(redis_client)
        
        # Initialize AI model service
        await ai_model_service.initialize()
        logger.info("AI Model Service initialized")
        
        yield
        
    finally:
        logger.info("Shutting down Aoede application")
        
        # Clean shutdown of Redis
        if redis_client:
            await redis_client.close()
        
        # Clean shutdown of AI service
        await ai_model_service.close()
        logger.info("AI Model Service closed")


# Create FastAPI application
app = FastAPI(
    title="Aoede", 
    description="Enterprise-grade AI no-code agent with GitHub AI integration and testing tools. "
                "This powerful platform combines the latest AI models with intuitive no-code tools, "
                "enabling rapid development and deployment of intelligent applications. "
                "Features include multi-model AI integration, automated testing, real-time monitoring, "
                "and enterprise-grade security.",
    version="1.0.0",
    lifespan=lifespan,
    contact={
        "name": "Kanopus Support",
        "url": "https://github.com/kanopusdev/aoede",
        "email": "support@kanopus.org"
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    }
)

# Add security middleware
app.add_middleware(SecurityMiddleware)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Add trusted host middleware
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.ALLOWED_HOSTS
)

# Add rate limiting middleware (Redis client will be passed during startup)
app.add_middleware(RateLimitMiddleware)

# Add monitoring middleware
app.add_middleware(MonitoringMiddleware)

# Custom static files handler for development (no caching)
from fastapi.responses import FileResponse
import os

@app.get("/static/{file_path:path}")
async def serve_static(file_path: str):
    """Serve static files with no-cache headers for development"""
    static_file = f"app/static/{file_path}"
    if os.path.exists(static_file):
        response = FileResponse(static_file)
        if settings.DEBUG:
            # Add no-cache headers for development
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response
    else:
        raise HTTPException(status_code=404, detail="File not found")

# Mount static files 
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Templates
templates = Jinja2Templates(directory="app/templates")

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Serve the main application page"""
    return templates.TemplateResponse(
        "index.html", 
        {"request": request, "title": "Aoede"}
    )

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Serve the login page"""
    return templates.TemplateResponse(
        "login.html", 
        {"request": request, "title": "Login - Aoede"}
    )

@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    """Serve the registration page"""
    return templates.TemplateResponse(
        "register.html", 
        {"request": request, "title": "Register - Aoede"}
    )

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    """Serve the dashboard page"""
    return templates.TemplateResponse(
        "dashboard.html", 
        {"request": request, "title": "Dashboard - Aoede"}
    )

@app.get("/about", response_class=HTMLResponse)
async def about_page(request: Request):
    """Serve the about page"""
    return templates.TemplateResponse(
        "about.html", 
        {"request": request, "title": "About - Aoede"}
    )

@app.get("/contact", response_class=HTMLResponse)
async def contact_page(request: Request):
    """Serve the contact page"""
    return templates.TemplateResponse(
        "contact.html", 
        {"request": request, "title": "Contact - Aoede"}
    )

@app.get("/features", response_class=HTMLResponse)
async def features_page(request: Request):
    """Serve the features page"""
    return templates.TemplateResponse(
        "features.html", 
        {"request": request, "title": "Features - Aoede"}
    )

@app.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request):
    """Serve the settings page"""
    return templates.TemplateResponse(
        "settings.html", 
        {"request": request, "title": "Settings - Aoede"}
    )

@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "ai_service_initialized": ai_model_service.initialized
    }


@app.get("/metrics", tags=["Monitoring"])
async def metrics():
    """Prometheus metrics endpoint"""
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        workers=1 if settings.DEBUG else settings.WORKERS,
        log_config=None  # Use our custom logging
    )