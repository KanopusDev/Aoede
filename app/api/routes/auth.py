"""
Authentication endpoints for user management
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Response, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime

from app.services.auth import auth_service, AuthenticationError, UserAlreadyExistsError
from app.models.user import User, UserRole, UserStatus
from app.core.logging import get_logger
from app.services.email import email_service

logger = get_logger(__name__)
router = APIRouter()
security = HTTPBearer(auto_error=False)


# Request/Response Models
class UserRegistrationRequest(BaseModel):
    """User registration request schema"""
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_-]+$")
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=255)
    confirm_password: str
    
    def validate_passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class UserLoginRequest(BaseModel):
    """User login request schema"""
    username_or_email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    remember_me: bool = False


class UserResponse(BaseModel):
    """User response schema"""
    id: UUID
    username: str
    email: str
    full_name: str
    role: UserRole
    status: UserStatus
    email_verified: bool
    created_at: datetime
    last_login_at: Optional[datetime]
    avatar_url: Optional[str]
    bio: Optional[str]
    company: Optional[str]
    location: Optional[str]
    website: Optional[str]
    theme_preference: str
    timezone: str
    
    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    """Authentication response schema"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = 86400  # 24 hours in seconds
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema"""
    refresh_token: str


class PasswordResetRequest(BaseModel):
    """Password reset request schema"""
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    """Password reset confirm request schema"""
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str
    
    def validate_passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class EmailVerificationRequest(BaseModel):
    """Email verification request schema"""
    token: str


class UserProfileUpdateRequest(BaseModel):
    """User profile update request schema"""
    full_name: Optional[str] = Field(None, max_length=255)
    bio: Optional[str] = Field(None, max_length=1000)
    company: Optional[str] = Field(None, max_length=255)
    location: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, max_length=500)
    theme_preference: Optional[str] = Field(None, pattern=r"^(light|dark|system)$")
    timezone: Optional[str] = Field(None, max_length=50)
    email_notifications: Optional[bool] = None


# Dependency for getting current user
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Get current authenticated user"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await auth_service.get_current_user(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if current_user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is not active"
        )
    return current_user


def get_client_ip(request: Request) -> str:
    """Get client IP address"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# Authentication Endpoints
@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserRegistrationRequest, request: Request):
    """Register a new user"""
    try:
        # Validate password confirmation
        user_data.validate_passwords_match()
        
        # Register user
        user = await auth_service.register_user(
            username=user_data.username,
            email=user_data.email,
            password=user_data.password,
            full_name=user_data.full_name
        )
        
        logger.info(f"User registered: {user.username} from IP {get_client_ip(request)}")
        
        return UserResponse.model_validate(user)
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except UserAlreadyExistsError:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/login", response_model=AuthResponse)
async def login_user(user_data: UserLoginRequest, request: Request):
    """Authenticate user and return tokens"""
    try:
        client_ip = get_client_ip(request)
        user_agent = request.headers.get("User-Agent", "unknown")
        
        user, access_token, refresh_token = await auth_service.authenticate_user(
            username_or_email=user_data.username_or_email,
            password=user_data.password,
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        logger.info(f"User logged in: {user.username} from IP {client_ip}")
        
        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user)
        )
        
    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.post("/refresh", response_model=Dict[str, str])
async def refresh_token(token_data: RefreshTokenRequest):
    """Refresh access token"""
    try:
        new_access_token, new_refresh_token = await auth_service.refresh_session(
            token_data.refresh_token
        )
        
        return {
            "access_token": new_access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer"
        }
        
    except AuthenticationError:
        raise
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed"
        )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_user(current_user: User = Depends(get_current_active_user), 
                     credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Logout current user"""
    try:
        success = await auth_service.logout_user(credentials.credentials)
        if success:
            logger.info(f"User logged out: {current_user.username}")
        
    except Exception as e:
        logger.error(f"Logout failed: {e}")
        # Don't raise exception for logout - best effort


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: User = Depends(get_current_active_user)):
    """Get current user profile"""
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_user_profile(
    profile_data: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_active_user)
):
    """Update current user profile"""
    try:
        from app.core.database import get_db_session
        from sqlalchemy import update
        
        async with get_db_session() as session:
            # Prepare update data
            update_data = {}
            for field, value in profile_data.dict(exclude_unset=True).items():
                if value is not None:
                    update_data[field] = value
            
            if update_data:
                update_data["updated_at"] = datetime.utcnow()
                
                # Update user
                await session.execute(
                    update(User)
                    .where(User.id == current_user.id)
                    .values(**update_data)
                )
                await session.commit()
                
                # Refresh user object
                await session.refresh(current_user)
                
                logger.info(f"Updated profile for user {current_user.username}")
                
        return UserResponse.model_validate(current_user)
                
    except Exception as e:
        logger.error(f"Failed to update user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update profile: {str(e)}"
        )
        
    
    except Exception as e:
        logger.error(f"Profile update failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile update failed"
        )


@router.post("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(verification_data: EmailVerificationRequest):
    """Verify user email address"""
    try:
        success = await auth_service.verify_user_email(verification_data.token)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification token"
            )
        
        return {"message": "Email verified successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Email verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email verification failed"
        )


@router.post("/request-password-reset", status_code=status.HTTP_200_OK)
async def request_password_reset(reset_data: PasswordResetRequest):
    """Request password reset"""
    try:
        from app.core.database import get_db_session
        from sqlalchemy import select
        
        async with get_db_session() as session:
            # Find user by email
            query = select(User).where(User.email == reset_data.email)
            result = await session.execute(query)
            user = result.scalar_one_or_none()
            
            if user:
                # Generate reset token
                reset_token = user.generate_reset_token()
                await session.commit()
                
        # Generate and send reset token via email
        logger.info(f"Password reset requested for user: {user.username}")
        await email_service.send_password_reset_email(
            user_email=user.email,
            username=user.username,
            reset_token=reset_token
        )
        
        # Always return success to prevent email enumeration
        return {"message": "If the email exists, a password reset link has been sent"}
        
    except Exception as e:
        logger.error(f"Password reset request failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset request failed"
        )


@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(reset_data: PasswordResetConfirmRequest):
    """Reset password with token"""
    try:
        # Validate password confirmation
        reset_data.validate_passwords_match()
        
        success = await auth_service.reset_password(
            reset_data.token,
            reset_data.new_password
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )
        
        return {"message": "Password reset successfully"}
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password reset failed"
        )


@router.get("/sessions", response_model=Dict[str, Any])
async def get_user_sessions(current_user: User = Depends(get_current_active_user)):
    """Get current user's active sessions"""
    try:
        from app.core.database import get_db_session
        from sqlalchemy import select
        from app.models.user import UserSession
        
        async with get_db_session() as session:
            query = select(UserSession).where(
                UserSession.user_id == current_user.id,
                UserSession.is_active == True,
                UserSession.revoked == False
            ).order_by(UserSession.last_activity.desc())
            
            result = await session.execute(query)
            sessions = result.scalars().all()
            
            session_data = []
            for s in sessions:
                session_data.append({
                    "id": str(s.id),
                    "ip_address": s.ip_address,
                    "user_agent": s.user_agent,
                    "created_at": s.created_at.isoformat(),
                    "last_activity": s.last_activity.isoformat(),
                    "expires_at": s.expires_at.isoformat(),
                    "is_current": s.session_token == None  # Would need to check current token
                })
            
            return {
                "sessions": session_data,
                "total_count": len(session_data)
            }
            
    except Exception as e:
        logger.error(f"Get sessions failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve sessions"
        )
