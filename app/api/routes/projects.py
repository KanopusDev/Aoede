"""
Project management endpoints
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
import time

from app.core.database import get_db_session
from app.models import Project, ProjectStatus, CodeGeneration
from app.models.user import User
from app.core.logging import get_logger
from app.api.routes.auth import get_current_active_user
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

logger = get_logger(__name__)
router = APIRouter()


class ProjectCreate(BaseModel):
    """Project creation schema"""
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Project update schema"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None


class ProjectResponse(BaseModel):
    """Project response schema"""
    id: UUID
    name: str
    description: Optional[str]
    status: ProjectStatus
    user_id: UUID
    created_at: str
    updated_at: Optional[str]
    code_generations_count: int
    
    model_config = {"from_attributes": True}


class ProjectDetailResponse(ProjectResponse):
    """Detailed project response with code generations"""
    code_generations: List[Dict[str, Any]]


@router.post("/", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_active_user)
):
    """Create a new project"""
    try:
        async with get_db_session() as session:
            # Create new project
            project = Project(
                name=project_data.name,
                description=project_data.description,
                user_id=current_user.id,
                status=ProjectStatus.ACTIVE
            )
            
            session.add(project)
            await session.commit()
            await session.refresh(project)
            
            logger.info(f"Created project {project.id} with name '{project.name}' for user {current_user.username}")
            
            # Return project response
            return ProjectResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                status=project.status,
                user_id=project.user_id,
                created_at=project.created_at.isoformat(),
                updated_at=project.updated_at.isoformat() if project.updated_at else None,
                code_generations_count=0
            )
            
    except Exception as e:
        logger.error(f"Failed to create project: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@router.get("/", response_model=List[ProjectResponse])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    status: Optional[ProjectStatus] = None,
    current_user: User = Depends(get_current_active_user)
):
    """List projects for the current user"""
    try:
        async with get_db_session() as session:
            # Build query for current user's projects only
            query = select(Project).where(Project.user_id == current_user.id)
            
            # Add optional status filter
            if status:
                query = query.where(Project.status == status)
            
            # Add pagination
            query = query.offset(skip).limit(limit).order_by(Project.created_at.desc())
            
            result = await session.execute(query)
            projects = result.scalars().all()
            
            # Get code generation counts
            project_responses = []
            for project in projects:
                # Count code generations for this project
                gen_query = select(CodeGeneration).where(CodeGeneration.project_id == project.id)
                gen_result = await session.execute(gen_query)
                gen_count = len(gen_result.scalars().all())
                
                project_responses.append(ProjectResponse(
                    id=project.id,
                    name=project.name,
                    description=project.description,
                    status=project.status,
                    user_id=project.user_id,
                    created_at=project.created_at.isoformat(),
                    updated_at=project.updated_at.isoformat() if project.updated_at else None,
                    code_generations_count=gen_count
                ))
            
            logger.info(f"Listed {len(project_responses)} projects for user {current_user.username}")
            return project_responses
            
    except Exception as e:
        logger.error(f"Failed to list projects: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list projects: {str(e)}")


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_active_user)
):
    """Get project by ID with detailed information"""
    try:
        async with get_db_session() as session:
            # Get project with code generations (ensure it belongs to current user)
            query = select(Project).options(
                selectinload(Project.code_generations)
            ).where(
                Project.id == project_id,
                Project.user_id == current_user.id
            )
            
            result = await session.execute(query)
            project = result.scalar_one_or_none()
            
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            # Convert code generations to dict format
            code_generations = []
            for gen in project.code_generations:
                code_generations.append({
                    "id": str(gen.id),
                    "model_used": gen.model_used,
                    "language": gen.language.value,
                    "version": gen.version,
                    "created_at": gen.created_at.isoformat(),
                    "tokens_used": gen.tokens_used,
                    "generation_time": gen.generation_time
                })
            
            return ProjectDetailResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                status=project.status,
                user_id=project.user_id,
                created_at=project.created_at.isoformat(),
                updated_at=project.updated_at.isoformat() if project.updated_at else None,
                code_generations_count=len(code_generations),
                code_generations=code_generations
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project: {str(e)}")


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID, 
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_active_user)
):
    """Update project"""
    try:
        async with get_db_session() as session:
            # Get existing project (ensure it belongs to current user)
            query = select(Project).where(
                Project.id == project_id,
                Project.user_id == current_user.id
            )
            result = await session.execute(query)
            project = result.scalar_one_or_none()
            
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            # Update fields
            update_data = {}
            if project_data.name is not None:
                update_data["name"] = project_data.name
            if project_data.description is not None:
                update_data["description"] = project_data.description
            if project_data.status is not None:
                update_data["status"] = project_data.status
            
            if update_data:
                update_data["updated_at"] = time.time()
                
                update_query = update(Project).where(
                    Project.id == project_id
                ).values(**update_data)
                
                await session.execute(update_query)
                await session.commit()
                
                # Refresh project
                await session.refresh(project)
            
            logger.info(f"Updated project {project_id}")
            
            # Count code generations
            gen_count_query = select(CodeGeneration).where(
                CodeGeneration.project_id == project.id
            )
            gen_count_result = await session.execute(gen_count_query)
            gen_count = len(gen_count_result.scalars().all())
            
            return ProjectResponse(
                id=project.id,
                name=project.name,
                description=project.description,
                status=project.status,
                user_id=project.user_id,
                created_at=project.created_at.isoformat(),
                updated_at=project.updated_at.isoformat() if project.updated_at else None,
                code_generations_count=gen_count
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update project: {str(e)}")


@router.delete("/{project_id}")
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_active_user)
):
    """Delete project and all associated data"""
    try:
        async with get_db_session() as session:
            # Check if project exists and belongs to current user
            query = select(Project).where(
                Project.id == project_id,
                Project.user_id == current_user.id
            )
            result = await session.execute(query)
            project = result.scalar_one_or_none()
            
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            # Delete project (cascade will handle related data)
            delete_query = delete(Project).where(Project.id == project_id)
            await session.execute(delete_query)
            await session.commit()
            
            logger.info(f"Deleted project {project_id} for user {current_user.username}")
            
            return {"message": "Project deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete project {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")


@router.get("/{project_id}/stats")
async def get_project_stats(
    project_id: UUID,
    current_user: User = Depends(get_current_active_user)
):
    """Get project statistics"""
    try:
        async with get_db_session() as session:
            # Check if project exists and belongs to current user
            query = select(Project).where(
                Project.id == project_id,
                Project.user_id == current_user.id
            )
            result = await session.execute(query)
            project = result.scalar_one_or_none()
            
            if not project:
                raise HTTPException(status_code=404, detail="Project not found")
            
            # Get code generations stats
            gen_query = select(CodeGeneration).where(
                CodeGeneration.project_id == project_id
            )
            gen_result = await session.execute(gen_query)
            generations = gen_result.scalars().all()
            
            # Calculate stats
            total_generations = len(generations)
            total_tokens = sum(gen.tokens_used or 0 for gen in generations)
            avg_generation_time = sum(gen.generation_time or 0 for gen in generations) / max(total_generations, 1)
            
            # Language breakdown
            language_stats = {}
            for gen in generations:
                lang = gen.language.value
                if lang not in language_stats:
                    language_stats[lang] = 0
                language_stats[lang] += 1
            
            # Model usage
            model_stats = {}
            for gen in generations:
                model = gen.model_used
                if model not in model_stats:
                    model_stats[model] = 0
                model_stats[model] += 1
            
            return {
                "project_id": str(project_id),
                "project_name": project.name,
                "total_generations": total_generations,
                "total_tokens_used": total_tokens,
                "average_generation_time": round(avg_generation_time, 2),
                "language_breakdown": language_stats,
                "model_usage": model_stats,
                "project_created": project.created_at.isoformat(),
                "last_activity": max(
                    (gen.created_at for gen in generations),
                    default=project.created_at
                ).isoformat()
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project stats {project_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get project stats: {str(e)}")
