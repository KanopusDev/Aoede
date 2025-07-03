"""
Code Generation Service
Handles code generation, validation, and management
"""
import ast
import re
import tempfile
import os
import subprocess
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from pathlib import Path
import time

from app.core.config import settings, SUPPORTED_LANGUAGES
from app.core.logging import get_logger
from app.services.models import ai_model_service
from app.models import CodeGeneration, Project, Language
from app.core.database import get_db_session

logger = get_logger(__name__)


@dataclass
class CodeValidationResult:
    """Code validation result"""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    suggestions: List[str]


@dataclass
class GenerationResult:
    """Code generation result"""
    code: str
    language: str
    validation_result: CodeValidationResult
    metadata: Dict[str, Any]
    generation_time: float


class SyntaxValidator:
    """Validate code syntax for different languages"""
    
    async def validate_python(self, code: str) -> CodeValidationResult:
        """Validate Python code syntax"""
        errors = []
        warnings = []
        suggestions = []
        
        try:
            # Parse AST
            ast.parse(code)
            
            # Additional checks
            if "import os" in code and "os.system" in code:
                warnings.append("Consider using subprocess instead of os.system for security")
            
            if "eval(" in code:
                warnings.append("Avoid using eval() for security reasons")
            
            if "exec(" in code:
                warnings.append("Avoid using exec() for security reasons")
            
            # Check for common patterns
            if not re.search(r'def\s+\w+\s*\(', code) and len(code.split('\n')) > 5:
                suggestions.append("Consider organizing code into functions")
            
        except SyntaxError as e:
            errors.append(f"Syntax error: {e.msg} at line {e.lineno}")
        except Exception as e:
            errors.append(f"Validation error: {str(e)}")
        
        return CodeValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            suggestions=suggestions
        )
    
    async def validate_javascript(self, code: str) -> CodeValidationResult:
        """Validate JavaScript code syntax"""
        errors = []
        warnings = []
        suggestions = []
        
        try:
            # Basic syntax checks
            if code.count('{') != code.count('}'):
                errors.append("Mismatched curly braces")
            
            if code.count('(') != code.count(')'):
                errors.append("Mismatched parentheses")
            
            if code.count('[') != code.count(']'):
                errors.append("Mismatched square brackets")
            
            # Security checks
            if "eval(" in code:
                warnings.append("Avoid using eval() for security reasons")
            
            if "innerHTML" in code:
                warnings.append("Consider using textContent or proper sanitization with innerHTML")
            
            # Best practices
            if "var " in code:
                suggestions.append("Consider using 'let' or 'const' instead of 'var'")
            
        except Exception as e:
            errors.append(f"Validation error: {str(e)}")
        
        return CodeValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            suggestions=suggestions
        )
    
    async def validate_html(self, code: str) -> CodeValidationResult:
        """Validate HTML code syntax"""
        errors = []
        warnings = []
        suggestions = []
        
        try:
            # Basic HTML validation
            if not re.search(r'<!DOCTYPE\s+html>', code, re.IGNORECASE):
                warnings.append("Missing DOCTYPE declaration")
            
            if not re.search(r'<html.*?>', code, re.IGNORECASE):
                errors.append("Missing <html> tag")
            
            if not re.search(r'<head.*?>.*?</head>', code, re.IGNORECASE | re.DOTALL):
                warnings.append("Missing <head> section")
            
            if not re.search(r'<body.*?>.*?</body>', code, re.IGNORECASE | re.DOTALL):
                warnings.append("Missing <body> section")
            
            # Security checks
            if re.search(r'<script.*?javascript:', code, re.IGNORECASE):
                warnings.append("Avoid inline javascript: URLs for security")
            
            if re.search(r'on\w+\s*=', code, re.IGNORECASE):
                warnings.append("Consider using event listeners instead of inline event handlers")
            
            # Accessibility checks
            if re.search(r'<img(?![^>]*alt=)', code, re.IGNORECASE):
                suggestions.append("Add alt attributes to images for accessibility")
            
        except Exception as e:
            errors.append(f"Validation error: {str(e)}")
        
        return CodeValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            suggestions=suggestions
        )
    
    async def validate_css(self, code: str) -> CodeValidationResult:
        """Validate CSS code syntax"""
        errors = []
        warnings = []
        suggestions = []
        
        try:
            # Basic CSS validation
            if code.count('{') != code.count('}'):
                errors.append("Mismatched curly braces")
            
            # Check for common issues
            lines = code.split('\n')
            for i, line in enumerate(lines, 1):
                line = line.strip()
                if line and not line.startswith('/*') and ':' in line and not line.endswith(';') and not line.endswith('{'):
                    warnings.append(f"Missing semicolon at line {i}")
            
            # Best practices
            if 'important' in code:
                suggestions.append("Avoid using !important when possible")
            
        except Exception as e:
            errors.append(f"Validation error: {str(e)}")
        
        return CodeValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            suggestions=suggestions
        )
    
    async def validate_code(self, code: str, language: str) -> CodeValidationResult:
        """Validate code based on language"""
        language = language.lower()
        
        if language == "python":
            return await self.validate_python(code)
        elif language == "javascript":
            return await self.validate_javascript(code)
        elif language == "html":
            return await self.validate_html(code)
        elif language == "css":
            return await self.validate_css(code)
        else:
            return CodeValidationResult(
                is_valid=True,
                errors=[],
                warnings=[f"No validator available for language: {language}"],
                suggestions=[]
            )


class DependencyResolver:
    """Resolve and manage code dependencies"""
    
    def extract_python_imports(self, code: str) -> List[str]:
        """Extract Python imports from code"""
        imports = []
        lines = code.split('\n')
        
        for line in lines:
            line = line.strip()
            if line.startswith('import '):
                imports.append(line.split()[1].split('.')[0])
            elif line.startswith('from '):
                imports.append(line.split()[1].split('.')[0])
        
        return list(set(imports))
    
    def extract_javascript_imports(self, code: str) -> List[str]:
        """Extract JavaScript imports from code"""
        imports = []
        
        # ES6 imports
        import_matches = re.findall(r'import.*?from\s+[\'"]([^\'"]+)[\'"]', code)
        imports.extend(import_matches)
        
        # CommonJS requires
        require_matches = re.findall(r'require\s*\(\s*[\'"]([^\'"]+)[\'"]\s*\)', code)
        imports.extend(require_matches)
        
        return list(set(imports))
    
    def get_dependencies(self, code: str, language: str) -> List[str]:
        """Get dependencies for code"""
        language = language.lower()
        
        if language == "python":
            return self.extract_python_imports(code)
        elif language == "javascript":
            return self.extract_javascript_imports(code)
        else:
            return []


class TemplateEngine:
    """Handle reusable code templates"""
    
    def __init__(self):
        self.templates = self._load_templates()
    
    def _load_templates(self) -> Dict[str, Dict[str, str]]:
        """Load predefined templates"""
        return {
            "python": {
                "function": '''def {function_name}({parameters}):
    """
    {description}
    
    Args:
        {args_doc}
    
    Returns:
        {return_doc}
    """
    {body}
    return {return_value}''',
                
                "class": '''class {class_name}:
    """
    {description}
    """
    
    def __init__(self{init_params}):
        {init_body}
    
    {methods}''',
                
                "api_endpoint": '''@app.{method}("/{endpoint}")
async def {function_name}({parameters}):
    """
    {description}
    """
    try:
        {body}
        return {{"status": "success", "data": result}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))'''
            },
            
            "javascript": {
                "function": '''function {function_name}({parameters}) {{
    /**
     * {description}
     * @param {{{param_types}}} {parameters}
     * @returns {{{return_type}}}
     */
    {body}
}}''',
                
                "class": '''class {class_name} {{
    /**
     * {description}
     */
    constructor({constructor_params}) {{
        {constructor_body}
    }}
    
    {methods}
}}''',
                
                "async_function": '''async function {function_name}({parameters}) {{
    /**
     * {description}
     * @param {{{param_types}}} {parameters}
     * @returns {{Promise<{return_type}>}}
     */
    try {{
        {body}
    }} catch (error) {{
        console.error('Error in {function_name}:', error);
        throw error;
    }}
}}'''
            },
            
            "html": {
                "page": '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    {additional_head}
</head>
<body class="bg-gray-50">
    {body}
    {scripts}
</body>
</html>''',
                
                "component": '''<div class="{classes}">
    <h2 class="text-xl font-semibold mb-4">{title}</h2>
    {content}
</div>''',
                
                "form": '''<form class="space-y-4" onsubmit="{onsubmit}">
    {fields}
    <button type="submit" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        {submit_text}
    </button>
</form>'''
            },
            
            "css": {
                "utility_class": '''.{class_name} {{
    {properties}
}}''',
                
                "component": '''.{component_name} {{
    {base_styles}
}}

.{component_name}:hover {{
    {hover_styles}
}}

.{component_name}:focus {{
    {focus_styles}
}}''',
                
                "responsive": '''/* Mobile */
@media (max-width: 768px) {{
    .{class_name} {{
        {mobile_styles}
    }}
}}

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) {{
    .{class_name} {{
        {tablet_styles}
    }}
}}

/* Desktop */
@media (min-width: 1025px) {{
    .{class_name} {{
        {desktop_styles}
    }}
}}'''
            }
        }
    
    def get_template(self, language: str, template_name: str) -> Optional[str]:
        """Get template by language and name"""
        return self.templates.get(language, {}).get(template_name)
    
    def fill_template(self, template: str, **kwargs) -> str:
        """Fill template with provided values"""
        try:
            return template.format(**kwargs)
        except KeyError as e:
            logger.warning(f"Missing template variable: {e}")
            return template


class VersionController:
    """Track code generation versions"""
    
    async def save_generation(
        self,
        project_id: str,
        code: str,
        language: str,
        model_used: str,
        input_prompt: str,
        generation_time: float,
        tokens_used: int
    ) -> str:
        """Save code generation to database"""
        try:
            async with get_db_session() as session:
                # Get current version
                current_version = await self._get_current_version(session, project_id, language)
                
                # Create new generation
                generation = CodeGeneration(
                    project_id=project_id,
                    model_used=model_used,
                    input_prompt=input_prompt,
                    generated_code=code,
                    language=Language(language),
                    version=current_version + 1,
                    generation_time=generation_time,
                    tokens_used=tokens_used
                )
                
                session.add(generation)
                await session.commit()
                
                logger.info(f"Saved code generation {generation.id} for project {project_id}")
                return str(generation.id)
                
        except Exception as e:
            logger.error(f"Failed to save generation: {e}")
            raise
    
    async def _get_current_version(self, session, project_id: str, language: str) -> int:
        """Get current version for project and language"""
        # This would involve a database query - simplified for now
        return 0


class CodeGenerationService:
    """Main Code Generation Service"""
    
    def __init__(self):
        self.validator = SyntaxValidator()
        self.dependency_resolver = DependencyResolver()
        self.template_engine = TemplateEngine()
        self.version_controller = VersionController()
    
    async def generate_code(
        self,
        prompt: str,
        language: str,
        project_id: Optional[str] = None,
        template_name: Optional[str] = None,
        model: Optional[str] = None
    ) -> GenerationResult:
        """Generate code based on prompt"""
        start_time = time.time()
        
        try:
            # Prepare context
            context = self._prepare_context(language, template_name)
            
            # Generate code using AI
            ai_response = await ai_model_service.generate_response(
                prompt=prompt,
                context=context,
                task_type="code_generation",
                model=model,
                project_id=project_id
            )
            
            if not ai_response.success:
                raise Exception(f"AI generation failed: {ai_response.error}")
            
            # Extract code from response
            code = self._extract_code(ai_response.content, language)
            
            # Validate generated code
            validation_result = await self.validator.validate_code(code, language)
            
            # Get dependencies
            dependencies = self.dependency_resolver.get_dependencies(code, language)
            
            # Calculate generation time
            generation_time = time.time() - start_time
            
            # Save to database if project_id provided
            generation_id = None
            if project_id:
                generation_id = await self.version_controller.save_generation(
                    project_id=project_id,
                    code=code,
                    language=language,
                    model_used=ai_response.model,
                    input_prompt=prompt,
                    generation_time=generation_time,
                    tokens_used=ai_response.input_tokens + ai_response.output_tokens
                )
            
            return GenerationResult(
                code=code,
                language=language,
                validation_result=validation_result,
                metadata={
                    "generation_id": generation_id,
                    "model_used": ai_response.model,
                    "dependencies": dependencies,
                    "tokens_used": ai_response.input_tokens + ai_response.output_tokens,
                    "template_used": template_name
                },
                generation_time=generation_time
            )
            
        except Exception as e:
            logger.error(f"Code generation failed: {e}")
            raise
    
    def _prepare_context(self, language: str, template_name: Optional[str] = None) -> str:
        """Prepare context for code generation"""
        context_parts = [
            f"Generate {language} code.",
            f"Follow {language} best practices and coding standards.",
            "Include proper error handling and documentation.",
            "Make the code production-ready and maintainable."
        ]
        
        if template_name:
            template = self.template_engine.get_template(language, template_name)
            if template:
                context_parts.append(f"Use this template structure: {template}")
        
        # Add language-specific guidelines
        if language == "python":
            context_parts.extend([
                "Follow PEP 8 style guidelines.",
                "Use type hints where appropriate.",
                "Include docstrings for functions and classes."
            ])
        elif language == "javascript":
            context_parts.extend([
                "Use modern JavaScript (ES6+) features.",
                "Include JSDoc comments for functions.",
                "Handle async operations properly."
            ])
        elif language == "html":
            context_parts.extend([
                "Use semantic HTML elements.",
                "Include proper accessibility attributes.",
                "Use Tailwind CSS for styling."
            ])
        elif language == "css":
            context_parts.extend([
                "Use modern CSS features.",
                "Follow mobile-first responsive design.",
                "Use Tailwind CSS utility classes when possible."
            ])
        
        return " ".join(context_parts)
    
    def _extract_code(self, response: str, language: str) -> str:
        """Extract code from AI response"""
        # Look for code blocks
        code_block_pattern = rf'```{language}(.*?)```'
        match = re.search(code_block_pattern, response, re.DOTALL | re.IGNORECASE)
        
        if match:
            return match.group(1).strip()
        
        # Look for generic code blocks
        generic_pattern = r'```(.*?)```'
        match = re.search(generic_pattern, response, re.DOTALL)
        
        if match:
            return match.group(1).strip()
        
        # Return the whole response if no code blocks found
        return response.strip()


# Create global service instance
code_generation_service = CodeGenerationService()
