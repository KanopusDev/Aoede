"""
Enterprise-grade IP-based rate limiting middleware for GitHub token protection
"""
import time
import asyncio
import hashlib
from typing import Dict, Optional, Tuple
from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis
from collections import defaultdict

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class IPRateLimiter:
    """
    Production-grade IP-based rate limiting to protect GitHub tokens
    Implements sliding window with burst protection
    """
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis_client = redis_client
        # In-memory fallback for high availability
        self.memory_cache = defaultdict(list)
        self.memory_lock = asyncio.Lock()
        
        # Rate limits for different endpoints (per IP per minute)
        self.rate_limits = {
            "ai_generation": {"requests": 10, "window": 60, "burst": 15},
            "model_test": {"requests": 20, "window": 60, "burst": 25}, 
            "health_check": {"requests": 100, "window": 60, "burst": 120},
            "general": {"requests": 50, "window": 60, "burst": 60}
        }
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract real client IP considering proxies"""
        # Check for forwarded IP headers (for production deployments)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
            
        # Fallback to direct connection IP
        return request.client.host if request.client else "unknown"
    
    def _get_rate_limit_category(self, path: str, method: str) -> str:
        """Categorize request for appropriate rate limiting"""
        if "/api/v1/generate" in path or "/ai/" in path:
            return "ai_generation"
        elif "/api/v1/models/test" in path:
            return "model_test"
        elif "/health" in path or "/api/v1/health" in path:
            return "health_check"
        else:
            return "general"
    
    def _create_rate_limit_key(self, ip: str, category: str) -> str:
        """Create Redis key for rate limiting"""
        # Hash IP for privacy in logs
        ip_hash = hashlib.sha256(ip.encode()).hexdigest()[:12]
        return f"rate_limit:{category}:{ip_hash}"
    
    async def _redis_rate_limit(
        self, 
        key: str, 
        limit: int, 
        window: int, 
        burst: int, 
        current_time: int
    ) -> Tuple[bool, Dict[str, int]]:
        """Redis-based sliding window rate limiting"""
        try:
            pipe = self.redis_client.pipeline()
            
            # Remove old entries outside the window
            pipe.zremrangebyscore(key, 0, current_time - window)
            
            # Count current requests in window
            pipe.zcard(key)
            
            # Add current request
            pipe.zadd(key, {str(current_time): current_time})
            
            # Set expiry for cleanup
            pipe.expire(key, window + 10)
            
            results = await pipe.execute()
            current_count = results[1]
            
            # Check limits
            allowed = current_count <= limit
            burst_allowed = current_count <= burst
            
            if not burst_allowed:
                # Remove the request we just added if over burst
                await self.redis_client.zrem(key, str(current_time))
                return False, {
                    "limit": limit,
                    "burst": burst,
                    "current": current_count,
                    "reset_time": current_time + window,
                    "retry_after": 60
                }
            
            return allowed, {
                "limit": limit,
                "burst": burst, 
                "current": current_count + 1,
                "reset_time": current_time + window,
                "retry_after": 0 if allowed else 60
            }
            
        except Exception as e:
            logger.warning(f"Redis rate limiting failed: {e}, falling back to memory")
            return await self._memory_rate_limit(key, limit, window, burst, current_time)
    
    async def _memory_rate_limit(
        self,
        key: str,
        limit: int,
        window: int, 
        burst: int,
        current_time: int
    ) -> Tuple[bool, Dict[str, int]]:
        """Memory-based fallback rate limiting"""
        async with self.memory_lock:
            # Clean old entries
            cutoff = current_time - window
            self.memory_cache[key] = [
                timestamp for timestamp in self.memory_cache[key] 
                if timestamp > cutoff
            ]
            
            current_count = len(self.memory_cache[key])
            
            # Check burst limit first
            if current_count >= burst:
                return False, {
                    "limit": limit,
                    "burst": burst,
                    "current": current_count,
                    "reset_time": current_time + window,
                    "retry_after": 60
                }
            
            # Add current request
            self.memory_cache[key].append(current_time)
            allowed = current_count < limit
            
            return allowed, {
                "limit": limit,
                "burst": burst,
                "current": current_count + 1,
                "reset_time": current_time + window,
                "retry_after": 0 if allowed else 60
            }
    
    async def check_rate_limit(self, request: Request) -> Tuple[bool, Dict[str, int]]:
        """
        Check if request is allowed based on IP rate limits
        Returns (allowed, rate_limit_info)
        """
        client_ip = self._get_client_ip(request)
        category = self._get_rate_limit_category(request.url.path, request.method)
        limits = self.rate_limits[category]
        
        key = self._create_rate_limit_key(client_ip, category)
        current_time = int(time.time())
        
        if self.redis_client:
            return await self._redis_rate_limit(
                key, 
                limits["requests"], 
                limits["window"], 
                limits["burst"], 
                current_time
            )
        else:
            return await self._memory_rate_limit(
                key,
                limits["requests"],
                limits["window"], 
                limits["burst"],
                current_time
            )


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for IP-based rate limiting"""
    
    def __init__(self, app, redis_client: Optional[redis.Redis] = None):
        super().__init__(app)
        self.rate_limiter = IPRateLimiter(redis_client)
        
    async def dispatch(self, request: Request, call_next):
        """Process request with rate limiting"""
        
        # Skip rate limiting for static files and health checks in development
        if (request.url.path.startswith("/static/") or 
            request.url.path == "/" or
            (settings.DEBUG and request.url.path.startswith("/docs"))):
            return await call_next(request)
        
        # Check rate limit
        allowed, rate_info = await self.rate_limiter.check_rate_limit(request)
        
        if not allowed:
            logger.warning(
                f"Rate limit exceeded for IP {self.rate_limiter._get_client_ip(request)} "
                f"on {request.url.path}: {rate_info['current']}/{rate_info['limit']}"
            )
            
            response = Response(
                content='{"error":"Rate limit exceeded","message":"Too many requests from this IP address. Please try again later."}',
                status_code=429,
                media_type="application/json"
            )
            
            # Add rate limit headers
            response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
            response.headers["X-RateLimit-Remaining"] = str(max(0, rate_info["limit"] - rate_info["current"]))
            response.headers["X-RateLimit-Reset"] = str(rate_info["reset_time"])
            response.headers["Retry-After"] = str(rate_info["retry_after"])
            
            return response
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers to successful responses
        if hasattr(response, 'headers'):
            response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
            response.headers["X-RateLimit-Remaining"] = str(max(0, rate_info["limit"] - rate_info["current"]))
            response.headers["X-RateLimit-Reset"] = str(rate_info["reset_time"])
        
        return response


# Create rate limiter instance for use in routes
rate_limiter = None

async def init_rate_limiter(redis_client: Optional[redis.Redis] = None):
    """Initialize the rate limiter"""
    global rate_limiter
    rate_limiter = IPRateLimiter(redis_client)
    logger.info("IP-based rate limiter initialized for GitHub token protection")

async def check_ip_rate_limit(request: Request):
    """
    Dependency for checking rate limits in routes
    Usage: Depends(check_ip_rate_limit)
    """
    if rate_limiter is None:
        await init_rate_limiter()
    
    allowed, rate_info = await rate_limiter.check_rate_limit(request)
    
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "message": "Too many requests from this IP address. Please try again later.",
                "retry_after": rate_info["retry_after"],
                "limit": rate_info["limit"],
                "current": rate_info["current"]
            },
            headers={
                "X-RateLimit-Limit": str(rate_info["limit"]),
                "X-RateLimit-Remaining": str(max(0, rate_info["limit"] - rate_info["current"])),
                "X-RateLimit-Reset": str(rate_info["reset_time"]),
                "Retry-After": str(rate_info["retry_after"])
            }
        )
    
    return rate_info
