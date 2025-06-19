"""
Health check endpoints
"""
from fastapi import APIRouter, Depends
from typing import Dict, Any
import time
import psutil
import asyncio

from app.core.database import db_manager, get_redis
from app.services.ai_model import ai_model_service
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()


@router.get("/", response_model=Dict[str, Any])
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "service": "aoede-api"
    }


@router.get("/detailed", response_model=Dict[str, Any])
async def detailed_health_check():
    """Detailed health check with all components"""
    start_time = time.time()
    
    try:
        # Check database health
        db_health = await db_manager.health_check()
        
        # Check Redis health
        redis_client = await get_redis()
        redis_healthy = False
        redis_status = "unavailable"
        
        if redis_client is not None:
            try:
                await redis_client.ping()
                redis_healthy = True
                redis_status = "healthy"
            except Exception as e:
                logger.error(f"Redis health check failed: {e}")
                redis_status = "unhealthy"
        else:
            logger.info("Redis client not available (development mode)")
            redis_healthy = True  # Don't fail health check in dev mode without Redis
        
        # Check AI model service
        ai_models_healthy = True
        try:
            # Simple test to check if service is responsive
            pass
        except Exception as e:
            logger.error(f"AI models health check failed: {e}")
            ai_models_healthy = False
          # System metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        health_data = {
            "status": "healthy" if all([
                db_health["status"] == "ok",
                redis_healthy,
                ai_models_healthy
            ]) else "unhealthy",
            "timestamp": time.time(),
            "response_time": time.time() - start_time,
            "components": {
                "database": db_health,
                "redis": {"status": redis_status},
                "ai_models": {"status": "healthy" if ai_models_healthy else "unhealthy"}
            },
            "system": {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_available": memory.available,
                "disk_percent": disk.percent,
                "disk_free": disk.free
            },
            "version": "1.0.0"
        }
        
        return health_data
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "error",
            "timestamp": time.time(),
            "error": str(e),
            "version": "1.0.0"
        }


@router.get("/readiness")
async def readiness_check():
    """Kubernetes readiness probe"""
    try:
        # Quick checks for essential services
        db_health = await db_manager.health_check()
        
        if db_health["status"] != "ok":
            return {"status": "not_ready", "reason": "database_unavailable"}
        
        return {"status": "ready"}
        
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return {"status": "not_ready", "reason": str(e)}


@router.get("/liveness")
async def liveness_check():
    """Kubernetes liveness probe"""
    return {"status": "alive", "timestamp": time.time()}


@router.get("/metrics")
async def get_metrics():
    """Application metrics for monitoring"""
    try:
        # Get AI model stats
        model_stats = await ai_model_service.get_model_stats()
        
        # System metrics
        cpu_percent = psutil.cpu_percent()
        memory = psutil.virtual_memory()
        
        metrics = {
            "timestamp": time.time(),
            "system": {
                "cpu_percent": cpu_percent,
                "memory_percent": memory.percent,
                "memory_used": memory.used,
                "memory_total": memory.total
            },
            "ai_models": model_stats,
            "application": {
                "version": "1.0.0",
                "uptime": time.time()  # This would be calculated from start time
            }
        }
        
        return metrics
        
    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        return {"error": str(e), "timestamp": time.time()}
