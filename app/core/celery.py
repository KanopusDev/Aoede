"""
Celery Configuration for Aoede
Handles background tasks and async processing
"""
import os
from celery import Celery
from app.core.config import settings

# Create Celery instance
celery_app = Celery(
    "aoede",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.code_generation",
        "app.tasks.testing",
        "app.tasks.model_health",
        "app.tasks.cleanup"
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task routing
    task_routes={
        "app.tasks.code_generation.*": {"queue": "code_generation"},
        "app.tasks.testing.*": {"queue": "testing"},
        "app.tasks.model_health.*": {"queue": "health_checks"},
        "app.tasks.cleanup.*": {"queue": "cleanup"}
    },
    
    # Task serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    
    # Task execution
    task_always_eager=False,
    task_eager_propagates=True,
    task_ignore_result=False,
    task_store_eager_result=True,
    
    # Task timeouts
    task_soft_time_limit=300,  # 5 minutes
    task_time_limit=600,       # 10 minutes
    
    # Worker configuration
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    worker_disable_rate_limits=False,
    
    # Result backend settings
    result_expires=3600,  # 1 hour
    result_backend_transport_options={
        "master_name": "mymaster",
        "visibility_timeout": 3600,
    },
    
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
    
    # Beat schedule for periodic tasks
    beat_schedule={
        "model-health-check": {
            "task": "app.tasks.model_health.check_all_models",
            "schedule": 300.0,  # Every 5 minutes
        },
        "cleanup-old-generations": {
            "task": "app.tasks.cleanup.cleanup_old_generations",
            "schedule": 3600.0,  # Every hour
        },
        "cleanup-old-test-results": {
            "task": "app.tasks.cleanup.cleanup_old_test_results",
            "schedule": 7200.0,  # Every 2 hours
        },
        "update-model-usage-stats": {
            "task": "app.tasks.model_health.update_usage_stats",
            "schedule": 900.0,  # Every 15 minutes
        }
    },
    timezone="UTC",
)

# Auto-discover tasks
celery_app.autodiscover_tasks()

@celery_app.task(bind=True)
def debug_task(self):
    """Debug task for testing Celery setup"""
    print(f"Request: {self.request!r}")
    return "Celery is working!"
