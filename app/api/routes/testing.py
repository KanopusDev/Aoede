"""
Testing endpoints
"""
from fastapi import APIRouter, HTTPException, Form
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from uuid import UUID

from app.services.testing_validation import testing_validation_service
from app.core.logging import get_logger
from app.models import Language

logger = get_logger(__name__)
router = APIRouter()


class TestRequest(BaseModel):
    """Test request schema"""
    code: str = Field(..., min_length=1)
    language: Language
    generation_id: Optional[UUID] = None
    custom_tests: Optional[str] = None


class TestResponse(BaseModel):
    """Test response schema"""
    success: bool
    validation_result: Optional[Dict[str, Any]]
    test_results: Optional[Dict[str, Any]]
    final_code: str
    total_iterations: int
    execution_time: float
    error: Optional[str] = None


@router.post("/execute", response_model=TestResponse)
async def execute_tests(request: TestRequest):
    """Execute comprehensive testing suite"""
    try:
        logger.info(f"Running tests for {request.language.value} code")
        
        # Run comprehensive test
        result = await testing_validation_service.run_comprehensive_test(
            code=request.code,
            language=request.language.value,
            generation_id=str(request.generation_id) if request.generation_id else None,
            custom_tests=request.custom_tests
        )
        
        if result["status"] == "success":
            return TestResponse(
                success=True,
                validation_result=result["validation_result"],
                test_results=result.get("test_results"),
                final_code=result["final_code"],
                total_iterations=result["validation_result"]["iterations"],
                execution_time=sum(
                    r["execution_result"].execution_time 
                    for r in result["validation_result"]["results"]
                )
            )
        else:
            return TestResponse(
                success=False,
                validation_result=result,
                test_results=None,
                final_code=result.get("code", request.code),
                total_iterations=result.get("iterations", 0),
                execution_time=0.0,
                error=result.get("message", "Test execution failed")
            )
            
    except Exception as e:
        logger.error(f"Test execution failed: {e}")
        return TestResponse(
            success=False,
            validation_result=None,
            test_results=None,
            final_code=request.code,
            total_iterations=0,
            execution_time=0.0,
            error=str(e)
        )


@router.post("/validate-only")
async def validate_only(
    code: str = Form(...),
    language: Language = Form(...),
    max_iterations: int = Form(5)
):
    """Run validation and fixing without unit tests"""
    try:
        logger.info(f"Validating {language.value} code with max {max_iterations} iterations")
        
        # Run iterative validation
        result = await testing_validation_service.validator.validate_and_fix(
            code=code,
            language=language.value,
            max_iterations=max_iterations
        )
        
        return {
            "success": result["status"] == "success",
            "final_code": result["code"],
            "iterations": result["iterations"],
            "status": result["status"],
            "results": result.get("results", []),
            "final_error": result.get("final_error")
        }
        
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "final_code": code
        }


@router.post("/unit-tests")
async def run_unit_tests(
    code: str = Form(...),
    language: Language = Form(...),
    test_code: Optional[str] = Form(None)
):
    """Run unit tests for code"""
    try:
        logger.info(f"Running unit tests for {language.value} code")
        
        if language == Language.PYTHON:
            result = await testing_validation_service.test_runner.run_python_tests(
                code, test_code
            )
            
            return {
                "success": result.success,
                "passed_tests": result.passed_tests,
                "failed_tests": result.failed_tests,
                "total_tests": result.total_tests,
                "test_details": result.test_details,
                "execution_time": result.execution_time,
                "errors": result.errors
            }
        else:
            return {
                "success": False,
                "error": f"Unit tests not supported for {language.value} yet",
                "passed_tests": 0,
                "failed_tests": 0,
                "total_tests": 0
            }
            
    except Exception as e:
        logger.error(f"Unit tests failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "passed_tests": 0,
            "failed_tests": 0,
            "total_tests": 0
        }


@router.post("/execute-code")
async def execute_code(
    code: str = Form(...),
    language: Language = Form(...),
    timeout: int = Form(30)
):
    """Execute code in safe environment"""
    try:
        logger.info(f"Executing {language.value} code")
        
        # Execute code based on language
        if language == Language.PYTHON:
            result = await testing_validation_service.executor.execute_python(code, timeout)
        elif language == Language.JAVASCRIPT:
            result = await testing_validation_service.executor.execute_javascript(code, timeout)
        elif language == Language.HTML:
            result = await testing_validation_service.executor.execute_html(code)
        elif language == Language.CSS:
            result = await testing_validation_service.executor.execute_css(code)
        else:
            return {
                "success": False,
                "error": f"Execution not supported for {language.value}",
                "stdout": "",
                "stderr": "",
                "exit_code": -1
            }
        
        return {
            "success": result.success,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.exit_code,
            "execution_time": result.execution_time,
            "error_type": result.error_type
        }
        
    except Exception as e:
        logger.error(f"Code execution failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "stdout": "",
            "stderr": "",
            "exit_code": -1,
            "execution_time": 0.0
        }


@router.post("/fix-errors")
async def fix_errors(
    code: str = Form(...),
    language: Language = Form(...),
    error_message: str = Form(...),
    error_type: str = Form("RUNTIME_ERROR")
):
    """Generate fix for specific error"""
    try:
        logger.info(f"Generating fix for {error_type} in {language.value} code")
        
        # Analyze error
        error_analysis = testing_validation_service.validator.analyzer.analyze_error(
            error_message, error_type, code
        )
        
        # Generate fix
        fix_result = await testing_validation_service.validator.fix_generator.generate_fix(
            code, error_analysis, language.value, 1
        )
        
        return {
            "success": fix_result.fix_applied,
            "original_code": code,
            "fixed_code": fix_result.fixed_code,
            "fix_description": fix_result.fix_description,
            "error_analysis": error_analysis
        }
        
    except Exception as e:
        logger.error(f"Error fixing failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "original_code": code,
            "fixed_code": code
        }


@router.get("/generation/{generation_id}/test-results")
async def get_test_results(generation_id: UUID):
    """Get test results for a specific generation"""
    try:
        # This would query the database for test results
        # Simplified for now
        return {
            "generation_id": str(generation_id),
            "test_results": [],
            "message": "Test results would be returned here"
        }
        
    except Exception as e:
        logger.error(f"Failed to get test results for {generation_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/supported-languages")
async def get_supported_languages():
    """Get list of supported languages for testing"""
    return {
        "supported_languages": [lang.value for lang in Language],
        "capabilities": {
            "python": {
                "syntax_validation": True,
                "execution": True,
                "unit_tests": True,
                "error_fixing": True
            },
            "javascript": {
                "syntax_validation": True,
                "execution": True,
                "unit_tests": False,
                "error_fixing": True
            },
            "html": {
                "syntax_validation": True,
                "execution": True,
                "unit_tests": False,
                "error_fixing": True
            },
            "css": {
                "syntax_validation": True,
                "execution": True,
                "unit_tests": False,
                "error_fixing": True
            }
        }
    }
