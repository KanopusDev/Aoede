"""
Monitoring middleware for performance and metrics collection
"""
import time
import uuid
from typing import Dict, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_client import Counter, Histogram, Gauge
import structlog

from app.core.logging import get_logger

logger = get_logger(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter(
    'aoede_requests_total',
    'Total number of requests',
    ['method', 'endpoint', 'status_code']
)

REQUEST_DURATION = Histogram(
    'aoede_request_duration_seconds',
    'Request duration in seconds',
    ['method', 'endpoint']
)

ACTIVE_REQUESTS = Gauge(
    'aoede_active_requests',
    'Number of active requests'
)

AI_MODEL_REQUESTS = Counter(
    'aoede_ai_model_requests_total',
    'Total AI model requests',
    ['model', 'status']
)

AI_MODEL_TOKENS = Counter(
    'aoede_ai_model_tokens_total',
    'Total tokens used by AI models',
    ['model', 'type']  # type: input/output
)

CODE_GENERATIONS = Counter(
    'aoede_code_generations_total',
    'Total code generations',
    ['language', 'status']
)

TEST_EXECUTIONS = Counter(
    'aoede_test_executions_total',
    'Total test executions',
    ['language', 'status']
)


class MonitoringMiddleware(BaseHTTPMiddleware):
    """Middleware for monitoring and metrics collection"""
    
    def __init__(self, app):
        super().__init__(app)
        self.active_requests = {}
    
    async def dispatch(self, request: Request, call_next):
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # Start timing
        start_time = time.time()
        
        # Track active request
        ACTIVE_REQUESTS.inc()
        self.active_requests[request_id] = {
            "start_time": start_time,
            "method": request.method,
            "path": request.url.path,
            "client": request.client.host if request.client else "unknown"
        }
        
        # Add request ID to context
        request.state.request_id = request_id
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Get endpoint for metrics (sanitize path)
            endpoint = self._sanitize_endpoint(request.url.path)
            
            # Record metrics
            REQUEST_COUNT.labels(
                method=request.method,
                endpoint=endpoint,
                status_code=response.status_code
            ).inc()
            
            REQUEST_DURATION.labels(
                method=request.method,
                endpoint=endpoint
            ).observe(duration)
            
            # Add monitoring headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration:.3f}s"
            
            # Log request
            logger.info(
                "HTTP Request Completed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration=duration,
                client_ip=request.client.host if request.client else "unknown"
            )
            
            return response
            
        except Exception as e:
            # Calculate duration for error case
            duration = time.time() - start_time
            endpoint = self._sanitize_endpoint(request.url.path)
            
            # Record error metrics
            REQUEST_COUNT.labels(
                method=request.method,
                endpoint=endpoint,
                status_code=500
            ).inc()
            
            REQUEST_DURATION.labels(
                method=request.method,
                endpoint=endpoint
            ).observe(duration)
            
            # Log error
            logger.error(
                "HTTP Request Failed",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                duration=duration,
                error=str(e),
                client_ip=request.client.host if request.client else "unknown"
            )
            
            raise
            
        finally:
            # Clean up
            ACTIVE_REQUESTS.dec()
            if request_id in self.active_requests:
                del self.active_requests[request_id]
    
    def _sanitize_endpoint(self, path: str) -> str:
        """Sanitize endpoint path for metrics"""
        # Replace UUIDs with placeholder to reduce cardinality
        import re
        
        # UUID pattern
        uuid_pattern = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
        path = re.sub(uuid_pattern, '{id}', path, flags=re.IGNORECASE)
        
        # Common ID patterns
        path = re.sub(r'/\d+', '/{id}', path)
        
        # Limit path length for metrics
        if len(path) > 100:
            path = path[:97] + "..."
        
        return path


class MetricsCollector:
    """Collect custom application metrics"""
    
    @staticmethod
    def record_ai_model_request(model: str, success: bool, input_tokens: int, output_tokens: int):
        """Record AI model request metrics"""
        status = "success" if success else "error"
        
        AI_MODEL_REQUESTS.labels(model=model, status=status).inc()
        
        if success:
            AI_MODEL_TOKENS.labels(model=model, type="input").inc(input_tokens)
            AI_MODEL_TOKENS.labels(model=model, type="output").inc(output_tokens)
    
    @staticmethod
    def record_code_generation(language: str, success: bool):
        """Record code generation metrics"""
        status = "success" if success else "error"
        CODE_GENERATIONS.labels(language=language, status=status).inc()
    
    @staticmethod
    def record_test_execution(language: str, success: bool):
        """Record test execution metrics"""
        status = "success" if success else "error"
        TEST_EXECUTIONS.labels(language=language, status=status).inc()


class PerformanceTracker:
    """Track performance metrics for different operations"""
    
    def __init__(self):
        self.operation_times = {}
        self.operation_counts = {}
    
    def start_operation(self, operation_name: str) -> str:
        """Start tracking an operation"""
        operation_id = str(uuid.uuid4())
        self.operation_times[operation_id] = {
            "name": operation_name,
            "start_time": time.time()
        }
        return operation_id
    
    def end_operation(self, operation_id: str) -> float:
        """End tracking an operation and return duration"""
        if operation_id not in self.operation_times:
            return 0.0
        
        operation = self.operation_times[operation_id]
        duration = time.time() - operation["start_time"]
        
        # Record metrics
        operation_name = operation["name"]
        if operation_name not in self.operation_counts:
            self.operation_counts[operation_name] = {
                "count": 0,
                "total_time": 0.0,
                "min_time": float('inf'),
                "max_time": 0.0
            }
        
        stats = self.operation_counts[operation_name]
        stats["count"] += 1
        stats["total_time"] += duration
        stats["min_time"] = min(stats["min_time"], duration)
        stats["max_time"] = max(stats["max_time"], duration)
        
        # Clean up
        del self.operation_times[operation_id]
        
        return duration
    
    def get_performance_stats(self) -> Dict[str, Dict[str, float]]:
        """Get performance statistics"""
        stats = {}
        
        for operation_name, data in self.operation_counts.items():
            if data["count"] > 0:
                avg_time = data["total_time"] / data["count"]
                stats[operation_name] = {
                    "count": data["count"],
                    "avg_time": avg_time,
                    "min_time": data["min_time"],
                    "max_time": data["max_time"],
                    "total_time": data["total_time"]
                }
        
        return stats


class HealthChecker:
    """System health monitoring"""
    
    def __init__(self):
        self.last_check = 0
        self.health_status = {"status": "unknown"}
    
    async def get_health_status(self, force_refresh: bool = False) -> Dict[str, any]:
        """Get current health status"""
        current_time = time.time()
        
        # Refresh every 30 seconds or if forced
        if force_refresh or current_time - self.last_check > 30:
            await self._refresh_health_status()
            self.last_check = current_time
        
        return self.health_status
    
    async def _refresh_health_status(self):
        """Refresh health status by checking all components"""
        try:
            import psutil
            
            # System metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Check thresholds
            health_issues = []
            
            if cpu_percent > 90:
                health_issues.append("High CPU usage")
            
            if memory.percent > 90:
                health_issues.append("High memory usage")
            
            if disk.percent > 90:
                health_issues.append("High disk usage")
            
            # Determine overall status
            if not health_issues:
                status = "healthy"
            elif len(health_issues) <= 2:
                status = "degraded"
            else:
                status = "unhealthy"
            
            self.health_status = {
                "status": status,
                "issues": health_issues,
                "metrics": {
                    "cpu_percent": cpu_percent,
                    "memory_percent": memory.percent,
                    "disk_percent": disk.percent
                },
                "timestamp": time.time()
            }
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            self.health_status = {
                "status": "error",
                "error": str(e),
                "timestamp": time.time()
            }


# Global instances
metrics_collector = MetricsCollector()
performance_tracker = PerformanceTracker()
health_checker = HealthChecker()
