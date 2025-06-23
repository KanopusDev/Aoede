"""
Security middleware for Aoede application
"""
import time
import hashlib
import hmac
import secrets
import re
from typing import Dict, Optional, List
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class SecurityMiddleware(BaseHTTPMiddleware):
    """Security middleware with multiple protection layers"""
    def __init__(self, app):
        super().__init__(app)
        self.csrf_tokens = {}  # In production, use Redis
        self.request_signatures = {}  # Track request signatures for replay attack prevention
        
    async def dispatch(self, request: Request, call_next):
        # Security headers and checks
        security_result = await self._apply_security_checks(request)
        
        if security_result.get("blocked"):
            return Response(
                content='{"error": "Security check failed", "detail": "Request blocked"}',
                status_code=403,
                headers={"Content-Type": "application/json"}
            )
        
        # Continue with request
        response = await call_next(request)
        
        # Add security headers to response (context-aware)
        self._add_security_headers(response, request)
        
        return response
    
    async def _apply_security_checks(self, request: Request) -> Dict[str, bool]:
        """Apply various security checks"""
        
        # 1. Content length check
        if not self._check_content_length(request):
            logger.warning(f"Request blocked: Content too large from {request.client.host}")
            return {"blocked": True, "reason": "content_too_large"}
        
        # 2. Check for suspicious patterns
        if self._check_suspicious_patterns(request):
            logger.warning(f"Request blocked: Suspicious pattern detected from {request.client.host}")
            return {"blocked": True, "reason": "suspicious_pattern"}
        
        # 3. CSRF protection for state-changing operations
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            if not await self._check_csrf_protection(request):
                logger.warning(f"Request blocked: CSRF check failed from {request.client.host}")
                return {"blocked": True, "reason": "csrf_failure"}
        
        # 4. Request signature check (for API endpoints)
        if request.url.path.startswith("/api/"):
            if not self._check_request_signature(request):
                logger.warning(f"Request blocked: Invalid signature from {request.client.host}")
                return {"blocked": True, "reason": "invalid_signature"}
        
        return {"blocked": False}
    
    def _check_content_length(self, request: Request) -> bool:
        """Check if content length is within acceptable limits"""
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length = int(content_length)
                return length <= settings.MAX_FILE_SIZE
            except ValueError:
                return False
        return True
    
    def _check_suspicious_patterns(self, request: Request) -> bool:
        """Check for suspicious patterns in request"""
        suspicious_patterns = [
            # SQL injection patterns
            "union select", "drop table", "delete from", "insert into",
            "update set", "create table", "alter table",
            
            # XSS patterns
            "<script", "javascript:", "onload=", "onerror=", "onclick=",
            
            # Path traversal
            "../", "..\\", "%2e%2e", "..%2f", "..%5c",
            
            # Command injection
            "; cat", "| cat", "&& cat", "$(", "`", "exec(",
            
            # Common attack tools
            "nmap", "sqlmap", "nikto", "dirb", "gobuster"
        ]
        
        # Check URL path
        path_lower = request.url.path.lower()
        query_lower = str(request.url.query).lower()
        
        for pattern in suspicious_patterns:
            if pattern in path_lower or pattern in query_lower:
                return True
        
        # Check headers
        for header_name, header_value in request.headers.items():
            header_lower = header_value.lower()
            for pattern in suspicious_patterns:
                if pattern in header_lower:
                    return True
        
        return False
    
    async def _check_csrf_protection(self, request: Request) -> bool:
        """Check CSRF protection for state-changing operations"""
        # Skip CSRF for API endpoints with proper authentication
        if request.url.path.startswith("/api/v1/"):
            # In production, check for proper API authentication
            return True
        
        # Check for CSRF token in headers or form data
        csrf_token = request.headers.get("X-CSRF-Token")
        
        if not csrf_token:
            # Try to get from form data (for multipart requests)
            try:
                form_data = await request.form()
                csrf_token = form_data.get("csrf_token")
            except:
                pass
        
        if not csrf_token:
            return False
        
        # Validate CSRF token
        return self._validate_csrf_token(csrf_token, request)
    
    def _validate_csrf_token(self, token: str, request: Request) -> bool:
        """Validate CSRF token"""
        # Simple validation - in production use proper CSRF implementation
        # This is a simplified version
        client_ip = request.client.host if request.client else "unknown"
        expected_tokens = self.csrf_tokens.get(client_ip, [])
        
        # Generate a valid token for this request (simplified)
        current_time = int(time.time() / 300)  # 5-minute windows
        valid_token = hashlib.sha256(
            f"{client_ip}:{current_time}:{settings.SECRET_KEY}".encode()
        ).hexdigest()[:16]
        
        return token == valid_token or token in expected_tokens
    
    def _check_request_signature(self, request: Request) -> bool:
        """Check request signature to prevent replay attacks"""
        # Skip for GET requests and health checks
        if request.method == "GET" or request.url.path.startswith("/health"):
            return True
        
        # Get signature from header
        signature = request.headers.get("X-Request-Signature")
        timestamp = request.headers.get("X-Request-Timestamp")
        
        if not signature or not timestamp:
            # For now, allow requests without signature
            # In production, this should be required for authenticated endpoints
            return True
        
        try:
            request_time = int(timestamp)
            current_time = int(time.time())
            
            # Check if request is too old (5 minutes)
            if current_time - request_time > 300:
                return False
            
            # Create request signature
            request_data = f"{request.method}:{request.url.path}:{timestamp}"
            expected_signature = hmac.new(
                settings.SECRET_KEY.encode(),
                request_data.encode(),
                hashlib.sha256
            ).hexdigest()
            
            # Check if we've seen this exact signature before (replay attack)
            signature_key = f"{signature}:{timestamp}"
            if signature_key in self.request_signatures:
                return False
            
            # Store signature (with cleanup for old signatures)
            self.request_signatures[signature_key] = current_time
            self._cleanup_old_signatures()
            
            return hmac.compare_digest(signature, expected_signature)
            
        except (ValueError, TypeError):
            return False
    
    def _cleanup_old_signatures(self):
        """Clean up old request signatures"""
        current_time = int(time.time())
        # Remove signatures older than 10 minutes
        cutoff_time = current_time - 600
        
        keys_to_remove = [
            key for key, timestamp in self.request_signatures.items()
            if timestamp < cutoff_time        ]
        
        for key in keys_to_remove:
            del self.request_signatures[key]
    
    def _add_security_headers(self, response: Response, request: Request = None):
        """Add security headers to response (context-aware)"""
        
        # Determine if this is a documentation page
        is_docs_page = False
        if request and hasattr(request.url, 'path'):
            docs_paths = ['/docs', '/redoc', '/api/docs', '/api/redoc']
            is_docs_page = any(request.url.path.startswith(path) for path in docs_paths)
        
        # Base security headers
        security_headers = {
            # Prevent MIME type sniffing
            "X-Content-Type-Options": "nosniff",
            
            # XSS protection
            "X-XSS-Protection": "1; mode=block",
            
            # Frame options (prevent clickjacking)
            "X-Frame-Options": "DENY",
            
            # HSTS (force HTTPS) - only in production
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains" if not settings.DEBUG else "max-age=0",
            
            # Referrer policy
            "Referrer-Policy": "strict-origin-when-cross-origin",
            
            # Permissions policy
            "Permissions-Policy": (
                "camera=(), microphone=(), geolocation=(), "
                "payment=(), usb=(), magnetometer=(), gyroscope=()"
            )
        }          # Content Security Policy - different for docs pages
        if is_docs_page:
            # More permissive CSP for documentation pages
            security_headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
                "https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com "
                "https://fonts.googleapis.com https://cdn.redoc.ly data: blob:; "
                "style-src 'self' 'unsafe-inline' "
                "https://cdn.jsdelivr.net https://unpkg.com https://cdnjs.cloudflare.com "
                "https://fonts.googleapis.com https://cdn.redoc.ly data: blob:; "
                "img-src 'self' data: https: blob:; "
                "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:; "
                "connect-src 'self' https: wss: ws:; "
                "worker-src 'self' blob: data:; "
                "child-src 'self' blob: data:; "
                "frame-ancestors 'none'; "
                "object-src 'none'; "
                "base-uri 'self'; "
                "manifest-src 'self';"
            )
        else:            # Standard CSP for regular pages
            security_headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
                "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://static.cloudflareinsights.com "
                "https://cdn.tailwindcss.com https://cdn.redoc.ly; "
                "style-src 'self' 'unsafe-inline' "
                "https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com "
                "https://cdn.tailwindcss.com https://cdn.redoc.ly; "
                "img-src 'self' data: https:; "
                "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
                "connect-src 'self' https:; "
                "worker-src 'self'; "
                "child-src 'self'; "
                "frame-ancestors 'none'; "
                "object-src 'none'; "
                "base-uri 'self';"
            )
        
        for header_name, header_value in security_headers.items():
            response.headers[header_name] = header_value


class InputSanitizer:
    """Input sanitization utilities"""
    
    @staticmethod
    def sanitize_string(input_str: str, max_length: int = 1000) -> str:
        """Sanitize string input"""
        if not isinstance(input_str, str):
            return ""
        
        # Truncate to max length
        sanitized = input_str[:max_length]
        
        # Remove null bytes
        sanitized = sanitized.replace('\x00', '')
        
        # Remove control characters (except newline, tab, carriage return)
        sanitized = ''.join(
            char for char in sanitized
            if ord(char) >= 32 or char in '\n\t\r'
        )
        
        return sanitized.strip()
    
    @staticmethod
    def sanitize_code(code: str) -> str:
        """Sanitize code input with additional checks"""
        if not isinstance(code, str):
            return ""
        
        # Basic sanitization
        sanitized = InputSanitizer.sanitize_string(code, max_length=50000)
        
        # Check for potentially dangerous patterns
        dangerous_patterns = [
            "import os", "import subprocess", "import sys",
            "exec(", "eval(", "__import__",
            "open(", "file(", "input(",
            "raw_input(", "compile(",
        ]
        
        # Log suspicious patterns but don't block (for code generation)
        for pattern in dangerous_patterns:
            if pattern in sanitized.lower():
                logger.warning(f"Potentially dangerous pattern detected: {pattern}")
        
        return sanitized
    
    @staticmethod
    def validate_uuid(uuid_str: str) -> bool:
        """Validate UUID format"""
        import re
        uuid_pattern = re.compile(
            r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
            re.IGNORECASE
        )
        return bool(uuid_pattern.match(uuid_str))
    
    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename for safe file operations"""
        if not isinstance(filename, str):
            return "unknown"
        
        # Remove path separators and dangerous characters
        sanitized = re.sub(r'[^\w\-_\.]', '_', filename)
        
        # Remove leading dots (hidden files)
        sanitized = sanitized.lstrip('.')
        
        # Ensure not empty
        if not sanitized:
            sanitized = "file"
        
        # Truncate to reasonable length
        return sanitized[:100]
