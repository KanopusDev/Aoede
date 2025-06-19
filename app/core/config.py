"""
Core configuration settings using Pydantic Settings
"""
from pydantic_settings import BaseSettings
from pydantic import validator
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    DEBUG: bool = False
    ENVIRONMENT: str = "production"
    HOST: str = "0.0.0.0"
    PORT: int = 1297
    WORKERS: int = 4
    
    # Security
    SECRET_KEY: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1", "*"]
    
    # Database
    DATABASE_URL: str
    TEST_DATABASE_URL: Optional[str] = None
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI Models
    GITHUB_TOKEN: str
    GITHUB_AI_BASE_URL: str = "https://models.github.ai/inference"
    MAX_TOKENS: int = 4000
    SAFETY_BUFFER: int = 200
    AI_MODELS: str = "mistral-ai/Codestral-2501,openai/gpt-4.1,openai/gpt-4o,cohere/cohere-command-a"
    
    # Token Management & Chunking
    MAX_TOKENS_PER_REQUEST: int = 4000
    TOKEN_SAFETY_BUFFER: int = 200
    MAX_CHUNK_SIZE: int = 3500
    CHUNK_OVERLAP: int = 100
    
    # Code Generation Settings
    MAX_GENERATION_ITERATIONS: int = 5
    DEFAULT_TIMEOUT_SECONDS: int = 120
    CODE_EXECUTION_TIMEOUT: int = 30
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 100
    RATE_LIMIT_BURST: int = 20
    
    # Monitoring
    PROMETHEUS_PORT: int = 9090
    LOG_LEVEL: str = "INFO"
    
    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"
    
    # File Upload
    MAX_FILE_SIZE: int = 10485760  # 10MB
    UPLOAD_DIR: str = "uploads/"
    
    @validator("AI_MODELS")
    def parse_ai_models(cls, v):
        """Parse AI models from comma-separated string"""
        return [model.strip() for model in v.split(",")]
    
    @validator("ALLOWED_HOSTS")
    def parse_allowed_hosts(cls, v):
        """Parse allowed hosts"""
        if isinstance(v, str):
            return [host.strip() for host in v.split(",")]
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Create settings instance
settings = Settings()


# Model configurations
MODEL_CONFIGS = {
    "mistral-ai/Codestral-2501": {
        "type": "code_generation",
        "max_tokens": 4000,
        "temperature": 0.1,
        "priority": 1
    },
    "openai/gpt-4.1": {
        "type": "general_purpose",
        "max_tokens": 4000,
        "temperature": 0.3,
        "priority": 2
    },
    "openai/gpt-4o": {
        "type": "advanced_reasoning",
        "max_tokens": 4000,
        "temperature": 0.2,
        "priority": 1
    },
    "cohere/cohere-command-a": {
        "type": "text_processing",
        "max_tokens": 4000,
        "temperature": 0.4,
        "priority": 3
    }
}


# Error handling configurations
ERROR_CATEGORIES = {
    "SYNTAX_ERROR": "Code syntax issues",
    "RUNTIME_ERROR": "Execution failures",
    "DEPENDENCY_ERROR": "Missing imports/modules",
    "LOGIC_ERROR": "Incorrect implementation",
    "RESOURCE_ERROR": "Memory/timeout issues"
}


# Supported programming languages
SUPPORTED_LANGUAGES = {
    "python": {
        "extension": ".py",
        "executor": "python",
        "test_framework": "pytest"
    },
    "javascript": {
        "extension": ".js",
        "executor": "node",
        "test_framework": "jest"
    },
    "html": {
        "extension": ".html",
        "executor": "browser",
        "test_framework": "cypress"
    },
    "css": {
        "extension": ".css",
        "executor": "browser",
        "test_framework": "cypress"
    }
}
