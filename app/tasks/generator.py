"""
Background tasks for code generation
"""
import asyncio
import logging
from typing import Dict, Any
from celery import Task

from app.core.celery import celery_app
from app.services.generator import code_generation_service
from app.services.chunker import chunk_management_service, ContentType
from app.api.routes.websocket import broadcast_generation_progress

logger = logging.getLogger(__name__)

class CallbackTask(Task):
    """Custom task class for WebSocket callbacks"""
    
    def on_success(self, retval, task_id, args, kwargs):
        """Called when task succeeds"""
        asyncio.create_task(
            broadcast_generation_progress(task_id, {
                "status": "completed",
                "result": retval
            })
        )
    
    def on_failure(self, exc, task_id, args, kwargs, einfo):
        """Called when task fails"""
        asyncio.create_task(
            broadcast_generation_progress(task_id, {
                "status": "failed",
                "error": str(exc)
            })
        )

@celery_app.task(base=CallbackTask, bind=True)
def generate_code_async(self, generation_request: Dict[str, Any]):
    """
    Asynchronous code generation task
    """
    try:
        logger.info(f"Starting async code generation: {self.request.id}")
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"status": "Starting code generation", "progress": 0}
        )
        
        # Extract parameters
        project_id = generation_request.get("project_id")
        model_name = generation_request.get("model_name", "mistral-ai/Codestral-2501")
        prompt = generation_request.get("prompt")
        language = generation_request.get("language", "python")
        template_id = generation_request.get("template_id")
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"status": "Analyzing requirements", "progress": 20}
        )
        
        # Generate code
        result = asyncio.run(
            code_generation_service.generate_code(
                project_id=project_id,
                model_name=model_name,
                prompt=prompt,
                language=language,
                template_id=template_id,
                task_id=self.request.id
            )
        )
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"status": "Code generated successfully", "progress": 100}
        )
        
        logger.info(f"Completed async code generation: {self.request.id}")
        return result
        
    except Exception as e:
        logger.error(f"Error in async code generation {self.request.id}: {str(e)}")
        self.update_state(
            state="FAILURE",
            meta={"status": "Generation failed", "error": str(e)}
        )
        raise

@celery_app.task(bind=True)
def chunk_and_generate_code(self, generation_request: Dict[str, Any]):
    """
    Chunk large prompts and generate code in parts
    """
    try:
        logger.info(f"Starting chunked code generation: {self.request.id}")
        
        # Extract parameters
        prompt = generation_request.get("prompt")
        context = generation_request.get("context", "")
        language = generation_request.get("language", "python")
        model_name = generation_request.get("model_name", "mistral-ai/Codestral-2501")
        
        # Determine content type
        content_type_map = {
            "python": ContentType.PYTHON,
            "html": ContentType.HTML,
            "css": ContentType.CSS,
            "javascript": ContentType.JAVASCRIPT
        }
        content_type = content_type_map.get(language, ContentType.TEXT)
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"status": "Chunking large prompt", "progress": 10}
        )
        
        # Chunk the prompt
        chunk_result = chunk_management_service.chunk_content(
            content=prompt,
            context=context,
            content_type=content_type
        )
        
        if not chunk_result.success:
            raise Exception(f"Failed to chunk content: {chunk_result.error_message}")
        
        chunks = chunk_result.chunks
        total_chunks = len(chunks)
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={
                "status": f"Processing {total_chunks} chunks",
                "progress": 20,
                "total_chunks": total_chunks
            }
        )
        
        # Process each chunk
        chunk_results = []
        for i, chunk in enumerate(chunks):
            # Update progress
            progress = 20 + (i / total_chunks) * 60
            self.update_state(
                state="PROGRESS",
                meta={
                    "status": f"Processing chunk {i+1}/{total_chunks}",
                    "progress": progress,
                    "current_chunk": i + 1,
                    "total_chunks": total_chunks
                }
            )
            
            # Generate code for this chunk
            chunk_request = {
                **generation_request,
                "prompt": chunk.content,
                "chunk_index": i,
                "total_chunks": total_chunks
            }
            
            chunk_result = asyncio.run(
                code_generation_service.generate_code_chunk(
                    chunk_request, model_name
                )
            )
            
            chunk_results.append({
                "chunk_index": i,
                "content": chunk_result.get("generated_code", ""),
                "success": chunk_result.get("success", False),
                "error": chunk_result.get("error")
            })
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"status": "Assembling results", "progress": 85}
        )
        
        # Assemble results
        from app.services.chunker import output_assembler
        
        final_result = output_assembler.assemble_responses(
            chunk_results, content_type
        )
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"status": "Chunked generation completed", "progress": 100}
        )
        
        logger.info(f"Completed chunked code generation: {self.request.id}")
        return {
            "success": final_result["success"],
            "generated_code": final_result["assembled_content"],
            "chunks_processed": total_chunks,
            "strategy_used": chunk_result.strategy_used,
            "metadata": final_result.get("metadata", {})
        }
        
    except Exception as e:
        logger.error(f"Error in chunked code generation {self.request.id}: {str(e)}")
        self.update_state(
            state="FAILURE",
            meta={"status": "Chunked generation failed", "error": str(e)}
        )
        raise

@celery_app.task(bind=True)
def batch_generate_code(self, batch_requests: list):
    """
    Process multiple code generation requests in batch
    """
    try:
        logger.info(f"Starting batch code generation: {self.request.id}")
        
        total_requests = len(batch_requests)
        results = []
        
        for i, request in enumerate(batch_requests):
            # Update progress
            progress = (i / total_requests) * 100
            self.update_state(
                state="PROGRESS",
                meta={
                    "status": f"Processing request {i+1}/{total_requests}",
                    "progress": progress,
                    "current_request": i + 1,
                    "total_requests": total_requests
                }
            )
            
            try:
                # Generate code for this request
                result = asyncio.run(
                    code_generation_service.generate_code(
                        project_id=request.get("project_id"),
                        model_name=request.get("model_name", "mistral-ai/Codestral-2501"),
                        prompt=request.get("prompt"),
                        language=request.get("language", "python"),
                        template_id=request.get("template_id")
                    )
                )
                
                results.append({
                    "request_index": i,
                    "success": True,
                    "result": result
                })
                
            except Exception as e:
                logger.error(f"Error processing batch request {i}: {str(e)}")
                results.append({
                    "request_index": i,
                    "success": False,
                    "error": str(e)
                })
        
        # Final update
        self.update_state(
            state="PROGRESS",
            meta={
                "status": "Batch generation completed",
                "progress": 100,
                "total_requests": total_requests,
                "successful": sum(1 for r in results if r["success"]),
                "failed": sum(1 for r in results if not r["success"])
            }
        )
        
        logger.info(f"Completed batch code generation: {self.request.id}")
        return {
            "success": True,
            "total_requests": total_requests,
            "results": results,
            "successful": sum(1 for r in results if r["success"]),
            "failed": sum(1 for r in results if not r["success"])
        }
        
    except Exception as e:
        logger.error(f"Error in batch code generation {self.request.id}: {str(e)}")
        self.update_state(
            state="FAILURE",
            meta={"status": "Batch generation failed", "error": str(e)}
        )
        raise

@celery_app.task(bind=True)
def regenerate_with_fixes(self, generation_id: str, test_errors: list):
    """
    Regenerate code with fixes based on test errors
    """
    try:
        logger.info(f"Starting code regeneration with fixes: {self.request.id}")
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"status": "Analyzing test errors", "progress": 20}
        )
        
        # Regenerate code with fixes
        result = asyncio.run(
            code_generation_service.regenerate_with_fixes(
                generation_id=generation_id,
                test_errors=test_errors,
                task_id=self.request.id
            )
        )
        
        # Update progress
        self.update_state(
            state="PROGRESS",
            meta={"status": "Code regenerated with fixes", "progress": 100}
        )
        
        logger.info(f"Completed code regeneration with fixes: {self.request.id}")
        return result
        
    except Exception as e:
        logger.error(f"Error in code regeneration {self.request.id}: {str(e)}")
        self.update_state(
            state="FAILURE",
            meta={"status": "Regeneration failed", "error": str(e)}
        )
        raise
