"""
Code generation endpoints with IP-based rate limiting
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
import json

from app.services.code_generation import code_generation_service
from app.core.logging import get_logger
from app.models import Language
from app.middleware.rate_limit import check_ip_rate_limit

logger = get_logger(__name__)
router = APIRouter()


class CodeGenerationRequest(BaseModel):
    """Code generation request schema"""
    prompt: str = Field(..., min_length=1, max_length=10000)
    language: Language
    project_id: Optional[UUID] = None
    template_name: Optional[str] = None
    model: Optional[str] = None
    context: Optional[str] = None


class CodeGenerationResponse(BaseModel):
    """Code generation response schema"""
    generation_id: Optional[str]
    code: str
    language: str
    validation_result: Dict[str, Any]
    metadata: Dict[str, Any]
    generation_time: float
    success: bool
    error: Optional[str] = None


class CodeValidationRequest(BaseModel):
    """Code validation request schema"""
    code: str = Field(..., min_length=1)
    language: Language


class CodeValidationResponse(BaseModel):
    """Code validation response schema"""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    suggestions: List[str]


@router.post("/code", response_model=CodeGenerationResponse)
async def generate_code(
    request: CodeGenerationRequest,
    req: Request,
    rate_info: dict = Depends(check_ip_rate_limit)
):
    """Generate code based on prompt with IP-based rate limiting"""
    try:
        client_ip = req.headers.get("X-Forwarded-For", req.client.host if req.client else "unknown")
        logger.info(f"Generating {request.language.value} code for project {request.project_id} from IP: {client_ip}")
        
        # Generate code
        result = await code_generation_service.generate_code(
            prompt=request.prompt,
            language=request.language.value,
            project_id=str(request.project_id) if request.project_id else None,
            template_name=request.template_name,
            model=request.model
        )
        
        return CodeGenerationResponse(
            generation_id=result.metadata.get("generation_id"),
            code=result.code,
            language=result.language,
            validation_result={
                "is_valid": result.validation_result.is_valid,
                "errors": result.validation_result.errors,
                "warnings": result.validation_result.warnings,
                "suggestions": result.validation_result.suggestions
            },
            metadata=result.metadata,
            generation_time=result.generation_time,
            success=True
        )
        
    except Exception as e:
        logger.error(f"Code generation failed: {e}")
        return CodeGenerationResponse(
            generation_id=None,
            code="",
            language=request.language.value,
            validation_result={"is_valid": False, "errors": [str(e)], "warnings": [], "suggestions": []},
            metadata={},
            generation_time=0.0,
            success=False,
            error=str(e)
        )


@router.post("/validate", response_model=CodeValidationResponse)
async def validate_code(request: CodeValidationRequest):
    """Validate code syntax and quality"""
    try:
        logger.info(f"Validating {request.language.value} code")
        
        # Validate code
        validation_result = await code_generation_service.validator.validate_code(
            request.code,
            request.language.value
        )
        
        return CodeValidationResponse(
            is_valid=validation_result.is_valid,
            errors=validation_result.errors,
            warnings=validation_result.warnings,
            suggestions=validation_result.suggestions
        )
        
    except Exception as e:
        logger.error(f"Code validation failed: {e}")
        return CodeValidationResponse(
            is_valid=False,
            errors=[str(e)],
            warnings=[],
            suggestions=[]
        )


@router.post("/improve")
async def improve_code(
    code: str = Form(...),
    language: Language = Form(...),
    improvement_type: str = Form(...),
    project_id: Optional[UUID] = Form(None)
):
    """Improve existing code based on suggestions"""
    try:
        logger.info(f"Improving {language.value} code with type: {improvement_type}")
        
        # Create improvement prompt
        improvement_prompts = {
            "performance": "Optimize this code for better performance",
            "readability": "Improve code readability and add documentation", 
            "security": "Enhance code security and fix vulnerabilities",
            "best_practices": "Apply best practices and coding standards",
            "error_handling": "Add proper error handling and validation"
        }
        
        prompt = improvement_prompts.get(improvement_type, "Improve this code")
        full_prompt = f"{prompt}:\n\n{code}"
        
        # Generate improved code
        result = await code_generation_service.generate_code(
            prompt=full_prompt,
            language=language.value,
            project_id=str(project_id) if project_id else None
        )
        
        return {
            "success": True,
            "original_code": code,
            "improved_code": result.code,
            "improvements_applied": improvement_type,
            "validation_result": {
                "is_valid": result.validation_result.is_valid,
                "errors": result.validation_result.errors,
                "warnings": result.validation_result.warnings,
                "suggestions": result.validation_result.suggestions
            },
            "generation_time": result.generation_time
        }
        
    except Exception as e:
        logger.error(f"Code improvement failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "original_code": code
        }


@router.post("/from-file")
async def generate_from_file(
    file: UploadFile = File(...),
    language: Language = Form(...),
    prompt: str = Form(...),
    project_id: Optional[UUID] = Form(None)
):
    """Generate code based on uploaded file content"""
    try:
        # Read file content
        content = await file.read()
        file_content = content.decode('utf-8')
        
        logger.info(f"Generating {language.value} code from file: {file.filename}")
        
        # Create context with file content
        context = f"Based on the following file content from {file.filename}:\n\n{file_content}\n\n"
        full_prompt = context + prompt
        
        # Generate code
        result = await code_generation_service.generate_code(
            prompt=full_prompt,
            language=language.value,
            project_id=str(project_id) if project_id else None
        )
        
        return {
            "success": True,
            "source_file": file.filename,
            "generated_code": result.code,
            "language": result.language,
            "validation_result": {
                "is_valid": result.validation_result.is_valid,
                "errors": result.validation_result.errors,
                "warnings": result.validation_result.warnings,
                "suggestions": result.validation_result.suggestions
            },
            "metadata": result.metadata,
            "generation_time": result.generation_time
        }
        
    except Exception as e:
        logger.error(f"File-based generation failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "source_file": file.filename if file else "unknown"
        }


@router.get("/templates/{language}")
async def get_templates(language: Language):
    """Get available templates for a language"""
    try:
        templates = code_generation_service.template_engine.templates.get(language.value, {})
        
        return {
            "language": language.value,
            "templates": list(templates.keys()),
            "template_details": {
                name: {"description": f"{name.replace('_', ' ').title()} template"}
                for name in templates.keys()
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get templates for {language.value}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preview-template")
async def preview_template(
    language: Language = Form(...),
    template_name: str = Form(...),
    parameters: str = Form("{}")  # JSON string of parameters
):
    """Preview a template with sample parameters"""
    try:
        # Parse parameters
        template_params = json.loads(parameters)
        
        # Get template
        template = code_generation_service.template_engine.get_template(
            language.value, template_name
        )
        
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        # Fill template with parameters
        try:
            preview_code = code_generation_service.template_engine.fill_template(
                template, **template_params
            )
        except KeyError as e:
            return {
                "success": False,
                "error": f"Missing required parameter: {e}",
                "template": template,
                "required_parameters": []  # Would extract from template
            }
        
        return {
            "success": True,
            "language": language.value,
            "template_name": template_name,
            "preview_code": preview_code,
            "parameters_used": template_params
        }
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in parameters")
    except Exception as e:
        logger.error(f"Template preview failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dependencies/{language}")
async def analyze_dependencies(
    code: str,
    language: Language
):
    """Analyze code dependencies"""
    try:
        dependencies = code_generation_service.dependency_resolver.get_dependencies(
            code, language.value
        )
        
        return {
            "language": language.value,
            "dependencies": dependencies,
            "dependency_count": len(dependencies),
            "analysis": {
                "external_packages": [dep for dep in dependencies if not dep.startswith('.')],
                "local_imports": [dep for dep in dependencies if dep.startswith('.')]
            }
        }
        
    except Exception as e:
        logger.error(f"Dependency analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/generation/{generation_id}")
async def get_generation(generation_id: UUID):
    """Get details of a specific code generation"""
    try:
        # This would query the database for the generation
        # Simplified for now
        return {
            "generation_id": str(generation_id),
            "status": "completed",
            "message": "Generation details would be returned here"
        }
        
    except Exception as e:
        logger.error(f"Failed to get generation {generation_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
