"""
Authentication service for user management and session handling
"""
import secrets
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from uuid import UUID
import structlog
import jwt
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.core.database import get_db_session
from app.models.user import User, UserSession, UserLoginHistory, UserRole, UserStatus
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# JWT Configuration
JWT_SECRET_KEY = getattr(settings, 'JWT_SECRET_KEY', secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours
JWT_REFRESH_TOKEN_EXPIRE_DAYS = 30

class AuthenticationError(HTTPException):
    """Authentication error exception"""
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)

class AuthorizationError(HTTPException):
    """Authorization error exception"""
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

class UserNotFoundError(HTTPException):
    """User not found error exception"""
    def __init__(self, detail: str = "User not found"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

class UserAlreadyExistsError(HTTPException):
    """User already exists error exception"""
    def __init__(self, detail: str = "User already exists"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class AuthService:
    """Authentication and authorization service"""
    
    def __init__(self):
        self.max_login_attempts = 5
        self.account_lockout_duration = 30  # minutes
        
    async def register_user(
        self, 
        username: str, 
        email: str, 
        password: str, 
        full_name: str,
        role: UserRole = UserRole.USER
    ) -> User:
        """Register a new user"""
        try:
            async with get_db_session() as session:
                # Check if user already exists
                existing_user = await session.execute(
                    select(User).where(
                        (User.username == username) | (User.email == email)
                    )
                )
                if existing_user.scalar_one_or_none():
                    raise UserAlreadyExistsError("Username or email already exists")
                
                # Create new user
                user = User(
                    username=username,
                    email=email,
                    full_name=full_name,
                    role=role,
                    status=UserStatus.ACTIVE
                )
                user.set_password(password)
                
                # Generate email verification token
                verification_token = user.generate_verification_token()
                
                session.add(user)
                await session.commit()
                await session.refresh(user)
                
                logger.info(f"User registered successfully: {username}")
                return user
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"User registration failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Registration failed"
            )
    
    async def authenticate_user(
        self, 
        username_or_email: str, 
        password: str,
        ip_address: str = None,
        user_agent: str = None
    ) -> Tuple[User, str, str]:
        """Authenticate user and return user object with tokens"""
        try:
            async with get_db_session() as session:
                # Find user by username or email
                query = select(User).where(
                    (User.username == username_or_email) | 
                    (User.email == username_or_email)
                )
                result = await session.execute(query)
                user = result.scalar_one_or_none()
                
                if not user:
                    # Log failed login attempt for non-existent user
                    await self._log_login_attempt(
                        None,  # No user ID since user doesn't exist
                        ip_address,
                        user_agent,
                        success=False,
                        failure_reason="User not found"
                    )
                    raise AuthenticationError("Invalid username or password")
                
                # Check if account is locked
                if user.is_locked():
                    await self._log_login_attempt(
                        user.id,
                        ip_address,
                        user_agent,
                        success=False,
                        failure_reason="Account locked"
                    )
                    raise AuthenticationError("Account is temporarily locked")
                
                # Check user status
                if user.status != UserStatus.ACTIVE:
                    await self._log_login_attempt(
                        user.id,
                        ip_address,
                        user_agent,
                        success=False,
                        failure_reason=f"Inactive account: {user.status}"
                    )
                    raise AuthenticationError("Account is not active")
                
                # Verify password
                if not user.verify_password(password):
                    # Increment failed attempts
                    user.failed_login_attempts += 1
                    
                    # Log failed login attempt with reason
                    failure_reason = "Invalid password"
                    
                    # Lock account if too many failed attempts
                    if user.failed_login_attempts >= self.max_login_attempts:
                        user.lock_account(self.account_lockout_duration)
                        failure_reason = "Account locked due to too many failed attempts"
                    
                    await session.commit()
                    
                    # Log the failed attempt
                    await self._log_login_attempt(
                        user.id,
                        ip_address,
                        user_agent,
                        success=False,
                        failure_reason=failure_reason
                    )
                    
                    if user.failed_login_attempts >= self.max_login_attempts:
                        raise AuthenticationError("Too many failed attempts. Account locked.")
                    else:
                        raise AuthenticationError("Invalid username or password")
                
                # Successful login - reset failed attempts
                user.failed_login_attempts = 0
                user.last_login_at = datetime.utcnow()
                
                # First update the user record
                await session.commit()
                
                try:
                    # Generate tokens and create session
                    access_token, refresh_token = await self._create_user_session(
                        user, ip_address, user_agent
                    )
                    
                    # Log successful login
                    await self._log_login_attempt(
                        user.id,
                        ip_address,
                        user_agent,
                        success=True
                    )
                except Exception as session_error:
                    logger.error(f"Session creation failed during login: {session_error}")
                    # Re-throw with appropriate auth error
                    raise AuthenticationError("Authentication succeeded but session creation failed")
                
                logger.info(f"User authenticated successfully: {user.username}")
                return user, access_token, refresh_token
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            raise AuthenticationError("Authentication failed")
    
    async def _create_user_session(
        self, 
        user: User, 
        ip_address: str = None, 
        user_agent: str = None
    ) -> Tuple[str, str]:
        """Create new user session and return tokens"""
        try:
            async with get_db_session() as session:
                # First, check for existing sessions with the same device fingerprint and revoke them
                if ip_address and user_agent:
                    # Look for existing session from same device
                    existing_query = select(UserSession).where(
                        UserSession.user_id == user.id,
                        UserSession.ip_address == ip_address,
                        UserSession.user_agent == user_agent,
                        UserSession.is_active == True,
                        UserSession.revoked == False
                    )
                    existing_result = await session.execute(existing_query)
                    existing_sessions = existing_result.scalars().all()
                    
                    # Revoke existing sessions from same device
                    for existing_session in existing_sessions:
                        existing_session.revoke()
                
                # Generate new tokens with retry logic to avoid conflicts
                max_retries = 3
                for attempt in range(max_retries):
                    # Generate tokens
                    access_token = self._generate_jwt_token(
                        user.id, 
                        expires_delta=timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
                    )
                    refresh_token = secrets.token_urlsafe(32)
                    
                    # Check if tokens already exist
                    token_check = select(UserSession).where(
                        (UserSession.session_token == access_token) | 
                        (UserSession.refresh_token == refresh_token)
                    )
                    token_result = await session.execute(token_check)
                    if token_result.scalar_one_or_none():
                        # Token conflict, try again with new tokens
                        logger.warning(f"Token conflict detected, retrying ({attempt+1}/{max_retries})")
                        continue
                    
                    # Create session record with unique ID
                    user_session = UserSession(
                        id=uuid.uuid4(),
                        user_id=user.id,
                        session_token=access_token,
                        refresh_token=refresh_token,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        device_fingerprint=None,  # Could compute fingerprint in the future
                        expires_at=datetime.utcnow() + timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
                    )
                    
                    session.add(user_session)
                    await session.commit()
                    
                    return access_token, refresh_token
                
                # If we reached here, we couldn't generate unique tokens after max_retries
                raise ValueError("Failed to generate unique session tokens after multiple attempts")
                
        except Exception as e:
            logger.error(f"Session creation failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Session creation failed"
            )
    
    async def refresh_session(self, refresh_token: str) -> Tuple[str, str]:
        """Refresh user session and return new tokens"""
        try:
            async with get_db_session() as session:
                # Find session by refresh token
                query = select(UserSession).options(
                    selectinload(UserSession.user)
                ).where(
                    UserSession.refresh_token == refresh_token,
                    UserSession.is_active == True,
                    UserSession.revoked == False
                )
                result = await session.execute(query)
                user_session = result.scalar_one_or_none()
                
                if not user_session or not user_session.is_valid():
                    raise AuthenticationError("Invalid or expired refresh token")
                
                # Ensure user account is still valid
                if user_session.user.status != UserStatus.ACTIVE:
                    # Revoke session if user is no longer active
                    user_session.revoke()
                    await session.commit()
                    raise AuthenticationError("User account is not active")
                
                # Generate new tokens with retry logic to avoid conflicts
                max_retries = 3
                for attempt in range(max_retries):
                    # Generate new tokens
                    new_access_token = self._generate_jwt_token(
                        user_session.user_id,
                        expires_delta=timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
                    )
                    new_refresh_token = secrets.token_urlsafe(32)
                    
                    # Check if new tokens already exist in other sessions
                    token_check = select(UserSession).where(
                        (UserSession.id != user_session.id) & (
                            (UserSession.session_token == new_access_token) | 
                            (UserSession.refresh_token == new_refresh_token)
                        )
                    )
                    token_result = await session.execute(token_check)
                    if token_result.scalar_one_or_none():
                        # Token conflict, try again with new tokens
                        logger.warning(f"Token conflict detected during refresh, retrying ({attempt+1}/{max_retries})")
                        continue
                    
                    # Update session with new tokens
                    user_session.refresh(new_access_token, new_refresh_token)
                    await session.commit()
                    
                    logger.info(f"Session refreshed for user: {user_session.user.username}")
                    return new_access_token, new_refresh_token
                
                # If we reached here, we couldn't generate unique tokens after max_retries
                raise ValueError("Failed to generate unique session tokens after multiple attempts")
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Session refresh failed: {e}")
            raise AuthenticationError("Session refresh failed")
    
    async def logout_user(self, access_token: str) -> bool:
        """Logout user by revoking session"""
        try:
            user_id = self._decode_jwt_token(access_token)
            if not user_id:
                return False
                
            async with get_db_session() as session:
                # Find and revoke session
                query = select(UserSession).where(
                    UserSession.session_token == access_token,
                    UserSession.user_id == user_id
                )
                result = await session.execute(query)
                user_session = result.scalar_one_or_none()
                
                if user_session:
                    # Mark session as revoked
                    user_session.revoke()
                    
                    # Log the logout action
                    logger.info(f"User logged out: {user_id}")
                    
                    # Commit the changes
                    await session.commit()
                    return True
                    
                # No active session found
                logger.warning(f"No active session found for token during logout: {user_id}")
                return False
                
        except Exception as e:
            logger.error(f"Logout failed: {e}")
            return False
    
    async def get_current_user(self, access_token: str) -> Optional[User]:
        """Get current user from access token"""
        try:
            user_id = self._decode_jwt_token(access_token)
            if not user_id:
                logger.warning("Invalid token format or expired token")
                return None
                
            async with get_db_session() as session:
                # Verify session is valid
                session_query = select(UserSession).where(
                    UserSession.session_token == access_token,
                    UserSession.user_id == user_id
                )
                session_result = await session.execute(session_query)
                user_session = session_result.scalar_one_or_none()
                
                # Check if session exists at all
                if not user_session:
                    logger.warning(f"No session found for token {access_token[:10]}...")
                    return None
                
                # Check if session is still valid
                if not user_session.is_active or user_session.revoked:
                    logger.warning(f"Session {user_session.id} is no longer active or has been revoked")
                    return None
                
                # Check if session is expired
                if user_session.is_expired():
                    logger.warning(f"Session {user_session.id} has expired")
                    # Automatically revoke expired sessions to keep the DB clean
                    user_session.revoke()
                    await session.commit()
                    return None
                
                # Get user
                user_query = select(User).where(User.id == user_id)
                user_result = await session.execute(user_query)
                user = user_result.scalar_one_or_none()
                
                if not user:
                    logger.warning(f"User {user_id} referenced in session doesn't exist")
                    return None
                    
                # Check if user is active
                if user.status != UserStatus.ACTIVE:
                    logger.warning(f"User {user_id} account is not active: {user.status}")
                    return None
                
                # Update last activity timestamp
                user_session.last_activity = datetime.utcnow()
                await session.commit()
                return user
                
        except Exception as e:
            logger.error(f"Get current user failed: {e}")
            return None
    
    async def verify_user_email(self, token: str) -> bool:
        """Verify user email with verification token"""
        try:
            async with get_db_session() as session:
                query = select(User).where(
                    User.email_verification_token == token
                )
                result = await session.execute(query)
                user = result.scalar_one_or_none()
                
                if user:
                    user.email_verified = True
                    user.email_verification_token = None
                    await session.commit()
                    logger.info(f"Email verified for user: {user.username}")
                    return True
                    
                return False
                
        except Exception as e:
            logger.error(f"Email verification failed: {e}")
            return False
    
    async def reset_password(self, token: str, new_password: str) -> bool:
        """Reset user password with reset token"""
        try:
            async with get_db_session() as session:
                query = select(User).where(
                    User.password_reset_token == token,
                    User.password_reset_expires > datetime.utcnow()
                )
                result = await session.execute(query)
                user = result.scalar_one_or_none()
                
                if user:
                    user.set_password(new_password)
                    user.password_reset_token = None
                    user.password_reset_expires = None
                    user.failed_login_attempts = 0
                    user.unlock_account()
                    
                    # Revoke all sessions
                    await self._revoke_all_user_sessions(user.id)
                    
                    await session.commit()
                    logger.info(f"Password reset for user: {user.username}")
                    return True
                    
                return False
                
        except Exception as e:
            logger.error(f"Password reset failed: {e}")
            return False
    
    async def _revoke_all_user_sessions(self, user_id: UUID):
        """Revoke all sessions for a user"""
        try:
            async with get_db_session() as session:
                await session.execute(
                    update(UserSession)
                    .where(UserSession.user_id == user_id)
                    .values(is_active=False, revoked=True, revoked_at=datetime.utcnow())
                )
                await session.commit()
                
        except Exception as e:
            logger.error(f"Failed to revoke user sessions: {e}")
    
    async def _log_login_attempt(
        self, 
        user_id: Optional[UUID], 
        ip_address: str, 
        user_agent: str, 
        success: bool,
        failure_reason: str = None
    ):
        """Log login attempt"""
        try:
            # Always log login attempts, even if user_id is None (failed login with non-existent user)
            async with get_db_session() as session:
                # Create basic device fingerprint from available data
                device_fingerprint = None
                if ip_address and user_agent:
                    fingerprint_source = f"{ip_address}|{user_agent}"
                    device_fingerprint = hashlib.sha256(fingerprint_source.encode()).hexdigest()
                
                # Create login history record
                login_history = UserLoginHistory(
                    id=uuid.uuid4(),  # Ensure unique ID
                    user_id=user_id,  # Can be None for non-existent users
                    ip_address=ip_address,
                    user_agent=user_agent,
                    device_fingerprint=device_fingerprint,
                    success=success,
                    failure_reason=failure_reason,
                    # Approximate location could be added in the future based on IP
                )
                
                session.add(login_history)
                await session.commit()
                
                # Log additional security information
                if success:
                    logger.info(f"Successful login recorded for user ID: {user_id} from IP: {ip_address}")
                else:
                    logger.warning(f"Failed login attempt for user ID: {user_id} from IP: {ip_address}, reason: {failure_reason}")
                
        except Exception as e:
            logger.error(f"Failed to log login attempt: {e}")
    
    def _generate_jwt_token(self, user_id: UUID, expires_delta: timedelta = None) -> str:
        """Generate JWT access token"""
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=15)
            
        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        }
        
        encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
        return encoded_jwt
    
    def _decode_jwt_token(self, token: str) -> Optional[UUID]:
        """Decode JWT token and return user ID"""
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("sub")
            if user_id:
                return UUID(user_id)
            return None
        except jwt.ExpiredSignatureError:
            return None
        except jwt.JWTError:
            return None
    
    async def require_role(self, user: User, required_role: UserRole) -> bool:
        """Check if user has required role"""
        role_hierarchy = {
            UserRole.VIEWER: 1,
            UserRole.USER: 2,
            UserRole.ADMIN: 3
        }
        
        user_level = role_hierarchy.get(user.role, 0)
        required_level = role_hierarchy.get(required_role, 0)
        
        if user_level < required_level:
            raise AuthorizationError(f"Requires {required_role.value} role or higher")
        
        return True


# Global auth service instance
auth_service = AuthService()
