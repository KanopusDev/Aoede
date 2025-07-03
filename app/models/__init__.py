"""
Database models for Aoede application
"""
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, Enum, Boolean, ForeignKey, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from datetime import datetime

from app.core.database import Base

# Import user models
from app.models.user import User, UserRole, UserStatus, UserSession, UserAPIKey, UserLoginHistory


class ProjectStatus(str, enum.Enum):
    """Project status enumeration"""
    ACTIVE = "active"
    COMPLETED = "completed"
    ERROR = "error"
    PAUSED = "paused"


class Language(str, enum.Enum):
    """Programming language enumeration"""
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    HTML = "html"
    CSS = "css"


class TestStatus(str, enum.Enum):
    """Test result status enumeration"""
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"
    RUNNING = "running"


class Project(Base):
    """Project model"""
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    status = Column(Enum(ProjectStatus), default=ProjectStatus.ACTIVE, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Relationships
    user = relationship("User", back_populates="projects")
    code_generations = relationship("CodeGeneration", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Project(id={self.id}, name={self.name}, status={self.status})>"


class CodeGeneration(Base):
    """Code generation model"""
    __tablename__ = "code_generations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True)
    model_used = Column(String(100), nullable=False, index=True)
    input_prompt = Column(Text, nullable=False)
    generated_code = Column(Text, nullable=False)
    language = Column(Enum(Language), nullable=False, index=True)
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    tokens_used = Column(Integer)
    generation_time = Column(Float)  # Time in seconds
    
    # Relationships
    project = relationship("Project", back_populates="code_generations")
    test_results = relationship("TestResult", back_populates="generation", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<CodeGeneration(id={self.id}, language={self.language}, model={self.model_used})>"


class TestResult(Base):
    """Test result model"""
    __tablename__ = "test_results"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    generation_id = Column(UUID(as_uuid=True), ForeignKey("code_generations.id"), nullable=False, index=True)
    test_type = Column(String(50), nullable=False)
    status = Column(Enum(TestStatus), nullable=False, index=True)
    error_message = Column(Text)
    execution_time = Column(Float)  # Time in seconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    stdout = Column(Text)
    stderr = Column(Text)
    exit_code = Column(Integer)
    
    # Relationships
    generation = relationship("CodeGeneration", back_populates="test_results")
    
    def __repr__(self):
        return f"<TestResult(id={self.id}, status={self.status}, test_type={self.test_type})>"


class ModelUsage(Base):
    """Enhanced model usage tracking with chunking support"""
    __tablename__ = "model_usage"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_name = Column(String(100), nullable=False, index=True)
    input_tokens = Column(Integer, nullable=False)
    output_tokens = Column(Integer, nullable=False)
    total_tokens = Column(Integer, nullable=False)  # input + output tokens
    request_timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    response_time = Column(Float, nullable=False)  # Time in seconds
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)
    success = Column(Boolean, default=True, index=True)
    error_message = Column(Text)
    
    # Chunking-related fields
    chunk_id = Column(String(100), index=True)  # Unique chunk identifier
    chunk_count = Column(Integer, default=1)  # Number of chunks in request
    is_single_request = Column(Boolean, default=True, index=True)  # Single vs chunked request
    
    # Tool usage fields
    tool_calls_count = Column(Integer, default=0)  # Number of tool calls made
    tools_used = Column(String(500))  # Comma-separated list of tools used
    
    # Performance metadata
    finish_reason = Column(String(50))  # Model finish reason
    temperature = Column(Float)  # Temperature used for generation
    max_tokens = Column(Integer)  # Max tokens requested
    
    def __repr__(self):
        return f"<ModelUsage(id={self.id}, model={self.model_name}, tokens={self.total_tokens}, chunks={self.chunk_count})>"


class CodeTemplate(Base):
    """Code template model for caching"""
    __tablename__ = "code_templates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    language = Column(Enum(Language), nullable=False, index=True)
    template_code = Column(Text, nullable=False)
    category = Column(String(100), index=True)
    tags = Column(String(500))  # Comma-separated tags
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<CodeTemplate(id={self.id}, name={self.name}, language={self.language})>"


class ErrorLog(Base):
    """Error logging model"""
    __tablename__ = "error_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    error_type = Column(String(100), nullable=False, index=True)
    error_message = Column(Text, nullable=False)
    stack_trace = Column(Text)
    context = Column(Text)  # JSON string of additional context
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), index=True)
    generation_id = Column(UUID(as_uuid=True), ForeignKey("code_generations.id"), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    resolved = Column(Boolean, default=False)
    resolution_notes = Column(Text)
    
    def __repr__(self):
        return f"<ErrorLog(id={self.id}, error_type={self.error_type}, resolved={self.resolved})>"


class SystemMetrics(Base):
    """System metrics model"""
    __tablename__ = "system_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    metric_name = Column(String(100), nullable=False, index=True)
    metric_value = Column(Float, nullable=False)
    metric_unit = Column(String(50))
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    tags = Column(String(500))  # Comma-separated tags for filtering
    
    def __repr__(self):
        return f"<SystemMetrics(id={self.id}, name={self.metric_name}, value={self.metric_value})>"
