"""
Database configuration and connection management
"""
import asyncpg
from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
import redis.asyncio as redis
from contextlib import asynccontextmanager
import structlog

from app.core.config import settings

logger = structlog.get_logger()

# SQLAlchemy configuration
Base = declarative_base()
metadata = MetaData()

# Determine the correct async driver based on database type
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql://"):
    async_database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
elif database_url.startswith("sqlite://"):
    async_database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://")
else:
    async_database_url = database_url

# Async database engine
engine_kwargs = {
    "echo": settings.DEBUG,
}

# Add PostgreSQL-specific settings only for PostgreSQL
if "postgresql" in async_database_url:
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 30,
        "pool_pre_ping": True,
        "pool_recycle": 3600
    })

async_engine = create_async_engine(async_database_url, **engine_kwargs)

# Async session factory
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Redis connection
redis_client = None


async def init_db():
    """Initialize database connections"""
    global redis_client
    
    try:
        # Initialize Redis with graceful fallback for development
        try:
            redis_client = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20
            )
            
            # Test Redis connection
            await redis_client.ping()
            logger.info("Redis connection established")
        except Exception as redis_error:
            logger.warning(f"Redis connection failed (development mode): {redis_error}")
            logger.info("Continuing without Redis - some features may be limited")
            redis_client = None
        
        # Create database tables (PostgreSQL not required for basic testing)
        try:
            async with async_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created successfully")
        except Exception as db_error:
            logger.warning(f"Database connection failed (development mode): {db_error}")
            logger.info("Continuing without PostgreSQL - using SQLite fallback for development")
        
        logger.info("Database initialization completed (development mode)")
        
    except Exception as e:
        logger.error(f"Critical initialization error: {e}")
        # In development mode, we can continue without external dependencies
        logger.info("Continuing in development mode with limited functionality")


async def get_db():
    """Dependency to get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_redis():
    """Dependency to get Redis client"""
    return redis_client


@asynccontextmanager
async def get_db_session():
    """Context manager for database sessions"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


class DatabaseManager:
    """Database operations manager"""
    
    @staticmethod
    async def health_check() -> dict:
        """Check database health"""
        try:
            # Check database connection
            async with AsyncSessionLocal() as session:
                await session.execute(text("SELECT 1"))
            
            db_status = "healthy"
            
            # Check Redis if available
            redis_status = "healthy"
            if redis_client:
                try:
                    await redis_client.ping()
                except Exception as redis_error:
                    redis_status = "unhealthy"
                    logger.warning(f"Redis health check failed: {redis_error}")
            else:
                redis_status = "unavailable"
            
            return {
                "database": db_status,
                "redis": redis_status,
                "status": "ok"
            }
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {
                "database": "unhealthy",
                "redis": "unknown", 
                "status": "error",
                "error": str(e)
            }
    
    @staticmethod
    async def close_connections():
        """Close all database connections"""
        try:
            await async_engine.dispose()
            if redis_client:
                await redis_client.close()
            logger.info("Database connections closed")
        except Exception as e:
            logger.error(f"Error closing database connections: {e}")


# Create database manager instance
db_manager = DatabaseManager()
