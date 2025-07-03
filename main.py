"""
Main FastAPI application entry point
"""
from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from fastapi.openapi.utils import get_openapi
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
    title="Aoede - Enterprise AI No-Code Agent", 
    description="Enterprise-grade AI no-code agent with GitHub AI integration and testing tools. "
                "This powerful platform combines the latest AI models with intuitive no-code tools, "
                "enabling rapid development and deployment of intelligent applications. "
                "Features include multi-model AI integration, automated testing, real-time monitoring, "
                "and enterprise-grade security.",
    version="1.0.0",
    openapi_version="3.0.2",  # Specify OpenAPI version
    docs_url=None,  # Disable default docs - we'll create custom ones
    redoc_url=None,  # Disable default redoc - we'll create custom ones
    lifespan=lifespan,
    contact={
        "name": "Kanopus Support",
        "url": "https://github.com/kanopusdev/aoede",
        "email": "support@kanopus.org"
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT"
    },
    servers=[
        {
            "url": "http://127.0.0.1:8000",
            "description": "Development server"
        },
        {
            "url": "https://aoede.kanopus.org",
            "description": "Production server"
        }
    ]
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

# Configure OpenAPI tags for better documentation organization
tags_metadata = [
    {
        "name": "Health",
        "description": "System health and status endpoints for monitoring and diagnostics",
    },
    {
        "name": "Projects",
        "description": "Project management operations including creation, retrieval, and management of AI projects",
    },
    {
        "name": "Code Generation",
        "description": "AI-powered code generation endpoints for creating, editing, and managing code",
    },
    {
        "name": "Testing",
        "description": "Automated testing tools and test result management endpoints",
    },
    {
        "name": "AI Models",
        "description": "AI model management, configuration, and usage tracking endpoints",
    },
    {
        "name": "Templates",
        "description": "Code template management for reusable code patterns and structures",
    },
    {
        "name": "Monitoring",
        "description": "System monitoring, metrics collection, and performance tracking endpoints",
    },
    {
        "name": "Authentication",
        "description": "User authentication and authorization management endpoints",
    }
]

# Update the OpenAPI schema with enhanced metadata
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    try:
        # Try the newer FastAPI signature first
        openapi_schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
    except TypeError:
        # Fallback to older signature or simpler approach
        try:
            openapi_schema = get_openapi(
                routes=app.routes,
            )
            # Manually set title, version, description
            if "info" in openapi_schema:
                openapi_schema["info"]["title"] = app.title
                openapi_schema["info"]["version"] = app.version
                openapi_schema["info"]["description"] = app.description
        except Exception:
            # Final fallback - create basic schema structure
            openapi_schema = {
                "openapi": "3.0.2",
                "info": {
                    "title": app.title,
                    "version": app.version,
                    "description": app.description
                },
                "paths": {}
            }
    
    # Ensure we have a valid schema structure
    if not isinstance(openapi_schema, dict):
        openapi_schema = {"openapi": "3.0.2", "info": {"title": app.title, "version": app.version}}
    
    # Add tags metadata manually
    openapi_schema["tags"] = tags_metadata
    
    # Add additional OpenAPI metadata
    if "info" not in openapi_schema:
        openapi_schema["info"] = {}
    
    openapi_schema["info"]["x-logo"] = {
        "url": "https://aoede.kanopus.org/static/favicon.ico",
        "altText": "Aoede Logo"
    }
    
    openapi_schema["info"]["termsOfService"] = "https://aoede.kanopus.org/terms"
    
    # Add security schemes
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}
    
    openapi_schema["components"]["securitySchemes"] = {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key"
        },
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

# Apply custom OpenAPI schema
app.openapi = custom_openapi

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

# Mount static files (fallback)
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Templates
templates = Jinja2Templates(directory="app/templates")

# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Also include API routes without version prefix for compatibility
app.include_router(api_router, prefix="/api")

# Also include API routes without version prefix for compatibility
app.include_router(api_router, prefix="/api")


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Serve the main application page"""
    return templates.TemplateResponse(
        "index.html", 
        {"request": request, "title": "Aoede - AI No-Code Agent"}
    )


@app.get("/docs", response_class=HTMLResponse, include_in_schema=False)
async def custom_swagger_ui_html(request: Request):
    """Custom Swagger UI documentation page"""
    return templates.TemplateResponse(
        "docs.html", 
        {
            "request": request, 
            "title": "Aoede API Documentation",
            "openapi_url": app.openapi_url or "/openapi.json"
        }
    )


@app.get("/redoc", response_class=HTMLResponse, include_in_schema=False)
async def custom_redoc_html(request: Request):
    """Custom ReDoc documentation page"""
    return templates.TemplateResponse(
        "redoc.html", 
        {
            "request": request, 
            "title": "Aoede API Reference",
            "openapi_url": app.openapi_url or "/openapi.json"
        }
    )


@app.get("/openapi.json")
async def get_openapi():
    """Return the OpenAPI schema as JSON"""
    return custom_openapi()


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