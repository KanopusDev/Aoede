"""
API Routes for Aoede application
"""
from fastapi import APIRouter
from app.api.routes import generator, models, projects, testing, health, websocket, auth

# Create main API router
api_router = APIRouter()

# Include sub-routers
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"]
)

api_router.include_router(
    health.router,
    prefix="/health",
    tags=["Health"]
)

api_router.include_router(
    projects.router,
    prefix="/projects",
    tags=["Projects"]
)

api_router.include_router(
    generator.router,
    prefix="/generate",
    tags=["Code Generation"]
)

api_router.include_router(
    testing.router,
    prefix="/test",
    tags=["Testing"]
)

api_router.include_router(
    models.router,
    prefix="/models",
    tags=["AI Models"]
)

api_router.include_router(
    websocket.router,
    tags=["Monitoring"]
)
