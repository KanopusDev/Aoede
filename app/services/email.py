"""
Email service for user notifications and verification
"""
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any
import asyncio
from datetime import datetime

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

class EmailService:
    """Email service for sending various types of user emails"""
    
    def __init__(self):
        """Initialize email service with configuration"""
        self.smtp_server = settings.SMTP_SERVER
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.sender_email = settings.SMTP_SENDER_EMAIL
        self.sender_name = settings.SMTP_SENDER_NAME
        self.use_tls = settings.SMTP_USE_TLS
        self.template_dir = "app/templates/email"
        self.enabled = settings.EMAIL_ENABLED
        self.environment = settings.ENVIRONMENT
        self.base_url = settings.BASE_URL
        
    async def send_email(self, to_email: str, subject: str, html_content: str, 
                         text_content: Optional[str] = None) -> bool:
        """
        Send an email asynchronously
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML body content
            text_content: Plain text body content (optional)
            
        Returns:
            bool: Whether the email was sent successfully
        """
        if not self.enabled:
            logger.info(f"Email sending disabled. Would send to {to_email}: {subject}")
            return True
            
        if self.environment == "development":
            logger.info(f"Development environment, logging email instead of sending")
            logger.info(f"To: {to_email}")
            logger.info(f"Subject: {subject}")
            logger.info(f"Content: {text_content or html_content[:100]}...")
            return True
            
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, self._send_email_sync, to_email, subject, html_content, text_content
        )
        
    def _send_email_sync(self, to_email: str, subject: str, html_content: str,
                        text_content: Optional[str] = None) -> bool:
        """Synchronous implementation of email sending"""
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.sender_name} <{self.sender_email}>"
            message["To"] = to_email
            
            # Add plain text version if provided, otherwise create from HTML
            if text_content is None:
                # Simple HTML to text conversion (in production, use a proper HTML->text library)
                text_content = html_content.replace("<p>", "").replace("</p>", "\n\n")
                text_content = text_content.replace("<br>", "\n").replace("<br/>", "\n")
                
            # Add parts
            part1 = MIMEText(text_content, "plain")
            part2 = MIMEText(html_content, "html")
            message.attach(part1)
            message.attach(part2)
            
            # Connect to server
            context = ssl.create_default_context()
            
            if self.use_tls:
                server = smtplib.SMTP(self.smtp_server, self.smtp_port)
                server.starttls(context=context)
            else:
                server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, context=context)
                
            server.login(self.smtp_username, self.smtp_password)
            server.sendmail(self.sender_email, to_email, message.as_string())
            server.quit()
            
            logger.info(f"Email sent to {to_email}: {subject}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
            
    async def send_welcome_email(self, user_email: str, username: str, verification_token: str) -> bool:
        """Send welcome email with verification link"""
        verification_url = f"{self.base_url}/verify-email?token={verification_token}"
        
        subject = "Welcome to Aoede - Please verify your email"
        
        html_content = f"""
        <html>
        <body>
            <h2>Welcome to Aoede, {username}!</h2>
            <p>Thank you for registering with Aoede - your new AI no-code agent platform.</p>
            <p>Please verify your email address by clicking the link below:</p>
            <p><a href="{verification_url}">Verify Email Address</a></p>
            <p>This link will expire in 24 hours.</p>
            <p>If you did not create this account, please ignore this email.</p>
            <br>
            <p>Best regards,</p>
            <p>The Aoede Team</p>
        </body>
        </html>
        """
        
        return await self.send_email(user_email, subject, html_content)
        
    async def send_password_reset_email(self, user_email: str, username: str, reset_token: str) -> bool:
        """Send password reset email with reset link"""
        reset_url = f"{self.base_url}/reset-password?token={reset_token}"
        
        subject = "Aoede - Password Reset Request"
        
        html_content = f"""
        <html>
        <body>
            <h2>Password Reset Request</h2>
            <p>Hello {username},</p>
            <p>We received a request to reset your password. Click the link below to create a new password:</p>
            <p><a href="{reset_url}">Reset Password</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
            <br>
            <p>Best regards,</p>
            <p>The Aoede Team</p>
        </body>
        </html>
        """
        
        return await self.send_email(user_email, subject, html_content)
        
    async def send_account_locked_notification(self, user_email: str, username: str) -> bool:
        """Send account locked notification email"""
        subject = "Aoede - Account Security Alert"
        
        html_content = f"""
        <html>
        <body>
            <h2>Account Security Alert</h2>
            <p>Hello {username},</p>
            <p>Your Aoede account has been temporarily locked due to multiple failed login attempts.</p>
            <p>If this was you, you can unlock your account by resetting your password.</p>
            <p>If you did not attempt to log in, please contact our support team immediately.</p>
            <br>
            <p>Best regards,</p>
            <p>The Aoede Security Team</p>
        </body>
        </html>
        """
        
        return await self.send_email(user_email, subject, html_content)
        
    async def send_project_completion_notification(self, user_email: str, username: str, 
                                                 project_name: str, project_id: str) -> bool:
        """Send project completion notification email"""
        project_url = f"{self.base_url}/projects/{project_id}"
        
        subject = f"Aoede - Project '{project_name}' Completed"
        
        html_content = f"""
        <html>
        <body>
            <h2>Project Completion Notification</h2>
            <p>Hello {username},</p>
            <p>Your project <strong>{project_name}</strong> has been successfully completed!</p>
            <p>You can view the results here: <a href="{project_url}">View Project</a></p>
            <br>
            <p>Best regards,</p>
            <p>The Aoede Team</p>
        </body>
        </html>
        """
        
        return await self.send_email(user_email, subject, html_content)

# Create a singleton instance
email_service = EmailService()
