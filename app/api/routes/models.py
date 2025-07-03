"""
AI Models management endpoints with IP-based rate limiting
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.services.models import ai_model_service
from app.core.config import MODEL_CONFIGS
from app.core.logging import get_logger
from app.middleware.limitter import check_ip_rate_limit

logger = get_logger(__name__)
router = APIRouter()


class ModelTestRequest(BaseModel):
    """Model test request schema"""
    prompt: str
    model: Optional[str] = None


class ModelTestResponse(BaseModel):
    """Model test response schema"""
    success: bool
    model_used: str
    response: str
    input_tokens: int
    output_tokens: int
    response_time: float
    error: Optional[str] = None


@router.get("/", response_model=List[Dict[str, Any]])
async def list_models():
    """List all available AI models"""
    try:
        models = []
        for model_name, config in MODEL_CONFIGS.items():
            models.append({
                "name": model_name,
                "type": config["type"],
                "max_tokens": config["max_tokens"],
                "temperature": config["temperature"],
                "priority": config["priority"],
                "description": f"{config['type'].replace('_', ' ').title()} model"
            })
        
        return models
        
    except Exception as e:
        logger.error(f"Failed to list models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_models_status():
    """Get health status of all models"""
    try:
        models_status = {}
        
        for model_name in MODEL_CONFIGS.keys():
            try:
                # Check model health
                is_healthy = await ai_model_service.router.health_checker.check_model_health(model_name)
                models_status[model_name] = {
                    "status": "healthy" if is_healthy else "unhealthy",
                    "last_checked": "now"  # Would be actual timestamp
                }
            except Exception as e:
                models_status[model_name] = {
                    "status": "error",
                    "error": str(e),
                    "last_checked": "now"
                }
        
        # Overall status
        healthy_count = sum(1 for status in models_status.values() if status["status"] == "healthy")
        total_count = len(models_status)
        
        return {
            "overall_status": "healthy" if healthy_count == total_count else "degraded",
            "healthy_models": healthy_count,
            "total_models": total_count,
            "models": models_status
        }
        
    except Exception as e:
        logger.error(f"Failed to get models status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test", response_model=ModelTestResponse)
async def test_model(
    request: ModelTestRequest, 
    req: Request,
    rate_info: dict = Depends(check_ip_rate_limit)
):
    """Test a specific model or auto-select with IP-based rate limiting"""
    try:
        client_ip = req.headers.get("X-Forwarded-For", req.client.host if req.client else "unknown")
        logger.info(f"Testing model: {request.model or 'auto-select'} from IP: {client_ip}")
        
        # Generate response
        ai_response = await ai_model_service.generate_response(
            prompt=request.prompt,
            context="This is a test request",
            task_type="general_purpose",
            model=request.model
        )
        
        return ModelTestResponse(
            success=ai_response.success,
            model_used=ai_response.model,
            response=ai_response.content,
            input_tokens=ai_response.input_tokens,
            output_tokens=ai_response.output_tokens,
            response_time=ai_response.response_time,
            error=ai_response.error
        )
        
    except Exception as e:
        logger.error(f"Model test failed: {e}")
        return ModelTestResponse(
            success=False,
            model_used=request.model or "unknown",
            response="",
            input_tokens=0,
            output_tokens=0,
            response_time=0.0,
            error=str(e)
        )


@router.get("/stats")
async def get_model_stats():
    """Get model usage statistics"""
    try:
        stats = await ai_model_service.get_model_stats()
        return stats
        
    except Exception as e:
        logger.error(f"Failed to get model stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{model_name}/info")
async def get_model_info(model_name: str):
    """Get detailed information about a specific model"""
    try:
        if model_name not in MODEL_CONFIGS:
            raise HTTPException(status_code=404, detail="Model not found")
        
        config = MODEL_CONFIGS[model_name]
        
        # Check model health
        is_healthy = await ai_model_service.router.health_checker.check_model_health(model_name)
        
        return {
            "name": model_name,
            "config": config,
            "health_status": "healthy" if is_healthy else "unhealthy",
            "capabilities": {
                "code_generation": config["type"] in ["code_generation", "general_purpose"],
                "text_processing": config["type"] in ["text_processing", "general_purpose"],
                "advanced_reasoning": config["type"] == "advanced_reasoning",
                "chunking_support": True
            },
            "limits": {
                "max_tokens": config["max_tokens"],
                "safety_buffer": 200
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get model info for {model_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{model_name}/test")
async def test_specific_model(model_name: str, request: ModelTestRequest):
    """Test a specific model by name"""
    try:
        if model_name not in MODEL_CONFIGS:
            raise HTTPException(status_code=404, detail="Model not found")
        
        logger.info(f"Testing specific model: {model_name}")
        
        # Generate response with specific model
        ai_response = await ai_model_service.generate_response(
            prompt=request.prompt,
            context="This is a direct model test",
            task_type="general_purpose",
            model=model_name
        )
        
        return ModelTestResponse(
            success=ai_response.success,
            model_used=ai_response.model,
            response=ai_response.content,
            input_tokens=ai_response.input_tokens,
            output_tokens=ai_response.output_tokens,
            response_time=ai_response.response_time,
            error=ai_response.error
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Specific model test failed for {model_name}: {e}")
        return ModelTestResponse(
            success=False,
            model_used=model_name,
            response="",
            input_tokens=0,
            output_tokens=0,
            response_time=0.0,
            error=str(e)
        )


@router.get("/usage/summary")
async def get_usage_summary():
    """Get usage summary across all models"""
    try:
        # This would query the database for usage statistics
        # Simplified for now
        return {
            "total_requests": 0,
            "total_tokens": 0,
            "average_response_time": 0.0,
            "success_rate": 100.0,
            "top_models": [],
            "usage_by_type": {
                "code_generation": 0,
                "text_processing": 0,
                "general_purpose": 0,
                "advanced_reasoning": 0
            },
            "time_period": "last_24_hours"
        }
        
    except Exception as e:
        logger.error(f"Failed to get usage summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/benchmark")
async def run_benchmark():
    """Run performance benchmark on all models"""
    try:
        benchmark_prompt = "Generate a simple Python function that adds two numbers"
        results = {}
        
        for model_name in MODEL_CONFIGS.keys():
            try:
                ai_response = await ai_model_service.generate_response(
                    prompt=benchmark_prompt,
                    context="Benchmark test",
                    model=model_name
                )
                
                results[model_name] = {
                    "success": ai_response.success,
                    "response_time": ai_response.response_time,
                    "input_tokens": ai_response.input_tokens,
                    "output_tokens": ai_response.output_tokens,
                    "total_tokens": ai_response.input_tokens + ai_response.output_tokens,
                    "error": ai_response.error
                }
                
            except Exception as e:
                results[model_name] = {
                    "success": False,
                    "response_time": 0.0,
                    "error": str(e)
                }
        
        # Calculate summary
        successful_models = [name for name, result in results.items() if result["success"]]
        avg_response_time = sum(
            result["response_time"] for result in results.values() if result["success"]
        ) / max(len(successful_models), 1)
        
        return {
            "benchmark_results": results,
            "summary": {
                "successful_models": len(successful_models),
                "total_models": len(results),
                "average_response_time": round(avg_response_time, 3),
                "fastest_model": min(
                    successful_models,
                    key=lambda m: results[m]["response_time"],
                    default=None
                )
            },
            "timestamp": "now"
        }
        
    except Exception as e:
        logger.error(f"Benchmark failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
