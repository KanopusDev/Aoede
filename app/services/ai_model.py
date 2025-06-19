"""
AI Model Management Service for Azure AI Inference SDK (GitHub Models)
Handles multiple AI models with enterprise-grade 4K chunking and tool invocation
"""
import asyncio
import json
import time
import hashlib
from typing import List, Dict, Optional, Any, Union, Callable
from dataclasses import dataclass, field
from enum import Enum
import structlog

# Azure AI Inference SDK imports
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import (
    SystemMessage, 
    UserMessage, 
    AssistantMessage,
    ChatCompletions,
    ChatCompletionsToolCall,
    ChatCompletionsToolDefinition,
    FunctionDefinition
)
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import (
    HttpResponseError, 
    ServiceRequestError,
    ResourceNotFoundError
)
import tiktoken

from app.core.config import settings, MODEL_CONFIGS
from app.core.logging import get_logger
from app.models import ModelUsage
from app.core.database import get_db_session

logger = get_logger(__name__)


class ChunkStrategy(Enum):
    """Chunking strategies for different content types"""
    SEMANTIC = "semantic"
    FUNCTION_BASED = "function_based"  
    SENTENCE_BASED = "sentence_based"
    TOKEN_BASED = "token_based"
    HYBRID = "hybrid"


class ModelCapability(Enum):
    """Model capabilities for intelligent routing"""
    CODE_GENERATION = "code_generation"
    CODE_ANALYSIS = "code_analysis"
    TEXT_PROCESSING = "text_processing"
    REASONING = "reasoning"
    TOOL_CALLING = "tool_calling"


@dataclass
class ToolDefinition:
    """Tool definition for function calling"""
    name: str
    description: str
    parameters: Dict[str, Any]
    function: Optional[Callable] = None


@dataclass
class ChunkContext:
    """Context for a content chunk"""
    chunk_id: str
    content: str
    chunk_index: int
    total_chunks: int
    overlap_content: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    strategy_used: ChunkStrategy = ChunkStrategy.TOKEN_BASED


@dataclass 
class ModelResponse:
    """Enhanced model response with Azure AI Inference data"""
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    response_time: float
    success: bool
    chunk_id: Optional[str] = None
    tool_calls: List[ChatCompletionsToolCall] = field(default_factory=list)
    finish_reason: Optional[str] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AggregatedResponse:
    """Aggregated response from multiple chunks"""
    content: str
    model: str
    total_input_tokens: int
    total_output_tokens: int
    total_response_time: float
    chunk_count: int
    success: bool
    failed_chunks: List[str] = field(default_factory=list)
    tool_calls: List[ChatCompletionsToolCall] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class TokenCounter:
    """Enterprise-grade token counting with model-specific encoders"""
    
    def __init__(self):
        self.encoders = {}
        self.model_encodings = {
            "gpt-4": "cl100k_base",
            "gpt-4o": "cl100k_base", 
            "gpt-3.5": "cl100k_base",
            "mistral": "cl100k_base",  # Fallback
            "cohere": "cl100k_base"   # Fallback
        }
    
    def get_encoder(self, model: str) -> tiktoken.Encoding:
        """Get tiktoken encoder for model with fallback"""
        if model not in self.encoders:
            try:
                # Determine encoding based on model
                encoding_name = self._get_encoding_for_model(model)
                self.encoders[model] = tiktoken.get_encoding(encoding_name)
            except Exception as e:
                logger.warning(f"Failed to get encoder for {model}: {e}, using cl100k_base")
                self.encoders[model] = tiktoken.get_encoding("cl100k_base")
        
        return self.encoders[model]
    
    def _get_encoding_for_model(self, model: str) -> str:
        """Get appropriate encoding for model"""
        model_lower = model.lower()
        for model_prefix, encoding in self.model_encodings.items():
            if model_prefix in model_lower:
                return encoding
        return "cl100k_base"  # Default fallback
    
    def count_tokens(self, text: str, model: str) -> int:
        """Count tokens accurately for model"""
        try:
            encoder = self.get_encoder(model)
            return len(encoder.encode(text))
        except Exception as e:
            logger.error(f"Token counting failed for {model}: {e}")
            # Fallback estimation: average 4 chars per token
            return max(1, len(text) // 4)
    
    def estimate_message_tokens(self, messages: List[Dict[str, str]], model: str) -> int:
        """Estimate tokens for message array including overhead"""
        total = 0
        
        for message in messages:
            # Count content tokens
            content = message.get("content", "")
            total += self.count_tokens(content, model)
            
            # Add overhead per message (role, formatting, etc.)
            total += 4  # Estimated overhead per message
        
        # Add conversation overhead
        total += 10
        
        return total


class ModelHealthChecker:
    """Enterprise model health monitoring with Azure AI Inference SDK"""
    
    def __init__(self):
        self.health_status: Dict[str, bool] = {}
        self.last_check: Dict[str, float] = {}
        self.health_check_interval = 300  # 5 minutes
        self.clients: Dict[str, ChatCompletionsClient] = {}
    
    def _get_client(self, model: str) -> ChatCompletionsClient:
        """Get or create Azure AI client for model"""
        if model not in self.clients:
            try:
                self.clients[model] = ChatCompletionsClient(
                    endpoint=settings.GITHUB_AI_BASE_URL,
                    credential=AzureKeyCredential(settings.GITHUB_TOKEN)
                )
            except Exception as e:
                logger.error(f"Failed to create client for {model}: {e}")
                raise
        return self.clients[model]
    
    async def check_model_health(self, model: str) -> bool:
        """Check model health with lightweight request"""
        current_time = time.time()
        
        # Check if health status is still valid
        if (model in self.last_check and 
            current_time - self.last_check[model] < self.health_check_interval):
            return self.health_status.get(model, False)
        
        try:
            client = self._get_client(model)
            
            # Minimal health check request
            messages = [UserMessage(content="ping")]
            
            # Use asyncio to run sync method with timeout
            response = await asyncio.wait_for(
                asyncio.to_thread(
                    client.complete,
                    messages=messages,
                    model=model,
                    max_tokens=1,
                    temperature=0.1
                ),
                timeout=10.0
            )
            
            # Check if response is valid
            is_healthy = (
                response and 
                hasattr(response, 'choices') and 
                len(response.choices) > 0
            )
            
            self.health_status[model] = is_healthy
            self.last_check[model] = current_time
            
            if is_healthy:
                logger.debug(f"Health check passed for {model}")
            else:
                logger.warning(f"Health check failed for {model}: Invalid response")
            
            return is_healthy
            
        except asyncio.TimeoutError:
            logger.warning(f"Health check timeout for {model}")
            self.health_status[model] = False
            self.last_check[model] = current_time
            return False
            
        except (HttpResponseError, ServiceRequestError, ResourceNotFoundError) as e:
            logger.warning(f"Azure AI error in health check for {model}: {e}")
            self.health_status[model] = False
            self.last_check[model] = current_time
            return False
            
        except Exception as e:
            logger.error(f"Unexpected error in health check for {model}: {e}")
            self.health_status[model] = False
            self.last_check[model] = current_time
            return False
    
    async def get_healthy_models(self) -> List[str]:
        """Get list of currently healthy models"""
        healthy_models = []
        
        # Check all configured models
        for model in MODEL_CONFIGS.keys():
            if await self.check_model_health(model):
                healthy_models.append(model)
        
        return healthy_models
    
    def get_cached_health_status(self) -> Dict[str, bool]:
        """Get cached health status without new checks"""
        return self.health_status.copy()
    
    async def close(self):
        """Close all clients"""
        for client in self.clients.values():
            if hasattr(client, 'close'):
                await asyncio.to_thread(client.close)
        self.clients.clear()


class ModelRouter:
    """Intelligent model routing with capability-based selection"""
    
    def __init__(self):
        self.token_counter = TokenCounter()
        self.health_checker = ModelHealthChecker()
        self.usage_stats: Dict[str, Dict[str, Any]] = {}
        
        # Model capability mapping
        self.model_capabilities = {
            "mistral-ai/Codestral-2501": [
                ModelCapability.CODE_GENERATION,
                ModelCapability.CODE_ANALYSIS
            ],
            "openai/gpt-4.1": [
                ModelCapability.REASONING,
                ModelCapability.TOOL_CALLING,
                ModelCapability.TEXT_PROCESSING
            ],
            "openai/gpt-4o": [
                ModelCapability.REASONING,
                ModelCapability.CODE_ANALYSIS,
                ModelCapability.TOOL_CALLING
            ],
            "cohere/cohere-command-a": [
                ModelCapability.TEXT_PROCESSING,
                ModelCapability.TOOL_CALLING
            ]
        }
    
    async def select_model(
        self, 
        task_type: str, 
        content_length: int,
        requires_tools: bool = False
    ) -> str:
        """Select optimal model based on task requirements"""
        
        # Convert task_type to capability
        capability_map = {
            "code_generation": ModelCapability.CODE_GENERATION,
            "code_analysis": ModelCapability.CODE_ANALYSIS,
            "text_processing": ModelCapability.TEXT_PROCESSING,
            "reasoning": ModelCapability.REASONING,
            "auto": None  # Any capability
        }
        
        required_capability = capability_map.get(task_type)
        
        # Filter models by capability
        candidate_models = []
        for model, config in MODEL_CONFIGS.items():
            model_caps = self.model_capabilities.get(model, [])
            
            # Check capability match
            capability_match = (
                required_capability is None or 
                required_capability in model_caps
            )
            
            # Check tool calling requirement
            tool_match = (
                not requires_tools or 
                ModelCapability.TOOL_CALLING in model_caps
            )
            
            if capability_match and tool_match:
                candidate_models.append((model, config))
        
        if not candidate_models:
            # Fallback to any available model
            candidate_models = list(MODEL_CONFIGS.items())
        
        # Sort by priority and health
        candidate_models.sort(key=lambda x: x[1]["priority"])
        
        # Select first healthy model
        for model, config in candidate_models:
            if await self.health_checker.check_model_health(model):
                logger.debug(f"Selected model {model} for task {task_type}")
                return model
        
        # Fallback to first model if no health checks pass
        if candidate_models:
            model = candidate_models[0][0]
            logger.warning(f"Using fallback model {model} (health check failed)")
            return model
        
        # Final fallback
        default_model = next(iter(MODEL_CONFIGS.keys()))
        logger.error(f"No suitable models found, using default: {default_model}")
        return default_model
    
    def update_usage_stats(self, model: str, response: ModelResponse):
        """Update usage statistics for model selection optimization"""
        if model not in self.usage_stats:
            self.usage_stats[model] = {
                "total_requests": 0,
                "total_tokens": 0,
                "total_time": 0.0,
                "success_count": 0,
                "error_count": 0
            }
        
        stats = self.usage_stats[model]
        stats["total_requests"] += 1
        stats["total_tokens"] += response.total_tokens
        stats["total_time"] += response.response_time
        
        if response.success:
            stats["success_count"] += 1
        else:
            stats["error_count"] += 1
    
    def get_model_recommendations(self, task_type: str) -> List[str]:
        """Get recommended models for task type sorted by performance"""
        capability_map = {
            "code_generation": ModelCapability.CODE_GENERATION,
            "code_analysis": ModelCapability.CODE_ANALYSIS,
            "text_processing": ModelCapability.TEXT_PROCESSING,
            "reasoning": ModelCapability.REASONING
        }
        
        required_capability = capability_map.get(task_type)
        recommendations = []
        
        for model, config in MODEL_CONFIGS.items():
            model_caps = self.model_capabilities.get(model, [])
            
            if required_capability is None or required_capability in model_caps:
                # Calculate performance score
                stats = self.usage_stats.get(model, {})
                success_rate = 1.0
                avg_time = 1.0
                
                if stats.get("total_requests", 0) > 0:
                    success_rate = stats["success_count"] / stats["total_requests"]
                    avg_time = stats["total_time"] / stats["total_requests"]
                
                # Score based on priority, success rate, and speed
                score = (
                    (1.0 / config["priority"]) * 0.4 +
                    success_rate * 0.4 +
                    (1.0 / max(avg_time, 0.1)) * 0.2
                )
                
                recommendations.append((model, score))
        
        # Sort by score (descending)
        recommendations.sort(key=lambda x: x[1], reverse=True)
        return [model for model, score in recommendations]


class ChunkManager:
    """Enterprise-grade content chunking with multiple strategies"""
    
    def __init__(self):
        self.token_counter = TokenCounter()
        
        # Code pattern detection
        self.code_patterns = {
            'function_start': [
                r'^def\s+\w+\s*\(',      # Python functions
                r'^function\s+\w+\s*\(', # JavaScript functions  
                r'^async\s+function\s+\w+\s*\(',  # Async JS
                r'^\w+\s*:\s*function\s*\(',      # Object methods
                r'^class\s+\w+',                   # Class definitions
            ],
            'block_end': [r'^\s*}', r'^\s*$'],     # Closing braces or empty lines
            'import_statement': [
                r'^import\s+', r'^from\s+.*import', 
                r'^const\s+.*=\s*require', r'^import\s*{.*}\s*from'
            ]
        }
    
    async def chunk_content(
        self, 
        content: str, 
        context: str, 
        model: str,
        strategy: ChunkStrategy = ChunkStrategy.HYBRID
    ) -> List[ChunkContext]:
        """Intelligently chunk content based on strategy"""
        
        # Calculate available token space
        context_tokens = self.token_counter.count_tokens(context, model)
        max_content_tokens = (
            settings.MAX_TOKENS_PER_REQUEST - 
            settings.TOKEN_SAFETY_BUFFER - 
            context_tokens - 
            100  # Response buffer
        )
        
        content_tokens = self.token_counter.count_tokens(content, model)
        
        # If content fits in single chunk
        if content_tokens <= max_content_tokens:
            return [ChunkContext(
                chunk_id=self._generate_chunk_id(content, 0),
                content=content,
                chunk_index=0,
                total_chunks=1,
                metadata={"original_length": len(content), "strategy": strategy.value}
            )]
        
        # Apply chunking strategy
        chunks = await self._apply_chunking_strategy(
            content, context, model, max_content_tokens, strategy
        )
        
        # Post-process chunks
        return self._post_process_chunks(chunks, strategy)
    
    async def _apply_chunking_strategy(
        self, 
        content: str, 
        context: str, 
        model: str, 
        max_tokens: int,
        strategy: ChunkStrategy
    ) -> List[ChunkContext]:
        """Apply specific chunking strategy"""
        
        if strategy == ChunkStrategy.HYBRID:
            return await self._hybrid_chunking(content, context, model, max_tokens)
        elif strategy == ChunkStrategy.FUNCTION_BASED:
            return await self._function_based_chunking(content, context, model, max_tokens)
        elif strategy == ChunkStrategy.SEMANTIC:
            return await self._semantic_chunking(content, context, model, max_tokens)
        elif strategy == ChunkStrategy.SENTENCE_BASED:
            return await self._sentence_based_chunking(content, context, model, max_tokens)
        else:  # TOKEN_BASED
            return await self._token_based_chunking(content, context, model, max_tokens)
    
    async def _hybrid_chunking(
        self, content: str, context: str, model: str, max_tokens: int
    ) -> List[ChunkContext]:
        """Intelligent hybrid chunking strategy"""
        
        # Detect content type
        if self._is_code(content):
            logger.debug("Using function-based chunking for code content")
            return await self._function_based_chunking(content, context, model, max_tokens)
        elif self._is_structured_text(content):
            logger.debug("Using semantic chunking for structured text")
            return await self._semantic_chunking(content, context, model, max_tokens)
        else:
            logger.debug("Using sentence-based chunking for general text")
            return await self._sentence_based_chunking(content, context, model, max_tokens)
    
    async def _function_based_chunking(
        self, content: str, context: str, model: str, max_tokens: int
    ) -> List[ChunkContext]:
        """Chunk code by functions, classes, and logical blocks"""
        lines = content.split('\n')
        chunks = []
        current_chunk = []
        current_tokens = 0
        in_function = False
        function_depth = 0
        
        for i, line in enumerate(lines):
            line_tokens = self.token_counter.count_tokens(line + '\n', model)
            
            # Detect function/class starts
            is_function_start = any(
                __import__('re').match(pattern, line.strip()) 
                for pattern in self.code_patterns['function_start']
            )
            
            # Detect block ends
            is_block_end = any(
                __import__('re').match(pattern, line.strip())
                for pattern in self.code_patterns['block_end']
            )
            
            # Manage function depth
            if is_function_start:
                in_function = True
                function_depth += 1
            elif is_block_end and in_function:
                function_depth -= 1
                if function_depth <= 0:
                    in_function = False
                    function_depth = 0
            
            # Check if we need to split
            should_split = (
                current_tokens + line_tokens > max_tokens and 
                current_chunk and
                (not in_function or is_block_end)
            )
            
            if should_split:
                # Create chunk with overlap
                chunk_content = '\n'.join(current_chunk)
                overlap = self._extract_overlap(current_chunk, 3)  # 3 lines overlap
                
                chunks.append(ChunkContext(
                    chunk_id=self._generate_chunk_id(chunk_content, len(chunks)),
                    content=chunk_content,
                    chunk_index=len(chunks),
                    total_chunks=0,  # Will be updated
                    overlap_content=overlap,
                    strategy_used=ChunkStrategy.FUNCTION_BASED,
                    metadata={"lines_count": len(current_chunk)}
                ))
                
                # Start new chunk with overlap if previous chunk had content
                if overlap:
                    current_chunk = overlap.split('\n')
                    current_tokens = self.token_counter.count_tokens(overlap, model)
                else:
                    current_chunk = []
                    current_tokens = 0
            
            current_chunk.append(line)
            current_tokens += line_tokens
        
        # Add final chunk
        if current_chunk:
            chunk_content = '\n'.join(current_chunk)
            chunks.append(ChunkContext(
                chunk_id=self._generate_chunk_id(chunk_content, len(chunks)),
                content=chunk_content,
                chunk_index=len(chunks),
                total_chunks=0,
                strategy_used=ChunkStrategy.FUNCTION_BASED,
                metadata={"lines_count": len(current_chunk)}
            ))
        
        return chunks
    
    async def _semantic_chunking(
        self, content: str, context: str, model: str, max_tokens: int
    ) -> List[ChunkContext]:
        """Chunk based on semantic boundaries (paragraphs, sections)"""
        
        # Split by double newlines (paragraphs) first
        paragraphs = content.split('\n\n')
        chunks = []
        current_chunk = []
        current_tokens = 0
        
        for paragraph in paragraphs:
            paragraph_tokens = self.token_counter.count_tokens(paragraph + '\n\n', model)
            
            # If single paragraph exceeds limit, split by sentences
            if paragraph_tokens > max_tokens:
                if current_chunk:
                    # Save current chunk
                    chunk_content = '\n\n'.join(current_chunk)
                    chunks.append(ChunkContext(
                        chunk_id=self._generate_chunk_id(chunk_content, len(chunks)),
                        content=chunk_content,
                        chunk_index=len(chunks),
                        total_chunks=0,
                        strategy_used=ChunkStrategy.SEMANTIC
                    ))
                    current_chunk = []
                    current_tokens = 0
                
                # Split large paragraph by sentences
                sentence_chunks = await self._sentence_based_chunking(
                    paragraph, context, model, max_tokens
                )
                chunks.extend(sentence_chunks)
                continue
            
            # Check if adding paragraph exceeds limit
            if current_tokens + paragraph_tokens > max_tokens and current_chunk:
                # Save current chunk
                chunk_content = '\n\n'.join(current_chunk)
                chunks.append(ChunkContext(
                    chunk_id=self._generate_chunk_id(chunk_content, len(chunks)),
                    content=chunk_content,
                    chunk_index=len(chunks),
                    total_chunks=0,
                    strategy_used=ChunkStrategy.SEMANTIC
                ))
                current_chunk = []
                current_tokens = 0
            
            current_chunk.append(paragraph)
            current_tokens += paragraph_tokens
        
        # Add final chunk
        if current_chunk:
            chunk_content = '\n\n'.join(current_chunk)
            chunks.append(ChunkContext(
                chunk_id=self._generate_chunk_id(chunk_content, len(chunks)),
                content=chunk_content,
                chunk_index=len(chunks),
                total_chunks=0,
                strategy_used=ChunkStrategy.SEMANTIC
            ))
        
        return chunks
    
    async def _sentence_based_chunking(
        self, content: str, context: str, model: str, max_tokens: int
    ) -> List[ChunkContext]:
        """Chunk by sentences with smart boundary detection"""
        
        # Split by sentences (multiple delimiters)
        import re
        sentences = re.split(r'(?<=[.!?])\s+', content)
        chunks = []
        current_chunk = []
        current_tokens = 0
        
        for sentence in sentences:
            sentence_tokens = self.token_counter.count_tokens(sentence + ' ', model)
            
            # If single sentence exceeds limit, force split by words
            if sentence_tokens > max_tokens:
                if current_chunk:
                    # Save current chunk
                    chunk_content = ' '.join(current_chunk)
                    chunks.append(ChunkContext(
                        chunk_id=self._generate_chunk_id(chunk_content, len(chunks)),
                        content=chunk_content,
                        chunk_index=len(chunks),
                        total_chunks=0,
                        strategy_used=ChunkStrategy.SENTENCE_BASED
                    ))
                    current_chunk = []
                    current_tokens = 0
                
                # Split by words
                word_chunks = await self._token_based_chunking(
                    sentence, context, model, max_tokens
                )
                chunks.extend(word_chunks)
                continue
            
            # Check if adding sentence exceeds limit
            if current_tokens + sentence_tokens > max_tokens and current_chunk:
                # Save current chunk with overlap
                chunk_content = ' '.join(current_chunk)
                overlap = self._extract_sentence_overlap(current_chunk, 1)
                
                chunks.append(ChunkContext(
                    chunk_id=self._generate_chunk_id(chunk_content, len(chunks)),
                    content=chunk_content,
                    chunk_index=len(chunks),
                    total_chunks=0,
                    overlap_content=overlap,
                    strategy_used=ChunkStrategy.SENTENCE_BASED
                ))
                
                # Start new chunk with overlap
                if overlap:
                    current_chunk = [overlap]
                    current_tokens = self.token_counter.count_tokens(overlap, model)
                else:
                    current_chunk = []
                    current_tokens = 0
            
            current_chunk.append(sentence)
            current_tokens += sentence_tokens
        
        # Add final chunk
        if current_chunk:
            chunk_content = ' '.join(current_chunk)
            chunks.append(ChunkContext(
                chunk_id=self._generate_chunk_id(chunk_content, len(chunks)),
                content=chunk_content,
                chunk_index=len(chunks),
                total_chunks=0,
                strategy_used=ChunkStrategy.SENTENCE_BASED
            ))
        
        return chunks
    
    async def _token_based_chunking(
        self, content: str, context: str, model: str, max_tokens: int
    ) -> List[ChunkContext]:
        """Last resort: chunk by approximate token boundaries"""
        
        # Estimate characters per token for this model
        total_tokens = self.token_counter.count_tokens(content, model)
        chars_per_token = len(content) / max(total_tokens, 1)
        
        # Calculate chunk size in characters with overlap
        chunk_size_chars = int(max_tokens * chars_per_token * 0.9)  # 90% to be safe
        overlap_chars = int(settings.CHUNK_OVERLAP * chars_per_token)
        
        chunks = []
        start = 0
        
        while start < len(content):
            end = min(start + chunk_size_chars, len(content))
            
            # Find a good break point (word boundary)
            if end < len(content):
                # Look for word boundary within last 100 characters
                for i in range(min(100, end - start)):
                    if content[end - i].isspace():
                        end = end - i
                        break
            
            chunk_content = content[start:end]
            
            # Add overlap from previous chunk
            overlap_content = ""
            if start > 0 and overlap_chars > 0:
                overlap_start = max(0, start - overlap_chars)
                overlap_content = content[overlap_start:start]
                chunk_content = overlap_content + chunk_content
            
            chunks.append(ChunkContext(
                chunk_id=self._generate_chunk_id(chunk_content, len(chunks)),
                content=chunk_content,
                chunk_index=len(chunks),
                total_chunks=0,
                overlap_content=overlap_content,
                strategy_used=ChunkStrategy.TOKEN_BASED,
                metadata={
                    "start_pos": start,
                    "end_pos": end,
                    "estimated_tokens": self.token_counter.count_tokens(chunk_content, model)
                }
            ))
            
            start = end
        
        return chunks
    
    def _is_code(self, content: str) -> bool:
        """Detect if content is code"""
        code_indicators = [
            'def ', 'function ', 'class ', 'import ', 'from ',
            'const ', 'let ', 'var ', 'return ', 'if (', 'for (',
            'while (', '=>', '{', '}', ';', '//', '/*', '*/',
            '#include', 'package ', 'namespace ', 'using ',
            'public class', 'private ', 'protected '
        ]
        
        content_lower = content.lower()
        code_count = sum(1 for indicator in code_indicators if indicator in content_lower)
        
        # If more than 20% of indicators present, likely code
        return code_count >= len(code_indicators) * 0.2
    
    def _is_structured_text(self, content: str) -> bool:
        """Detect if content has structured format"""
        structure_indicators = [
            '# ', '## ', '### ',  # Markdown headers
            '\n\n',  # Paragraph breaks
            '- ', '* ', '1. ',  # Lists
            '---', '===',  # Dividers
        ]
        
        return any(indicator in content for indicator in structure_indicators)
    
    def _extract_overlap(self, lines: List[str], overlap_lines: int) -> str:
        """Extract overlap content from end of chunk"""
        if len(lines) <= overlap_lines:
            return '\n'.join(lines)
        return '\n'.join(lines[-overlap_lines:])
    
    def _extract_sentence_overlap(self, sentences: List[str], overlap_count: int) -> str:
        """Extract sentence overlap"""
        if len(sentences) <= overlap_count:
            return ' '.join(sentences)
        return ' '.join(sentences[-overlap_count:])
    
    def _generate_chunk_id(self, content: str, index: int) -> str:
        """Generate unique chunk ID"""
        content_hash = hashlib.md5(content.encode()).hexdigest()[:8]
        return f"chunk_{index}_{content_hash}"
    
    def _post_process_chunks(
        self, chunks: List[ChunkContext], strategy: ChunkStrategy
    ) -> List[ChunkContext]:
        """Post-process chunks to update metadata"""
        total_chunks = len(chunks)
        
        for chunk in chunks:
            chunk.total_chunks = total_chunks
            chunk.metadata.update({
                "total_chunks": total_chunks,
                "strategy": strategy.value,
                "chunk_size": len(chunk.content)
            })
        
        logger.info(f"Created {total_chunks} chunks using {strategy.value} strategy")
        return chunks


class ResponseAggregator:
    """Enterprise response aggregation with intelligent merging"""
    
    def __init__(self):
        self.merge_strategies = {
            ChunkStrategy.FUNCTION_BASED: self._merge_code_responses,
            ChunkStrategy.SEMANTIC: self._merge_semantic_responses,
            ChunkStrategy.SENTENCE_BASED: self._merge_text_responses,
            ChunkStrategy.TOKEN_BASED: self._merge_sequential_responses,
            ChunkStrategy.HYBRID: self._merge_adaptive_responses
        }
    
    async def aggregate_responses(
        self, 
        responses: List[ModelResponse],
        chunks: List[ChunkContext],
        original_strategy: ChunkStrategy
    ) -> AggregatedResponse:
        """Aggregate multiple responses using strategy-specific logic"""
        
        if not responses:
            return AggregatedResponse(
                content="",
                model="unknown",
                total_input_tokens=0,
                total_output_tokens=0,
                total_response_time=0.0,
                chunk_count=0,
                success=False,
                metadata={"error": "No responses to aggregate"}
            )
        
        # Filter successful responses
        successful_responses = [r for r in responses if r.success]
        failed_chunks = [
            chunks[i].chunk_id for i, r in enumerate(responses) 
            if not r.success and i < len(chunks)
        ]
        
        if not successful_responses:
            return AggregatedResponse(
                content="",
                model=responses[0].model,
                total_input_tokens=sum(r.input_tokens for r in responses),
                total_output_tokens=0,
                total_response_time=sum(r.response_time for r in responses),
                chunk_count=len(responses),
                success=False,
                failed_chunks=failed_chunks,
                metadata={"error": "All chunks failed"}
            )
        
        # Apply strategy-specific merging
        merge_func = self.merge_strategies.get(
            original_strategy, 
            self._merge_sequential_responses
        )
        
        merged_content = await merge_func(successful_responses, chunks)
        
        # Aggregate tool calls
        all_tool_calls = []
        for response in successful_responses:
            all_tool_calls.extend(response.tool_calls)
        
        # Calculate totals
        total_input_tokens = sum(r.input_tokens for r in responses)
        total_output_tokens = sum(r.output_tokens for r in successful_responses)
        total_response_time = sum(r.response_time for r in responses)
        
        return AggregatedResponse(
            content=merged_content,
            model=responses[0].model,
            total_input_tokens=total_input_tokens,
            total_output_tokens=total_output_tokens,
            total_response_time=total_response_time,
            chunk_count=len(responses),
            success=len(successful_responses) > 0,
            failed_chunks=failed_chunks,
            tool_calls=all_tool_calls,
            metadata={
                "strategy": original_strategy.value,
                "success_rate": len(successful_responses) / len(responses),
                "chunks_processed": len(responses),
                "chunks_successful": len(successful_responses)
            }
        )
    
    async def _merge_code_responses(
        self, responses: List[ModelResponse], chunks: List[ChunkContext]
    ) -> str:
        """Merge code responses maintaining structure"""
        
        # Sort responses by chunk index
        sorted_pairs = sorted(
            [(r, chunks[i]) for i, r in enumerate(responses) if i < len(chunks)],
            key=lambda x: x[1].chunk_index
        )
        
        merged_parts = []
        prev_overlap = ""
        
        for response, chunk in sorted_pairs:
            content = response.content.strip()
            
            # Remove overlap with previous chunk
            if prev_overlap and content.startswith(prev_overlap.strip()):
                content = content[len(prev_overlap.strip()):].lstrip()
            
            merged_parts.append(content)
            
            # Extract overlap for next iteration
            if chunk.overlap_content:
                lines = content.split('\n')
                if len(lines) >= 3:
                    prev_overlap = '\n'.join(lines[-3:])
                else:
                    prev_overlap = content
        
        return '\n\n'.join(merged_parts)
    
    async def _merge_semantic_responses(
        self, responses: List[ModelResponse], chunks: List[ChunkContext]
    ) -> str:
        """Merge semantic responses preserving meaning"""
        
        # Sort by chunk index
        sorted_pairs = sorted(
            [(r, chunks[i]) for i, r in enumerate(responses) if i < len(chunks)],
            key=lambda x: x[1].chunk_index
        )
        
        merged_sections = []
        
        for response, chunk in sorted_pairs:
            content = response.content.strip()
            
            # For semantic chunks, preserve paragraph structure
            if content:
                merged_sections.append(content)
        
        # Join with double newlines to preserve semantic boundaries
        return '\n\n'.join(merged_sections)
    
    async def _merge_text_responses(
        self, responses: List[ModelResponse], chunks: List[ChunkContext]
    ) -> str:
        """Merge text responses with sentence-level deduplication"""
        
        # Sort by chunk index
        sorted_pairs = sorted(
            [(r, chunks[i]) for i, r in enumerate(responses) if i < len(chunks)],
            key=lambda x: x[1].chunk_index
        )
        
        all_sentences = []
        seen_sentences = set()
        
        for response, chunk in sorted_pairs:
            content = response.content.strip()
            
            # Split into sentences
            import re
            sentences = re.split(r'(?<=[.!?])\s+', content)
            
            for sentence in sentences:
                sentence = sentence.strip()
                if sentence and sentence not in seen_sentences:
                    all_sentences.append(sentence)
                    seen_sentences.add(sentence)
        
        return ' '.join(all_sentences)
    
    async def _merge_sequential_responses(
        self, responses: List[ModelResponse], chunks: List[ChunkContext]
    ) -> str:
        """Simple sequential merge for token-based chunks"""
        
        # Sort by chunk index
        sorted_pairs = sorted(
            [(r, chunks[i]) for i, r in enumerate(responses) if i < len(chunks)],
            key=lambda x: x[1].chunk_index
        )
        
        merged_content = []
        
        for response, chunk in sorted_pairs:
            content = response.content.strip()
            if content:
                merged_content.append(content)
        
        return '\n'.join(merged_content)
    
    async def _merge_adaptive_responses(
        self, responses: List[ModelResponse], chunks: List[ChunkContext]
    ) -> str:
        """Adaptive merge based on detected chunk strategies"""
        
        if not chunks:
            return await self._merge_sequential_responses(responses, chunks)
        
        # Determine predominant strategy from chunks
        strategies = [chunk.strategy_used for chunk in chunks]
        strategy_counts = {}
        for strategy in strategies:
            strategy_counts[strategy] = strategy_counts.get(strategy, 0) + 1
        
        # Use most common strategy
        predominant_strategy = max(strategy_counts, key=strategy_counts.get)
        merge_func = self.merge_strategies.get(
            predominant_strategy, 
            self._merge_sequential_responses
        )
        
        return await merge_func(responses, chunks)
    
    def calculate_quality_score(self, aggregated: AggregatedResponse) -> float:
        """Calculate quality score for aggregated response"""
        
        factors = {
            "success_rate": aggregated.metadata.get("success_rate", 0.0) * 0.4,
            "chunk_efficiency": min(1.0, 10.0 / max(aggregated.chunk_count, 1)) * 0.3,
            "content_completeness": min(1.0, len(aggregated.content) / 1000) * 0.2,
            "response_time": max(0.0, 1.0 - aggregated.total_response_time / 60.0) * 0.1
        }
        
        return sum(factors.values())


class AIModelService:
    """Enterprise AI Model Service with Azure AI Inference SDK"""
    
    def __init__(self):
        self.router = ModelRouter()
        self.chunker = ChunkManager()
        self.aggregator = ResponseAggregator()        
        self.clients: Dict[str, ChatCompletionsClient] = {}
        self.tools: Dict[str, ToolDefinition] = {}
        self.initialized = False
    
    async def initialize(self):
        """Initialize the service with Azure AI clients"""
        try:
            # Initialize clients for each model (lightweight initialization)
            for model in MODEL_CONFIGS.keys():
                try:
                    self.clients[model] = ChatCompletionsClient(
                        endpoint=settings.GITHUB_AI_BASE_URL,
                        credential=AzureKeyCredential(settings.GITHUB_TOKEN)
                    )
                    logger.debug(f"Initialized Azure AI client for {model}")
                except Exception as e:
                    logger.warning(f"Failed to initialize client for {model}: {e}")
            
            # Register default tools (lightweight - avoid potential blocking)
            try:
                await self._register_default_tools()
                logger.debug("Default tools registered")
            except Exception as e:
                logger.warning(f"Failed to register tools: {e}")
            
            self.initialized = True
            logger.info("AI Model Service initialized with Azure AI Inference SDK")
            
        except Exception as e:
            logger.error(f"Failed to initialize AI Model Service: {e}")
            # Don't raise in development mode to allow the app to start
            logger.warning("Continuing without full AI service initialization")
    
    async def close(self):
        """Clean shutdown of service"""
        try:
            # Close health checker
            await self.router.health_checker.close()
            
            # Clear clients (Azure SDK handles cleanup automatically)
            self.clients.clear()
            
            self.initialized = False
            logger.info("AI Model Service closed")
            
        except Exception as e:
            logger.error(f"Error closing AI Model Service: {e}")
    
    async def generate_response(
        self,
        prompt: str,
        context: str = "",
        task_type: str = "auto",
        model: Optional[str] = None,
        project_id: Optional[str] = None,
        tools: Optional[List[str]] = None,
        chunking_strategy: ChunkStrategy = ChunkStrategy.HYBRID,
        max_retries: int = 3
    ) -> Union[ModelResponse, AggregatedResponse]:
        """Generate response with enterprise-grade error handling and chunking"""
        
        if not self.initialized:
            await self.initialize()
        
        start_time = time.time()
        
        try:
            # Select optimal model
            requires_tools = tools is not None and len(tools) > 0
            if not model:
                model = await self.router.select_model(
                    task_type, 
                    len(prompt + context),
                    requires_tools
                )
            
            # Prepare tool definitions if needed
            tool_definitions = None
            if tools:
                tool_definitions = self._prepare_tool_definitions(tools)
            
            # Chunk content intelligently
            chunks = await self.chunker.chunk_content(
                prompt, context, model, chunking_strategy
            )
            
            if len(chunks) == 1:
                # Single request
                response = await self._make_single_request(
                    chunks[0], model, tool_definitions, max_retries
                )
                
                # Update router stats
                self.router.update_usage_stats(model, response)
                
                # Log usage
                await self._log_usage(response, project_id, single_request=True)
                
                return response
            else:
                # Multiple chunk processing
                logger.info(f"Processing {len(chunks)} chunks for request")
                
                # Process chunks with controlled concurrency
                chunk_responses = await self._process_chunks_concurrently(
                    chunks, model, tool_definitions, max_retries
                )
                
                # Aggregate responses
                aggregated = await self.aggregator.aggregate_responses(
                    chunk_responses, chunks, chunking_strategy
                )
                
                # Log aggregated usage
                await self._log_aggregated_usage(aggregated, project_id)
                
                return aggregated
                
        except Exception as e:
            logger.error(f"Error in generate_response: {e}")
            error_response = ModelResponse(
                content="",
                model=model or "unknown",
                input_tokens=0,
                output_tokens=0,
                total_tokens=0,
                response_time=time.time() - start_time,
                success=False,
                error=str(e)
            )
            
            await self._log_usage(error_response, project_id, single_request=True)
            return error_response
    
    async def _make_single_request(
        self,
        chunk: ChunkContext,
        model: str,
        tool_definitions: Optional[List[ChatCompletionsToolDefinition]] = None,
        max_retries: int = 3
    ) -> ModelResponse:
        """Make single request to Azure AI model with retries"""
        
        start_time = time.time()
        last_error = None
        
        for attempt in range(max_retries):
            try:
                # Get client for model
                client = self.clients.get(model)
                if not client:
                    raise ValueError(f"No client available for model {model}")
                
                # Prepare messages
                messages = []
                
                # Add system context if available
                if chunk.metadata.get("context"):
                    messages.append(SystemMessage(content=chunk.metadata["context"]))
                
                # Add user content
                messages.append(UserMessage(content=chunk.content))
                
                # Prepare request parameters
                request_params = {
                    "messages": messages,
                    "model": model,
                    "max_tokens": min(
                        MODEL_CONFIGS[model]["max_tokens"],
                        settings.MAX_TOKENS_PER_REQUEST - settings.TOKEN_SAFETY_BUFFER
                    ),
                    "temperature": MODEL_CONFIGS[model]["temperature"]
                }
                
                # Add tools if provided
                if tool_definitions:
                    request_params["tools"] = tool_definitions
                    request_params["tool_choice"] = "auto"
                
                # Make request (run sync method in thread)
                response = await asyncio.wait_for(
                    asyncio.to_thread(client.complete, **request_params),
                    timeout=settings.DEFAULT_TIMEOUT_SECONDS
                )
                
                # Process response
                if not response or not response.choices:
                    raise ValueError("Empty response from model")
                
                choice = response.choices[0]
                content = choice.message.content or ""
                
                # Extract tool calls if present
                tool_calls = []
                if hasattr(choice.message, 'tool_calls') and choice.message.tool_calls:
                    tool_calls = list(choice.message.tool_calls)
                    
                    # Process tool calls
                    for tool_call in tool_calls:
                        if tool_call.function.name in self.tools:
                            try:
                                # Execute tool function
                                tool_result = await self._execute_tool(tool_call)
                                content += f"\n\nTool Result: {tool_result}"
                            except Exception as e:
                                logger.error(f"Tool execution failed: {e}")
                                content += f"\n\nTool Error: {str(e)}"
                
                # Extract usage information
                usage = getattr(response, 'usage', None)
                input_tokens = usage.prompt_tokens if usage else 0
                output_tokens = usage.completion_tokens if usage else 0
                
                return ModelResponse(
                    content=content,
                    model=model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=input_tokens + output_tokens,
                    response_time=time.time() - start_time,
                    success=True,
                    chunk_id=chunk.chunk_id,
                    tool_calls=tool_calls,
                    finish_reason=getattr(choice, 'finish_reason', None),
                    metadata={
                        "attempt": attempt + 1,
                        "chunk_index": chunk.chunk_index,
                        "strategy": chunk.strategy_used.value
                    }
                )
                
            except asyncio.TimeoutError:
                last_error = f"Request timeout after {settings.DEFAULT_TIMEOUT_SECONDS}s"
                logger.warning(f"Attempt {attempt + 1} timed out for model {model}")
                
            except (HttpResponseError, ServiceRequestError) as e:
                last_error = f"Azure AI error: {str(e)}"
                logger.warning(f"Attempt {attempt + 1} failed for model {model}: {e}")
                
                # Check if it's a rate limit error
                if hasattr(e, 'status_code') and e.status_code == 429:
                    # Exponential backoff for rate limits
                    await asyncio.sleep(2 ** attempt)
                
            except Exception as e:
                last_error = str(e)
                logger.error(f"Attempt {attempt + 1} failed for model {model}: {e}")
            
            # Wait before retry (except for last attempt)
            if attempt < max_retries - 1:
                await asyncio.sleep(1.0 * (attempt + 1))
        
        # All retries failed
        return ModelResponse(
            content="",
            model=model,
            input_tokens=0,
            output_tokens=0,
            total_tokens=0,
            response_time=time.time() - start_time,
            success=False,
            chunk_id=chunk.chunk_id,
            error=f"All {max_retries} attempts failed. Last error: {last_error}",
            metadata={"max_retries_exceeded": True}
        )
    
    async def _process_chunks_concurrently(
        self,
        chunks: List[ChunkContext],
        model: str,
        tool_definitions: Optional[List[ChatCompletionsToolDefinition]],
        max_retries: int
    ) -> List[ModelResponse]:
        """Process multiple chunks with controlled concurrency"""
        
        # Limit concurrent requests to avoid overwhelming the API
        max_concurrent = min(len(chunks), 5)
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def process_chunk_with_semaphore(chunk: ChunkContext) -> ModelResponse:
            async with semaphore:
                return await self._make_single_request(
                    chunk, model, tool_definitions, max_retries
                )
        
        # Process all chunks
        tasks = [process_chunk_with_semaphore(chunk) for chunk in chunks]
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Convert exceptions to error responses
        final_responses = []
        for i, response in enumerate(responses):
            if isinstance(response, Exception):
                final_responses.append(ModelResponse(
                    content="",
                    model=model,
                    input_tokens=0,
                    output_tokens=0,
                    total_tokens=0,
                    response_time=0.0,
                    success=False,
                    chunk_id=chunks[i].chunk_id if i < len(chunks) else f"chunk_{i}",
                    error=str(response)
                ))
            else:
                final_responses.append(response)
        
        return final_responses
    
    async def _execute_tool(self, tool_call: ChatCompletionsToolCall) -> str:
        """Execute a tool function call"""
        tool_name = tool_call.function.name
        
        if tool_name not in self.tools:
            raise ValueError(f"Unknown tool: {tool_name}")
        
        tool_def = self.tools[tool_name]
        if not tool_def.function:
            raise ValueError(f"No function implementation for tool: {tool_name}")
        
        # Parse arguments
        try:
            import json
            args = json.loads(tool_call.function.arguments)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid tool arguments: {e}")
        
        # Execute function
        if asyncio.iscoroutinefunction(tool_def.function):
            return await tool_def.function(**args)
        else:
            return tool_def.function(**args)
    
    def _prepare_tool_definitions(
        self, tool_names: List[str]
    ) -> List[ChatCompletionsToolDefinition]:
        """Prepare Azure AI tool definitions"""
        tool_definitions = []
        
        for tool_name in tool_names:
            if tool_name in self.tools:
                tool_def = self.tools[tool_name]
                azure_tool = ChatCompletionsToolDefinition(
                    type="function",
                    function=FunctionDefinition(
                        name=tool_def.name,
                        description=tool_def.description,
                        parameters=tool_def.parameters
                    )
                )
                tool_definitions.append(azure_tool)
        
        return tool_definitions
    
    async def _register_default_tools(self):
        """Register default tools for code generation"""
        
        # Code execution tool
        self.tools["execute_code"] = ToolDefinition(
            name="execute_code",
            description="Execute Python code safely",
            parameters={
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "Python code to execute"
                    },
                    "language": {
                        "type": "string",
                        "enum": ["python", "javascript"],
                        "description": "Programming language"
                    }
                },
                "required": ["code"]
            },
            function=self._execute_code_tool
        )
        
        # File analysis tool
        self.tools["analyze_file"] = ToolDefinition(
            name="analyze_file",
            description="Analyze file structure and content",
            parameters={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Path to file to analyze"
                    },
                    "analysis_type": {
                        "type": "string",
                        "enum": ["structure", "syntax", "dependencies"],
                        "description": "Type of analysis to perform"
                    }
                },
                "required": ["file_path"]
            },
            function=self._analyze_file_tool
        )
    
    async def _execute_code_tool(self, code: str, language: str = "python") -> str:
        """Safe code execution tool"""
        try:
            if language == "python":
                # Basic Python execution (would need proper sandboxing in production)
                import subprocess
                result = subprocess.run(
                    ["python", "-c", code],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                return f"Output: {result.stdout}\nErrors: {result.stderr}"
            else:
                return f"Language {language} not supported in this tool"
        except subprocess.TimeoutExpired:
            return "Code execution timed out"
        except Exception as e:
            return f"Execution error: {str(e)}"
    
    async def _analyze_file_tool(self, file_path: str, analysis_type: str = "structure") -> str:
        """File analysis tool"""
        try:
            import os
            if not os.path.exists(file_path):
                return f"File not found: {file_path}"
            
            if analysis_type == "structure":
                # Basic file structure analysis
                stat = os.stat(file_path)
                return f"File: {file_path}\nSize: {stat.st_size} bytes\nType: {os.path.splitext(file_path)[1]}"            
            return f"Analysis type {analysis_type} not implemented"
            
        except Exception as e:
            return f"Analysis error: {str(e)}"
    
    async def _log_usage(
        self, 
        response: ModelResponse, 
        project_id: Optional[str],
        single_request: bool = False
    ):
        """Log model usage to database with enhanced tracking"""
        try:
            async with get_db_session() as session:
                # Extract tool information
                tool_calls_count = len(response.tool_calls) if response.tool_calls else 0
                tools_used = ",".join([tc.function.name for tc in response.tool_calls]) if response.tool_calls else ""
                
                # Get model config
                model_config = MODEL_CONFIGS.get(response.model, {})
                
                usage = ModelUsage(
                    model_name=response.model,
                    input_tokens=response.input_tokens,
                    output_tokens=response.output_tokens,
                    total_tokens=response.total_tokens,
                    response_time=response.response_time,
                    project_id=project_id,
                    success=response.success,
                    error_message=response.error,
                    chunk_id=response.chunk_id,
                    chunk_count=1,
                    is_single_request=single_request,
                    tool_calls_count=tool_calls_count,
                    tools_used=tools_used,
                    finish_reason=response.finish_reason,
                    temperature=model_config.get("temperature"),
                    max_tokens=model_config.get("max_tokens")
                )
                session.add(usage)
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to log model usage: {e}")
    
    async def _log_aggregated_usage(
        self, 
        aggregated: AggregatedResponse, 
        project_id: Optional[str]
    ):
        """Log aggregated usage with chunk information"""
        try:
            async with get_db_session() as session:
                # Extract tool information
                tool_calls_count = len(aggregated.tool_calls) if aggregated.tool_calls else 0
                tools_used = ",".join([tc.function.name for tc in aggregated.tool_calls]) if aggregated.tool_calls else ""
                
                # Get model config
                model_config = MODEL_CONFIGS.get(aggregated.model, {})
                
                usage = ModelUsage(
                    model_name=aggregated.model,
                    input_tokens=aggregated.total_input_tokens,
                    output_tokens=aggregated.total_output_tokens,
                    total_tokens=aggregated.total_input_tokens + aggregated.total_output_tokens,
                    response_time=aggregated.total_response_time,
                    project_id=project_id,
                    success=aggregated.success,
                    error_message=str(aggregated.failed_chunks) if aggregated.failed_chunks else None,
                    chunk_id=None,  # Aggregated request doesn't have single chunk ID
                    chunk_count=aggregated.chunk_count,
                    is_single_request=False,
                    tool_calls_count=tool_calls_count,
                    tools_used=tools_used,
                    finish_reason=None,  # Not applicable for aggregated
                    temperature=model_config.get("temperature"),
                    max_tokens=model_config.get("max_tokens")
                )
                session.add(usage)
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to log aggregated usage: {e}")
    
    async def get_model_stats(self) -> Dict[str, Any]:
        """Get comprehensive model usage statistics"""
        try:
            async with get_db_session() as session:
                # This would involve complex database queries
                # Simplified implementation for now
                healthy_models = await self.router.health_checker.get_healthy_models()
                
                return {
                    "available_models": list(MODEL_CONFIGS.keys()),
                    "healthy_models": healthy_models,
                    "total_requests": 0,  # Would query from database
                    "total_tokens": 0,
                    "average_response_time": 0.0,
                    "success_rate": 100.0,
                    "chunking_stats": {
                        "total_chunks": 0,
                        "avg_chunks_per_request": 0.0
                    },
                    "tool_usage": {
                        "available_tools": list(self.tools.keys()),
                        "total_tool_calls": 0
                    }
                }
        except Exception as e:
            logger.error(f"Failed to get model stats: {e}")
            return {"error": str(e)}
    
    def register_tool(self, tool_def: ToolDefinition):
        """Register a custom tool"""
        self.tools[tool_def.name] = tool_def
        logger.info(f"Registered tool: {tool_def.name}")
    
    def get_available_tools(self) -> List[str]:
        """Get list of available tools"""
        return list(self.tools.keys())


# Create global service instance
ai_model_service = AIModelService()
