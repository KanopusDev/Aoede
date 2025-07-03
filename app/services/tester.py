"""
Testing & Validation Service
Automated testing and error resolution with iterative cycles
"""
import subprocess
import tempfile
import os
import asyncio
import time
import json
import re
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from pathlib import Path
import uuid

from app.core.config import settings, SUPPORTED_LANGUAGES, ERROR_CATEGORIES
from app.core.logging import get_logger
from app.services.models import ai_model_service
from app.models import TestResult, TestStatus
from app.core.database import get_db_session

logger = get_logger(__name__)


@dataclass
class ExecutionResult:
    """Code execution result"""
    success: bool
    stdout: str
    stderr: str
    exit_code: int
    execution_time: float
    error_type: Optional[str] = None


@dataclass
class TestExecutionResult:
    """Test execution result"""
    success: bool
    passed_tests: int
    failed_tests: int
    total_tests: int
    test_details: List[Dict[str, Any]]
    execution_time: float
    errors: List[str]


@dataclass
class FixResult:
    """Code fix result"""
    fixed_code: str
    fix_applied: bool
    fix_description: str
    iteration: int


class CodeExecutor:
    """Safe code execution environment"""
    
    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "aoede_execution"
        self.temp_dir.mkdir(exist_ok=True)
    
    async def execute_python(self, code: str, timeout: int = 30) -> ExecutionResult:
        """Execute Python code safely"""
        start_time = time.time()
        
        # Create temporary file
        temp_file = self.temp_dir / f"temp_{uuid.uuid4().hex}.py"
        
        try:
            # Write code to file
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(code)
            
            # Execute with restrictions
            result = await asyncio.create_subprocess_exec(
                'python', str(temp_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.temp_dir,
                env={
                    'PATH': os.environ.get('PATH', ''),
                    'PYTHONPATH': os.environ.get('PYTHONPATH', ''),
                    'PYTHONDONTWRITEBYTECODE': '1'
                }
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    result.communicate(), timeout=timeout
                )
                
                execution_time = time.time() - start_time
                
                return ExecutionResult(
                    success=result.returncode == 0,
                    stdout=stdout.decode('utf-8'),
                    stderr=stderr.decode('utf-8'),
                    exit_code=result.returncode,
                    execution_time=execution_time,
                    error_type=self._classify_error(stderr.decode('utf-8')) if result.returncode != 0 else None
                )
                
            except asyncio.TimeoutError:
                result.terminate()
                await result.wait()
                return ExecutionResult(
                    success=False,
                    stdout="",
                    stderr="Execution timeout",
                    exit_code=-1,
                    execution_time=timeout,
                    error_type="RESOURCE_ERROR"
                )
                
        except Exception as e:
            return ExecutionResult(
                success=False,
                stdout="",
                stderr=str(e),
                exit_code=-1,
                execution_time=time.time() - start_time,
                error_type="RUNTIME_ERROR"
            )
        finally:
            # Clean up
            if temp_file.exists():
                temp_file.unlink()
    
    async def execute_javascript(self, code: str, timeout: int = 30) -> ExecutionResult:
        """Execute JavaScript code safely"""
        start_time = time.time()
        
        # Create temporary file
        temp_file = self.temp_dir / f"temp_{uuid.uuid4().hex}.js"
        
        try:
            # Write code to file
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(code)
            
            # Execute with Node.js
            result = await asyncio.create_subprocess_exec(
                'node', str(temp_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.temp_dir
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    result.communicate(), timeout=timeout
                )
                
                execution_time = time.time() - start_time
                
                return ExecutionResult(
                    success=result.returncode == 0,
                    stdout=stdout.decode('utf-8'),
                    stderr=stderr.decode('utf-8'),
                    exit_code=result.returncode,
                    execution_time=execution_time,
                    error_type=self._classify_error(stderr.decode('utf-8')) if result.returncode != 0 else None
                )
                
            except asyncio.TimeoutError:
                result.terminate()
                await result.wait()
                return ExecutionResult(
                    success=False,
                    stdout="",
                    stderr="Execution timeout",
                    exit_code=-1,
                    execution_time=timeout,
                    error_type="RESOURCE_ERROR"
                )
                
        except Exception as e:
            return ExecutionResult(
                success=False,
                stdout="",
                stderr=str(e),
                exit_code=-1,
                execution_time=time.time() - start_time,
                error_type="RUNTIME_ERROR"
            )
        finally:
            # Clean up
            if temp_file.exists():
                temp_file.unlink()
    
    async def execute_html(self, code: str) -> ExecutionResult:
        """Validate HTML code"""
        start_time = time.time()
        
        try:
            # Basic HTML validation
            errors = []
            
            # Check for basic structure
            if not re.search(r'<html.*?>', code, re.IGNORECASE):
                errors.append("Missing <html> tag")
            
            if not re.search(r'<head.*?>.*?</head>', code, re.IGNORECASE | re.DOTALL):
                errors.append("Missing <head> section")
            
            if not re.search(r'<body.*?>.*?</body>', code, re.IGNORECASE | re.DOTALL):
                errors.append("Missing <body> section")
            
            # Check for unclosed tags
            tag_pattern = r'<(\w+)(?:\s[^>]*)?>(?![^<]*</\1>)'
            unclosed_tags = re.findall(tag_pattern, code, re.IGNORECASE)
            
            # Filter out self-closing tags
            self_closing = {'br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'}
            unclosed_tags = [tag for tag in unclosed_tags if tag.lower() not in self_closing]
            
            if unclosed_tags:
                errors.extend([f"Unclosed tag: <{tag}>" for tag in unclosed_tags])
            
            execution_time = time.time() - start_time
            
            return ExecutionResult(
                success=len(errors) == 0,
                stdout="HTML validation completed",
                stderr="\n".join(errors),
                exit_code=0 if len(errors) == 0 else 1,
                execution_time=execution_time,
                error_type="SYNTAX_ERROR" if errors else None
            )
            
        except Exception as e:
            return ExecutionResult(
                success=False,
                stdout="",
                stderr=str(e),
                exit_code=-1,
                execution_time=time.time() - start_time,
                error_type="RUNTIME_ERROR"
            )
    
    async def execute_css(self, code: str) -> ExecutionResult:
        """Validate CSS code"""
        start_time = time.time()
        
        try:
            errors = []
            
            # Check for balanced braces
            if code.count('{') != code.count('}'):
                errors.append("Mismatched curly braces")
            
            # Check for missing semicolons
            lines = code.split('\n')
            for i, line in enumerate(lines, 1):
                line = line.strip()
                if (line and 
                    ':' in line and 
                    not line.startswith('/*') and 
                    not line.endswith(';') and 
                    not line.endswith('{') and
                    not line.endswith('}')):
                    errors.append(f"Missing semicolon at line {i}")
            
            execution_time = time.time() - start_time
            
            return ExecutionResult(
                success=len(errors) == 0,
                stdout="CSS validation completed",
                stderr="\n".join(errors),
                exit_code=0 if len(errors) == 0 else 1,
                execution_time=execution_time,
                error_type="SYNTAX_ERROR" if errors else None
            )
            
        except Exception as e:
            return ExecutionResult(
                success=False,
                stdout="",
                stderr=str(e),
                exit_code=-1,
                execution_time=time.time() - start_time,
                error_type="RUNTIME_ERROR"
            )
    
    def _classify_error(self, stderr: str) -> str:
        """Classify error type based on stderr output"""
        stderr_lower = stderr.lower()
        
        if any(keyword in stderr_lower for keyword in ['syntaxerror', 'indentationerror', 'syntax error']):
            return "SYNTAX_ERROR"
        elif any(keyword in stderr_lower for keyword in ['modulenotfounderror', 'importerror', 'no module named']):
            return "DEPENDENCY_ERROR"
        elif any(keyword in stderr_lower for keyword in ['timeout', 'memory', 'resource']):
            return "RESOURCE_ERROR"
        elif any(keyword in stderr_lower for keyword in ['attributeerror', 'nameerror', 'typeerror']):
            return "LOGIC_ERROR"
        else:
            return "RUNTIME_ERROR"


class ErrorAnalyzer:
    """Parse and categorize errors"""
    
    def analyze_error(self, error_message: str, error_type: str, code: str) -> Dict[str, Any]:
        """Analyze error and provide context"""
        analysis = {
            "error_type": error_type,
            "error_message": error_message,
            "severity": self._get_severity(error_type),
            "line_number": self._extract_line_number(error_message),
            "suggestions": self._get_suggestions(error_type, error_message),
            "code_context": self._get_code_context(code, self._extract_line_number(error_message))
        }
        
        return analysis
    
    def _get_severity(self, error_type: str) -> str:
        """Get error severity level"""
        severity_map = {
            "SYNTAX_ERROR": "high",
            "RUNTIME_ERROR": "high", 
            "DEPENDENCY_ERROR": "medium",
            "LOGIC_ERROR": "medium",
            "RESOURCE_ERROR": "low"
        }
        return severity_map.get(error_type, "medium")
    
    def _extract_line_number(self, error_message: str) -> Optional[int]:
        """Extract line number from error message"""
        match = re.search(r'line (\d+)', error_message, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return None
    
    def _get_suggestions(self, error_type: str, error_message: str) -> List[str]:
        """Get suggestions based on error type"""
        suggestions = []
        
        if error_type == "SYNTAX_ERROR":
            if "indentation" in error_message.lower():
                suggestions.append("Check indentation levels")
            if "unexpected eof" in error_message.lower():
                suggestions.append("Check for missing closing brackets or parentheses")
            if "invalid syntax" in error_message.lower():
                suggestions.append("Check for typos in keywords or operators")
        
        elif error_type == "DEPENDENCY_ERROR":
            if "no module named" in error_message.lower():
                module_match = re.search(r"no module named '([^']+)'", error_message, re.IGNORECASE)
                if module_match:
                    module_name = module_match.group(1)
                    suggestions.append(f"Install missing module: pip install {module_name}")
        
        elif error_type == "LOGIC_ERROR":
            if "attributeerror" in error_message.lower():
                suggestions.append("Check if the object has the specified attribute")
            if "nameerror" in error_message.lower():
                suggestions.append("Check if the variable is defined before use")
        
        return suggestions
    
    def _get_code_context(self, code: str, line_number: Optional[int]) -> Optional[str]:
        """Get code context around error line"""
        if not line_number:
            return None
        
        lines = code.split('\n')
        if line_number > len(lines):
            return None
        
        start = max(0, line_number - 3)
        end = min(len(lines), line_number + 2)
        
        context_lines = []
        for i in range(start, end):
            marker = " -> " if i == line_number - 1 else "    "
            context_lines.append(f"{i+1:3d}{marker}{lines[i]}")
        
        return "\n".join(context_lines)


class TestRunner:
    """Execute automated tests"""
    
    def __init__(self):
        self.executor = CodeExecutor()
    
    async def run_python_tests(self, code: str, test_code: str = None) -> TestExecutionResult:
        """Run Python tests using pytest"""
        start_time = time.time()
        
        try:
            # Generate basic tests if none provided
            if not test_code:
                test_code = self._generate_python_tests(code)
            
            # Create test file
            temp_dir = Path(tempfile.gettempdir()) / f"aoede_test_{uuid.uuid4().hex}"
            temp_dir.mkdir(exist_ok=True)
            
            # Write code and test files
            code_file = temp_dir / "code.py"
            test_file = temp_dir / "test_code.py"
            
            with open(code_file, 'w', encoding='utf-8') as f:
                f.write(code)
            
            with open(test_file, 'w', encoding='utf-8') as f:
                f.write(test_code)
            
            # Run pytest
            result = await asyncio.create_subprocess_exec(
                'python', '-m', 'pytest', str(test_file), '-v', '--tb=short',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=temp_dir
            )
            
            stdout, stderr = await result.communicate()
            
            # Parse pytest output
            test_results = self._parse_pytest_output(stdout.decode('utf-8'))
            
            execution_time = time.time() - start_time
            
            # Clean up
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            return TestExecutionResult(
                success=result.returncode == 0,
                passed_tests=test_results['passed'],
                failed_tests=test_results['failed'],
                total_tests=test_results['total'],
                test_details=test_results['details'],
                execution_time=execution_time,
                errors=test_results['errors']
            )
            
        except Exception as e:
            return TestExecutionResult(
                success=False,
                passed_tests=0,
                failed_tests=0,
                total_tests=0,
                test_details=[],
                execution_time=time.time() - start_time,
                errors=[str(e)]
            )
    
    def _generate_python_tests(self, code: str) -> str:
        """Generate basic tests for Python code"""
        # Extract functions from code
        functions = re.findall(r'def\s+(\w+)\s*\([^)]*\):', code)
        
        test_code = "import sys\nimport os\nsys.path.insert(0, os.path.dirname(__file__))\nfrom code import *\n\n"
        
        for func in functions:
            if not func.startswith('_'):  # Skip private functions
                test_code += f"""
def test_{func}():
    '''Test {func} function'''
    try:
        result = {func}()
        assert result is not None
    except TypeError:
        # Function might need arguments
        pass
"""
        
        return test_code
    
    def _parse_pytest_output(self, output: str) -> Dict[str, Any]:
        """Parse pytest output"""
        results = {
            'passed': 0,
            'failed': 0,
            'total': 0,
            'details': [],
            'errors': []
        }
        
        # Extract test results
        for line in output.split('\n'):
            if 'PASSED' in line:
                results['passed'] += 1
                results['details'].append({'test': line.strip(), 'status': 'passed'})
            elif 'FAILED' in line:
                results['failed'] += 1
                results['details'].append({'test': line.strip(), 'status': 'failed'})
            elif 'ERROR' in line:
                results['errors'].append(line.strip())
        
        results['total'] = results['passed'] + results['failed']
        
        return results


class FixGenerator:
    """Generate error fixes using AI"""
    
    async def generate_fix(
        self,
        code: str,
        error_analysis: Dict[str, Any],
        language: str,
        iteration: int
    ) -> FixResult:
        """Generate fix for error"""
        try:
            # Prepare fix prompt
            fix_prompt = self._create_fix_prompt(code, error_analysis, language)
            
            # Get AI fix
            ai_response = await ai_model_service.generate_response(
                prompt=fix_prompt,
                context=f"Fix {language} code error. Provide only the corrected code.",
                task_type="code_generation"
            )
            
            if not ai_response.success:
                return FixResult(
                    fixed_code=code,
                    fix_applied=False,
                    fix_description=f"AI fix generation failed: {ai_response.error}",
                    iteration=iteration
                )
            
            # Extract fixed code
            fixed_code = self._extract_fixed_code(ai_response.content, language)
            
            return FixResult(
                fixed_code=fixed_code,
                fix_applied=True,
                fix_description=f"Applied AI-generated fix for {error_analysis['error_type']}",
                iteration=iteration
            )
            
        except Exception as e:
            logger.error(f"Error generating fix: {e}")
            return FixResult(
                fixed_code=code,
                fix_applied=False,
                fix_description=f"Fix generation error: {str(e)}",
                iteration=iteration
            )
    
    def _create_fix_prompt(self, code: str, error_analysis: Dict[str, Any], language: str) -> str:
        """Create prompt for fix generation"""
        prompt_parts = [
            f"Fix the following {language} code error:",
            f"Error Type: {error_analysis['error_type']}",
            f"Error Message: {error_analysis['error_message']}",
        ]
        
        if error_analysis.get('line_number'):
            prompt_parts.append(f"Error Line: {error_analysis['line_number']}")
        
        if error_analysis.get('suggestions'):
            prompt_parts.append(f"Suggestions: {', '.join(error_analysis['suggestions'])}")
        
        prompt_parts.extend([
            "\nOriginal Code:",
            code,
            "\nProvide the corrected code with the fix applied. Only return the code, no explanations."
        ])
        
        return "\n".join(prompt_parts)
    
    def _extract_fixed_code(self, response: str, language: str) -> str:
        """Extract fixed code from AI response"""
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


class IterativeValidator:
    """Repeat test-fix cycles until success"""
    
    def __init__(self):
        self.executor = CodeExecutor()
        self.analyzer = ErrorAnalyzer()
        self.test_runner = TestRunner()
        self.fix_generator = FixGenerator()
    
    async def validate_and_fix(
        self,
        code: str,
        language: str,
        max_iterations: int = 5,
        generation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Iteratively test and fix code until no errors"""
        iteration = 0
        current_code = code
        all_results = []
        
        while iteration < max_iterations:
            iteration += 1
            
            logger.info(f"Starting validation iteration {iteration}")
            
            # Execute code
            if language == "python":
                execution_result = await self.executor.execute_python(current_code)
            elif language == "javascript":
                execution_result = await self.executor.execute_javascript(current_code)
            elif language == "html":
                execution_result = await self.executor.execute_html(current_code)
            elif language == "css":
                execution_result = await self.executor.execute_css(current_code)
            else:
                return {
                    "status": "error",
                    "message": f"Unsupported language: {language}",
                    "code": current_code,
                    "iterations": iteration
                }
            
            # Save test result
            if generation_id:
                await self._save_test_result(generation_id, execution_result, iteration)
            
            all_results.append({
                "iteration": iteration,
                "execution_result": execution_result,
                "code": current_code
            })
            
            if execution_result.success:
                logger.info(f"Validation successful after {iteration} iterations")
                return {
                    "status": "success",
                    "code": current_code,
                    "iterations": iteration,
                    "results": all_results
                }
            
            # Analyze error
            error_analysis = self.analyzer.analyze_error(
                execution_result.stderr,
                execution_result.error_type or "RUNTIME_ERROR",
                current_code
            )
            
            # Generate fix
            fix_result = await self.fix_generator.generate_fix(
                current_code,
                error_analysis,
                language,
                iteration
            )
            
            if not fix_result.fix_applied:
                logger.warning(f"Failed to generate fix at iteration {iteration}")
                break
            
            current_code = fix_result.fixed_code
            
        return {
            "status": "failed",
            "code": current_code,
            "iterations": iteration,
            "results": all_results,
            "final_error": execution_result.stderr if 'execution_result' in locals() else "Unknown error"
        }
    
    async def _save_test_result(
        self,
        generation_id: str,
        execution_result: ExecutionResult,
        iteration: int
    ):
        """Save test result to database"""
        try:
            async with get_db_session() as session:
                test_result = TestResult(
                    generation_id=generation_id,
                    test_type=f"validation_iteration_{iteration}",
                    status=TestStatus.PASSED if execution_result.success else TestStatus.FAILED,
                    error_message=execution_result.stderr if not execution_result.success else None,
                    execution_time=execution_result.execution_time,
                    stdout=execution_result.stdout,
                    stderr=execution_result.stderr,
                    exit_code=execution_result.exit_code
                )
                
                session.add(test_result)
                await session.commit()
                
        except Exception as e:
            logger.error(f"Failed to save test result: {e}")


class TestingValidationService:
    """Main Testing & Validation Service"""
    
    def __init__(self):
        self.validator = IterativeValidator()
        self.test_runner = TestRunner()
        self.executor = CodeExecutor()
    
    async def run_comprehensive_test(
        self,
        code: str,
        language: str,
        generation_id: Optional[str] = None,
        custom_tests: Optional[str] = None
    ) -> Dict[str, Any]:
        """Run comprehensive testing suite"""
        try:
            # 1. Basic validation and fixing
            validation_result = await self.validator.validate_and_fix(
                code, language, generation_id=generation_id
            )
            
            if validation_result["status"] != "success":
                return validation_result
            
            # 2. Run unit tests if applicable
            test_results = None
            if language == "python":
                test_results = await self.test_runner.run_python_tests(
                    validation_result["code"], custom_tests
                )
            
            return {
                "status": "success",
                "validation_result": validation_result,
                "test_results": test_results,
                "final_code": validation_result["code"]
            }
            
        except Exception as e:
            logger.error(f"Comprehensive test failed: {e}")
            return {
                "status": "error",
                "message": str(e),
                "code": code
            }


# Create global service instance
testing_validation_service = TestingValidationService()
