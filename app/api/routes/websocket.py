"""
WebSocket API Routes
Handles real-time communication for Aoede application
"""
import json
import asyncio
import logging
from typing import Dict, Set, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from uuid import UUID

from app.core.config import settings
from app.services.ai_model import ai_model_service
from app.services.code_generation import code_generation_service
from app.services.testing_validation import testing_validation_service

logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectionManager:
    """Manages WebSocket connections"""
    
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "project_status": set(),
            "generation_progress": set(),
            "test_results": set(),
            "model_status": set()
        }
        self.project_connections: Dict[str, Set[WebSocket]] = {}
        
    async def connect(self, websocket: WebSocket, connection_type: str, project_id: str = None):
        """Accept a WebSocket connection"""
        await websocket.accept()
        
        if connection_type in self.active_connections:
            self.active_connections[connection_type].add(websocket)
            
        if project_id:
            if project_id not in self.project_connections:
                self.project_connections[project_id] = set()
            self.project_connections[project_id].add(websocket)
            
        logger.info(f"WebSocket connected: {connection_type}, project: {project_id}")
    
    def disconnect(self, websocket: WebSocket, connection_type: str, project_id: str = None):
        """Remove a WebSocket connection"""
        if connection_type in self.active_connections:
            self.active_connections[connection_type].discard(websocket)
            
        if project_id and project_id in self.project_connections:
            self.project_connections[project_id].discard(websocket)
            if not self.project_connections[project_id]:
                del self.project_connections[project_id]
                
        logger.info(f"WebSocket disconnected: {connection_type}, project: {project_id}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        """Send a message to a specific WebSocket"""
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
    
    async def broadcast_to_type(self, message: str, connection_type: str):
        """Broadcast a message to all connections of a specific type"""
        if connection_type not in self.active_connections:
            return
            
        connections = self.active_connections[connection_type].copy()
        for connection in connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to {connection_type}: {e}")
                self.active_connections[connection_type].discard(connection)
    
    async def broadcast_to_project(self, message: str, project_id: str):
        """Broadcast a message to all connections for a specific project"""
        if project_id not in self.project_connections:
            return
            
        connections = self.project_connections[project_id].copy()
        for connection in connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to project {project_id}: {e}")
                self.project_connections[project_id].discard(connection)

# Global connection manager
manager = ConnectionManager()

@router.websocket("/ws/project/{project_id}/status")
async def websocket_project_status(websocket: WebSocket, project_id: str):
    """WebSocket endpoint for project status updates"""
    await manager.connect(websocket, "project_status", project_id)
    
    try:
        # Send initial status
        initial_status = {
            "type": "project_status",
            "project_id": project_id,
            "status": "connected",
            "timestamp": str(asyncio.get_event_loop().time())
        }
        await manager.send_personal_message(json.dumps(initial_status), websocket)
        
        while True:
            # Wait for messages from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle client messages
            if message.get("type") == "ping":
                pong_response = {
                    "type": "pong",
                    "timestamp": str(asyncio.get_event_loop().time())
                }
                await manager.send_personal_message(json.dumps(pong_response), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, "project_status", project_id)
    except Exception as e:
        logger.error(f"WebSocket error for project {project_id}: {e}")
        manager.disconnect(websocket, "project_status", project_id)

@router.websocket("/ws/generation/progress")
async def websocket_generation_progress(websocket: WebSocket):
    """WebSocket endpoint for code generation progress updates"""
    await manager.connect(websocket, "generation_progress")
    
    try:
        # Send initial status
        initial_status = {
            "type": "generation_progress",
            "status": "connected",
            "timestamp": str(asyncio.get_event_loop().time())
        }
        await manager.send_personal_message(json.dumps(initial_status), websocket)
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle client messages
            if message.get("type") == "ping":
                pong_response = {
                    "type": "pong",
                    "timestamp": str(asyncio.get_event_loop().time())
                }
                await manager.send_personal_message(json.dumps(pong_response), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, "generation_progress")
    except Exception as e:
        logger.error(f"WebSocket error for generation progress: {e}")
        manager.disconnect(websocket, "generation_progress")

@router.websocket("/ws/testing/results")
async def websocket_test_results(websocket: WebSocket):
    """WebSocket endpoint for test result updates"""
    await manager.connect(websocket, "test_results")
    
    try:
        # Send initial status
        initial_status = {
            "type": "test_results",
            "status": "connected",
            "timestamp": str(asyncio.get_event_loop().time())
        }
        await manager.send_personal_message(json.dumps(initial_status), websocket)
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle client messages
            if message.get("type") == "ping":
                pong_response = {
                    "type": "pong",
                    "timestamp": str(asyncio.get_event_loop().time())
                }
                await manager.send_personal_message(json.dumps(pong_response), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, "test_results")
    except Exception as e:
        logger.error(f"WebSocket error for test results: {e}")
        manager.disconnect(websocket, "test_results")

@router.websocket("/ws/models/status")
async def websocket_model_status(websocket: WebSocket):
    """WebSocket endpoint for AI model status updates"""
    await manager.connect(websocket, "model_status")
    
    try:
        # Send initial model status
        model_status = await ai_model_service.get_all_model_status()
        initial_status = {
            "type": "model_status",
            "models": model_status,
            "timestamp": str(asyncio.get_event_loop().time())
        }
        await manager.send_personal_message(json.dumps(initial_status), websocket)
        
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle client messages
            if message.get("type") == "ping":
                pong_response = {
                    "type": "pong",
                    "timestamp": str(asyncio.get_event_loop().time())
                }
                await manager.send_personal_message(json.dumps(pong_response), websocket)
            elif message.get("type") == "refresh_models":
                # Send updated model status
                updated_status = await ai_model_service.get_all_model_status()
                refresh_response = {
                    "type": "model_status_update",
                    "models": updated_status,
                    "timestamp": str(asyncio.get_event_loop().time())
                }
                await manager.send_personal_message(json.dumps(refresh_response), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, "model_status")
    except Exception as e:
        logger.error(f"WebSocket error for model status: {e}")
        manager.disconnect(websocket, "model_status")

# Helper functions for broadcasting updates

async def broadcast_project_update(project_id: str, update_data: Dict[str, Any]):
    """Broadcast an update to all clients connected to a specific project"""
    message = {
        "type": "project_update",
        "project_id": project_id,
        "data": update_data,
        "timestamp": str(asyncio.get_event_loop().time())
    }
    await manager.broadcast_to_project(json.dumps(message), project_id)

async def broadcast_generation_progress(generation_id: str, progress_data: Dict[str, Any]):
    """Broadcast generation progress to all connected clients"""
    message = {
        "type": "generation_progress_update",
        "generation_id": generation_id,
        "data": progress_data,
        "timestamp": str(asyncio.get_event_loop().time())
    }
    await manager.broadcast_to_type(json.dumps(message), "generation_progress")

async def broadcast_test_results(generation_id: str, test_data: Dict[str, Any]):
    """Broadcast test results to all connected clients"""
    message = {
        "type": "test_results_update",
        "generation_id": generation_id,
        "data": test_data,
        "timestamp": str(asyncio.get_event_loop().time())
    }
    await manager.broadcast_to_type(json.dumps(message), "test_results")

async def broadcast_model_status_change(model_name: str, status_data: Dict[str, Any]):
    """Broadcast model status changes to all connected clients"""
    message = {
        "type": "model_status_change",
        "model_name": model_name,
        "data": status_data,
        "timestamp": str(asyncio.get_event_loop().time())
    }
    await manager.broadcast_to_type(json.dumps(message), "model_status")

# Background task for periodic updates
async def periodic_model_health_check():
    """Periodically check model health and broadcast updates"""
    while True:
        try:
            model_status = await ai_model_service.get_all_model_status()
            message = {
                "type": "periodic_model_update",
                "models": model_status,
                "timestamp": str(asyncio.get_event_loop().time())
            }
            await manager.broadcast_to_type(json.dumps(message), "model_status")
            
            # Wait 30 seconds before next check
            await asyncio.sleep(30)
            
        except Exception as e:
            logger.error(f"Error in periodic model health check: {e}")
            await asyncio.sleep(60)  # Wait longer on error

# Start background tasks when module loads
async def start_background_tasks():
    """Start background tasks for WebSocket updates"""
    asyncio.create_task(periodic_model_health_check())

# Utility function to get connection manager
def get_connection_manager() -> ConnectionManager:
    """Get the global connection manager instance"""
    return manager
