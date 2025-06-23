"""
User authentication models for Aoede application
"""
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, Enum, Boolean, ForeignKey, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from datetime import datetime, timedelta
import hashlib
import secrets
from typing import Optional

from app.core.database import Base


class UserRole(str, enum.Enum):
    """User role enumeration"""
    ADMIN = "admin"
    USER = "user"
    VIEWER = "viewer"


class UserStatus(str, enum.Enum):
    """User status enumeration"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING_VERIFICATION = "pending_verification"


class User(Base):
    """User model for authentication and authorization"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False, index=True)
    status = Column(Enum(UserStatus), default=UserStatus.ACTIVE, nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login_at = Column(DateTime(timezone=True))
    
    # Profile information
    avatar_url = Column(String(500))
    bio = Column(Text)
    company = Column(String(255))
    location = Column(String(255))
    website = Column(String(500))
    
    # Settings
    email_notifications = Column(Boolean, default=True)
    theme_preference = Column(String(20), default="system")  # light, dark, system
    timezone = Column(String(50), default="UTC")
    
    # Security
    email_verified = Column(Boolean, default=False)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True))
    password_reset_token = Column(String(255))
    password_reset_expires = Column(DateTime(timezone=True))
    email_verification_token = Column(String(255))
    
    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    api_keys = relationship("UserAPIKey", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, email={self.email}, role={self.role})>"
    
    def set_password(self, password: str):
        """Set password hash"""
        # Use a more secure hash in production
        self.password_hash = hashlib.pbkdf2_hmac('sha256', 
                                                password.encode('utf-8'), 
                                                self.username.encode('utf-8'), 
                                                100000).hex()
    
    def verify_password(self, password: str) -> bool:
        """Verify password"""
        password_hash = hashlib.pbkdf2_hmac('sha256', 
                                           password.encode('utf-8'), 
                                           self.username.encode('utf-8'), 
                                           100000).hex()
        return password_hash == self.password_hash
    
    def generate_reset_token(self) -> str:
        """Generate password reset token"""
        token = secrets.token_urlsafe(32)
        self.password_reset_token = token
        self.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        return token
    
    def generate_verification_token(self) -> str:
        """Generate email verification token"""
        token = secrets.token_urlsafe(32)
        self.email_verification_token = token
        return token
    
    def is_locked(self) -> bool:
        """Check if user account is locked"""
        if self.locked_until:
            return datetime.utcnow() < self.locked_until
        return False
    
    def lock_account(self, duration_minutes: int = 30):
        """Lock account for specified duration"""
        self.locked_until = datetime.utcnow() + timedelta(minutes=duration_minutes)
        self.failed_login_attempts = 0
    
    def unlock_account(self):
        """Unlock account"""
        self.locked_until = None
        self.failed_login_attempts = 0


class UserSession(Base):
    """User session model for tracking active sessions"""
    __tablename__ = "user_sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    refresh_token = Column(String(255), unique=True, nullable=False, index=True)
    
    # Session metadata
    ip_address = Column(String(45))  # IPv6 compatible
    user_agent = Column(String(500))
    device_fingerprint = Column(String(255))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_activity = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    revoked = Column(Boolean, default=False, index=True)
    revoked_at = Column(DateTime(timezone=True))
    
    # Relationships
    user = relationship("User", back_populates="sessions")
    
    def __repr__(self):
        return f"<UserSession(id={self.id}, user_id={self.user_id}, active={self.is_active})>"
    
    def is_expired(self) -> bool:
        """Check if session is expired"""
        return datetime.utcnow() > self.expires_at
    
    def is_valid(self) -> bool:
        """Check if session is valid"""
        return self.is_active and not self.revoked and not self.is_expired()
    
    def revoke(self):
        """Revoke session"""
        self.is_active = False
        self.revoked = True
        self.revoked_at = datetime.utcnow()
    
    def refresh(self, new_token: str, new_refresh_token: str, duration_hours: int = 24):
        """Refresh session with new tokens"""
        self.session_token = new_token
        self.refresh_token = new_refresh_token
        self.last_activity = datetime.utcnow()
        self.expires_at = datetime.utcnow() + timedelta(hours=duration_hours)


class UserAPIKey(Base):
    """User API key model for programmatic access"""
    __tablename__ = "user_api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    key_name = Column(String(255), nullable=False)
    key_hash = Column(String(255), unique=True, nullable=False, index=True)
    key_prefix = Column(String(20), nullable=False)  # First few chars for identification
    
    # Permissions
    scopes = Column(String(1000))  # JSON array of scopes
    
    # Status
    is_active = Column(Boolean, default=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    
    # Usage tracking
    total_requests = Column(Integer, default=0)
    
    # Relationships
    user = relationship("User", back_populates="api_keys")
    
    def __repr__(self):
        return f"<UserAPIKey(id={self.id}, user_id={self.user_id}, name={self.key_name})>"
    
    def is_expired(self) -> bool:
        """Check if API key is expired"""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False
    
    def is_valid(self) -> bool:
        """Check if API key is valid"""
        return self.is_active and not self.is_expired()
    
    @staticmethod
    def generate_api_key() -> tuple[str, str, str]:
        """Generate new API key"""
        key = f"ak_{secrets.token_urlsafe(32)}"
        key_hash = hashlib.sha256(key.encode()).hexdigest()
        key_prefix = key[:8]
        return key, key_hash, key_prefix


class UserLoginHistory(Base):
    """User login history for security tracking"""
    __tablename__ = "user_login_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    
    # Login details
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    device_fingerprint = Column(String(255))
    location = Column(String(255))  # Geolocation if available
    
    # Status
    success = Column(Boolean, nullable=False, index=True)
    failure_reason = Column(String(255))
    
    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    def __repr__(self):
        return f"<UserLoginHistory(id={self.id}, user_id={self.user_id}, success={self.success})>"
