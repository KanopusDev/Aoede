"""
Background tasks for code testing and validation
"""
import asyncio
import logging
from typing import Dict, Any
from celery import Task

from app.core.celery import celery_app
from app.services.tester import testing_validation_service
from app.api.routes.websocket import broadcast_test_results

logger = logging.getLogger(__name__)

class TestingCallbackTask(Task):
    """Custom task class for Testing WebSocket callbacks"""
    
    def on_success(self, retval, task_id, args, kwargs):
        """Called when task succeeds"""
        asyncio.create_task(
            broadcast_test_results(task_id, {
                "status": "completed",
                "result": retval
            })
        )
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails"""
        asyncio.create_task(
            broadcast_test_results(task_id, {
                "status": "failed",
                "error": str(exc)
            })
        )


@celery_app.task(base=TestingCallbackTask, bind=True)
def run_comprehensive_test_async(self, test_request: Dict[str, Any]):
    """
    Asynchronous comprehensive test execution task
    """
    try:
        logger.info(f"Starting async code testing: {self.request.id}")
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"status": "Starting code testing", "progress": 0}
        )
        
        # Extract parameters
        code = test_request.get("code")
        language = test_request.get("language")
        generation_id = test_request.get("generation_id")
        custom_tests = test_request.get("custom_tests")
        
        if not code or not language:
            raise ValueError("Missing required parameters: code and language")
            
        # Run test in a non-async way (Celery worker context)
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(
            testing_validation_service.run_comprehensive_test(
                code=code,
                language=language,
                generation_id=generation_id,
                custom_tests=custom_tests
            )
        )
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"status": "Test execution completed", "progress": 100}
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Test execution failed: {str(e)}")
        raise


@celery_app.task(bind=True)
def run_test_suite_async(self, suite_request: Dict[str, Any]):
    """
    Run a test suite with multiple test cases
    """
    try:
        logger.info(f"Starting async test suite: {self.request.id}")
        
        # Extract parameters
        code = suite_request.get("code")
        language = suite_request.get("language")
        test_cases = suite_request.get("test_cases", [])
        
        if not code or not language or not test_cases:
            raise ValueError("Missing required parameters: code, language, and test_cases")
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"status": "Starting test suite", "progress": 0}
        )
        
        results = []
        total_tests = len(test_cases)
        
        # Run each test case
        for i, test_case in enumerate(test_cases):
            # Execute test
            loop = asyncio.get_event_loop()
            result = loop.run_until_complete(
                testing_validation_service.run_single_test(
                    code=code,
                    language=language,
                    test_input=test_case.get("input"),
                    expected_output=test_case.get("expected_output"),
                    test_name=test_case.get("name", f"Test {i+1}")
                )
            )
            
            results.append(result)
            
            # Update progress
            progress = int((i + 1) / total_tests * 100)
            self.update_state(
                state="PROGRESS",
                meta={
                    "status": f"Executed test {i+1}/{total_tests}",
                    "progress": progress
                }
            )
        
        # Summarize results
        passed = sum(1 for r in results if r.get("status") == "passed")
        failed = sum(1 for r in results if r.get("status") == "failed")
        errors = sum(1 for r in results if r.get("status") == "error")
        
        return {
            "status": "completed",
            "summary": {
                "total": total_tests,
                "passed": passed,
                "failed": failed,
                "errors": errors,
                "success_rate": round(passed / total_tests * 100, 2) if total_tests > 0 else 0
            },
            "results": results
        }
        
    except Exception as e:
        logger.error(f"Test suite execution failed: {str(e)}")
        raise
