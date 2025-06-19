"""
Chunk Management Service
Handles 4K token limitations across multiple AI models
"""
import re
import ast
import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

from app.core.config import settings
logger = logging.getLogger(__name__)

class ContentType(Enum):
    PYTHON = "python"
    HTML = "html"
    CSS = "css"
    JAVASCRIPT = "javascript"
    TEXT = "text"

@dataclass
class Chunk:
    content: str
    index: int
    total_chunks: int
    context: str
    metadata: Dict[str, Any]
    token_count: int

@dataclass
class ChunkResult:
    chunks: List[Chunk]
    total_tokens: int
    strategy_used: str
    success: bool
    error_message: Optional[str] = None

class TokenCounter:
    """Accurate token counting for different content types"""
    
    @staticmethod
    def count_tokens(text: str) -> int:
        """Approximate token counting - 1 token ≈ 4 characters"""
        return len(text) // 4 + 1
    
    @staticmethod
    def estimate_response_tokens(prompt: str, content_type: ContentType) -> int:
        """Estimate response tokens based on content type"""
        base_tokens = len(prompt) // 4
        
        multipliers = {
            ContentType.PYTHON: 1.5,
            ContentType.HTML: 1.3,
            ContentType.CSS: 1.2,
            ContentType.JAVASCRIPT: 1.4,
            ContentType.TEXT: 1.1
        }
        
        return int(base_tokens * multipliers.get(content_type, 1.2))

class ChunkManager:
    """Intelligent chunking manager for 4K token limitations"""
    
    def __init__(self):
        self.max_tokens = settings.MAX_TOKENS_PER_REQUEST
        self.safety_buffer = settings.TOKEN_SAFETY_BUFFER
        self.token_counter = TokenCounter()
        
    def chunk_content(
        self, 
        content: str, 
        context: str, 
        content_type: ContentType,
        preserve_structure: bool = True
    ) -> ChunkResult:
        """
        Main chunking method that routes to appropriate strategy
        """
        try:
            context_tokens = self.token_counter.count_tokens(context)
            available_tokens = self.max_tokens - context_tokens - self.safety_buffer
            
            if available_tokens <= 0:
                return ChunkResult(
                    chunks=[],
                    total_tokens=0,
                    strategy_used="none",
                    success=False,
                    error_message="Context too large, no tokens available for content"
                )
            
            content_tokens = self.token_counter.count_tokens(content)
            
            # If content fits in available tokens, return as single chunk
            if content_tokens <= available_tokens:
                chunk = Chunk(
                    content=content,
                    index=0,
                    total_chunks=1,
                    context=context,
                    metadata={"content_type": content_type.value},
                    token_count=content_tokens
                )
                return ChunkResult(
                    chunks=[chunk],
                    total_tokens=content_tokens + context_tokens,
                    strategy_used="single",
                    success=True
                )
            
            # Choose chunking strategy based on content type
            if content_type == ContentType.PYTHON:
                return self._chunk_python_code(content, context, available_tokens)
            elif content_type == ContentType.HTML:
                return self._chunk_html_content(content, context, available_tokens)
            elif content_type == ContentType.CSS:
                return self._chunk_css_content(content, context, available_tokens)
            elif content_type == ContentType.JAVASCRIPT:
                return self._chunk_javascript_code(content, context, available_tokens)
            else:
                return self._chunk_text_content(content, context, available_tokens)
                
        except Exception as e:
            logger.error(f"Error chunking content: {str(e)}")
            return ChunkResult(
                chunks=[],
                total_tokens=0,
                strategy_used="error",
                success=False,
                error_message=str(e)
            )
    
    def _chunk_python_code(self, content: str, context: str, available_tokens: int) -> ChunkResult:
        """Chunk Python code by functions, classes, and logical blocks"""
        try:
            tree = ast.parse(content)
            chunks = []
            current_chunk = ""
            current_tokens = 0
            
            for node in ast.walk(tree):
                if isinstance(node, (ast.FunctionDef, ast.ClassDef, ast.AsyncFunctionDef)):
                    node_content = ast.get_source_segment(content, node)
                    if node_content:
                        node_tokens = self.token_counter.count_tokens(node_content)
                        
                        if current_tokens + node_tokens > available_tokens and current_chunk:
                            # Save current chunk
                            chunks.append(current_chunk.strip())
                            current_chunk = node_content + "\n"
                            current_tokens = node_tokens
                        else:
                            current_chunk += node_content + "\n"
                            current_tokens += node_tokens
            
            # Add remaining content
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            
            # If AST parsing fails, fall back to line-based chunking
            if not chunks:
                return self._chunk_by_lines(content, context, available_tokens)
            
            return self._create_chunk_result(chunks, context, ContentType.PYTHON, "python_ast")
            
        except SyntaxError:
            # Fall back to line-based chunking for invalid Python
            return self._chunk_by_lines(content, context, available_tokens)
    
    def _chunk_html_content(self, content: str, context: str, available_tokens: int) -> ChunkResult:
        """Chunk HTML by tags and sections"""
        # Find major HTML sections
        sections = re.findall(r'<(div|section|article|main|header|footer|nav)[^>]*>.*?</\1>', 
                             content, re.DOTALL | re.IGNORECASE)
        
        if sections:
            chunks = []
            current_chunk = ""
            current_tokens = 0
            
            for section in sections:
                section_tokens = self.token_counter.count_tokens(section)
                
                if current_tokens + section_tokens > available_tokens and current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = section
                    current_tokens = section_tokens
                else:
                    current_chunk += section
                    current_tokens += section_tokens
            
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            
            return self._create_chunk_result(chunks, context, ContentType.HTML, "html_sections")
        
        # Fall back to line-based chunking
        return self._chunk_by_lines(content, context, available_tokens)
    
    def _chunk_css_content(self, content: str, context: str, available_tokens: int) -> ChunkResult:
        """Chunk CSS by rules and media queries"""
        # Split by CSS rules
        rules = re.findall(r'[^{}]+\{[^{}]*\}', content, re.DOTALL)
        
        if rules:
            chunks = []
            current_chunk = ""
            current_tokens = 0
            
            for rule in rules:
                rule_tokens = self.token_counter.count_tokens(rule)
                
                if current_tokens + rule_tokens > available_tokens and current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = rule
                    current_tokens = rule_tokens
                else:
                    current_chunk += rule + "\n"
                    current_tokens += rule_tokens
            
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            
            return self._create_chunk_result(chunks, context, ContentType.CSS, "css_rules")
        
        return self._chunk_by_lines(content, context, available_tokens)
    
    def _chunk_javascript_code(self, content: str, context: str, available_tokens: int) -> ChunkResult:
        """Chunk JavaScript by functions and blocks"""
        # Find functions and classes
        function_pattern = r'(function\s+\w+[^{]*\{(?:[^{}]|\{[^{}]*\})*\}|class\s+\w+[^{]*\{(?:[^{}]|\{[^{}]*\})*\}|\w+\s*=\s*\([^)]*\)\s*=>[^;]*;?)'
        functions = re.findall(function_pattern, content, re.DOTALL)
        
        if functions:
            chunks = []
            current_chunk = ""
            current_tokens = 0
            
            for func in functions:
                func_tokens = self.token_counter.count_tokens(func)
                
                if current_tokens + func_tokens > available_tokens and current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = func + "\n"
                    current_tokens = func_tokens
                else:
                    current_chunk += func + "\n"
                    current_tokens += func_tokens
            
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            
            return self._create_chunk_result(chunks, context, ContentType.JAVASCRIPT, "javascript_functions")
        
        return self._chunk_by_lines(content, context, available_tokens)
    
    def _chunk_text_content(self, content: str, context: str, available_tokens: int) -> ChunkResult:
        """Chunk plain text by sentences and paragraphs"""
        # Split by paragraphs first
        paragraphs = content.split('\n\n')
        
        chunks = []
        current_chunk = ""
        current_tokens = 0
        
        for paragraph in paragraphs:
            para_tokens = self.token_counter.count_tokens(paragraph)
            
            if current_tokens + para_tokens > available_tokens and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = paragraph
                current_tokens = para_tokens
            else:
                current_chunk += paragraph + "\n\n"
                current_tokens += para_tokens
        
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return self._create_chunk_result(chunks, context, ContentType.TEXT, "text_paragraphs")
    
    def _chunk_by_lines(self, content: str, context: str, available_tokens: int) -> ChunkResult:
        """Fallback chunking by lines"""
        lines = content.split('\n')
        chunks = []
        current_chunk = ""
        current_tokens = 0
        
        for line in lines:
            line_tokens = self.token_counter.count_tokens(line)
            
            if current_tokens + line_tokens > available_tokens and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = line + "\n"
                current_tokens = line_tokens
            else:
                current_chunk += line + "\n"
                current_tokens += line_tokens
        
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return self._create_chunk_result(chunks, context, ContentType.TEXT, "line_based")
    
    def _create_chunk_result(self, chunks: List[str], context: str, content_type: ContentType, strategy: str) -> ChunkResult:
        """Create final chunk result with metadata"""
        chunk_objects = []
        total_tokens = 0
        
        for i, chunk_content in enumerate(chunks):
            token_count = self.token_counter.count_tokens(chunk_content)
            chunk = Chunk(
                content=chunk_content,
                index=i,
                total_chunks=len(chunks),
                context=context,
                metadata={
                    "content_type": content_type.value,
                    "strategy": strategy
                },
                token_count=token_count
            )
            chunk_objects.append(chunk)
            total_tokens += token_count
        
        return ChunkResult(
            chunks=chunk_objects,
            total_tokens=total_tokens,
            strategy_used=strategy,
            success=True
        )

class OutputAssembler:
    """Assembles chunked responses back together"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
    
    def assemble_responses(self, chunk_responses: List[Dict[str, Any]], content_type: ContentType) -> Dict[str, Any]:
        """
        Assemble multiple chunk responses into a single coherent result
        """
        try:
            if not chunk_responses:
                return {
                    "success": False,
                    "error": "No chunk responses provided",
                    "assembled_content": ""
                }
            
            # Sort responses by chunk index
            sorted_responses = sorted(chunk_responses, key=lambda x: x.get("chunk_index", 0))
            
            # Assemble content based on type
            if content_type == ContentType.PYTHON:
                return self._assemble_python_code(sorted_responses)
            elif content_type == ContentType.HTML:
                return self._assemble_html_content(sorted_responses)
            elif content_type == ContentType.CSS:
                return self._assemble_css_content(sorted_responses)
            elif content_type == ContentType.JAVASCRIPT:
                return self._assemble_javascript_code(sorted_responses)
            else:
                return self._assemble_text_content(sorted_responses)
                
        except Exception as e:
            self.logger.error(f"Error assembling responses: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "assembled_content": ""
            }
    
    def _assemble_python_code(self, responses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assemble Python code chunks"""
        assembled_content = ""
        imports = set()
        
        for response in responses:
            content = response.get("content", "")
            
            # Extract imports
            for line in content.split('\n'):
                if line.strip().startswith(('import ', 'from ')):
                    imports.add(line.strip())
                else:
                    if not line.strip().startswith(('import ', 'from ')):
                        assembled_content += content + "\n\n"
                        break
        
        # Combine imports and content
        final_content = "\n".join(sorted(imports)) + "\n\n" + assembled_content
        
        return {
            "success": True,
            "assembled_content": final_content.strip(),
            "metadata": {
                "imports_count": len(imports),
                "chunks_assembled": len(responses)
            }
        }
    
    def _assemble_html_content(self, responses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assemble HTML content chunks"""
        assembled_content = ""
        
        for response in responses:
            content = response.get("content", "")
            assembled_content += content + "\n"
        
        return {
            "success": True,
            "assembled_content": assembled_content.strip(),
            "metadata": {
                "chunks_assembled": len(responses)
            }
        }
    
    def _assemble_css_content(self, responses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assemble CSS content chunks"""
        assembled_content = ""
        
        for response in responses:
            content = response.get("content", "")
            assembled_content += content + "\n\n"
        
        return {
            "success": True,
            "assembled_content": assembled_content.strip(),
            "metadata": {
                "chunks_assembled": len(responses)
            }
        }
    
    def _assemble_javascript_code(self, responses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assemble JavaScript code chunks"""
        assembled_content = ""
        
        for response in responses:
            content = response.get("content", "")
            assembled_content += content + "\n\n"
        
        return {
            "success": True,
            "assembled_content": assembled_content.strip(),
            "metadata": {
                "chunks_assembled": len(responses)
            }
        }
    
    def _assemble_text_content(self, responses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assemble text content chunks"""
        assembled_content = ""
        
        for response in responses:
            content = response.get("content", "")
            assembled_content += content + " "
        
        return {
            "success": True,
            "assembled_content": assembled_content.strip(),
            "metadata": {
                "chunks_assembled": len(responses)
            }
        }

class ContextManager:
    """Maintains context across chunks"""
    
    def __init__(self):
        self.contexts = {}
        self.logger = logging.getLogger(__name__)
    
    def create_context(self, session_id: str, project_context: str, generation_context: str) -> str:
        """Create and store context for a chunking session"""
        context = f"""
Project Context:
{project_context}

Generation Context:
{generation_context}

Instructions:
- Maintain consistency across all chunks
- Follow the established patterns and conventions
- Ensure code quality and best practices
- Consider dependencies and imports
"""
        
        self.contexts[session_id] = context
        return context
    
    def get_context(self, session_id: str) -> str:
        """Retrieve context for a session"""
        return self.contexts.get(session_id, "")
    
    def update_context(self, session_id: str, additional_context: str) -> str:
        """Update context with additional information"""
        current_context = self.contexts.get(session_id, "")
        updated_context = current_context + f"\n\nAdditional Context:\n{additional_context}"
        self.contexts[session_id] = updated_context
        return updated_context
    
    def clear_context(self, session_id: str):
        """Clear context for a session"""
        if session_id in self.contexts:
            del self.contexts[session_id]

class ProgressTracker:
    """Tracks progress of chunked operations"""
    
    def __init__(self):
        self.progress_data = {}
        self.logger = logging.getLogger(__name__)
    
    def start_tracking(self, session_id: str, total_chunks: int) -> Dict[str, Any]:
        """Start tracking progress for a session"""
        progress = {
            "session_id": session_id,
            "total_chunks": total_chunks,
            "completed_chunks": 0,
            "failed_chunks": 0,
            "status": "in_progress",
            "start_time": self._get_current_timestamp(),
            "errors": []
        }
        
        self.progress_data[session_id] = progress
        return progress
    
    def update_progress(self, session_id: str, chunk_index: int, success: bool, error: str = None) -> Dict[str, Any]:
        """Update progress for a chunk"""
        if session_id not in self.progress_data:
            return {"error": "Session not found"}
        
        progress = self.progress_data[session_id]
        
        if success:
            progress["completed_chunks"] += 1
        else:
            progress["failed_chunks"] += 1
            if error:
                progress["errors"].append(f"Chunk {chunk_index}: {error}")
        
        # Update status
        if progress["completed_chunks"] + progress["failed_chunks"] >= progress["total_chunks"]:
            if progress["failed_chunks"] == 0:
                progress["status"] = "completed"
            else:
                progress["status"] = "completed_with_errors"
            progress["end_time"] = self._get_current_timestamp()
        
        return progress
    
    def get_progress(self, session_id: str) -> Dict[str, Any]:
        """Get current progress for a session"""
        return self.progress_data.get(session_id, {"error": "Session not found"})
    
    def clear_progress(self, session_id: str):
        """Clear progress data for a session"""
        if session_id in self.progress_data:
            del self.progress_data[session_id]
    
    def _get_current_timestamp(self) -> float:
        """Get current timestamp"""
        import time
        return time.time()

# Service instance
chunk_management_service = ChunkManager()
output_assembler = OutputAssembler()
context_manager = ContextManager()
progress_tracker = ProgressTracker()
