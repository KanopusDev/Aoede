#!/bin/bash

# Aoede Development Setup Script
# This script sets up the development environment for Aoede

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check Python version
check_python() {
    log_info "Checking Python version..."
    
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3 is not installed"
        exit 1
    fi
    
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    REQUIRED_VERSION="3.11"
    
    if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]]; then
        log_error "Python $REQUIRED_VERSION or higher is required. Found: $PYTHON_VERSION"
        exit 1
    fi
    
    log_success "Python version $PYTHON_VERSION is compatible"
}

# Function to create virtual environment
create_venv() {
    log_info "Creating virtual environment..."
    
    if [ -d "venv" ]; then
        log_warning "Virtual environment already exists"
        read -p "Do you want to recreate it? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf venv
        else
            log_info "Using existing virtual environment"
            return 0
        fi
    fi
    
    python3 -m venv venv
    log_success "Virtual environment created"
}

# Function to activate virtual environment
activate_venv() {
    log_info "Activating virtual environment..."
    source venv/bin/activate
    log_success "Virtual environment activated"
}

# Function to install Python dependencies
install_dependencies() {
    log_info "Installing Python dependencies..."
    
    pip install --upgrade pip
    pip install -r requirements.txt
    
    # Install development dependencies
    pip install \
        pytest \
        pytest-asyncio \
        pytest-cov \
        black \
        isort \
        flake8 \
        mypy \
        bandit \
        safety \
        pre-commit
    
    log_success "Dependencies installed"
}

# Function to setup pre-commit hooks
setup_precommit() {
    log_info "Setting up pre-commit hooks..."
    
    cat > .pre-commit-config.yaml << 'EOF'
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.4.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
      - id: check-merge-conflict

  - repo: https://github.com/psf/black
    rev: 23.7.0
    hooks:
      - id: black
        language_version: python3

  - repo: https://github.com/pycqa/isort
    rev: 5.12.0
    hooks:
      - id: isort

  - repo: https://github.com/pycqa/flake8
    rev: 6.0.0
    hooks:
      - id: flake8
        args: [--max-line-length=88, --extend-ignore=E203,W503]

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.5.1
    hooks:
      - id: mypy
        additional_dependencies: [types-all]

  - repo: https://github.com/pycqa/bandit
    rev: 1.7.5
    hooks:
      - id: bandit
        args: [-r, app/, -f, json, -o, bandit-report.json]
EOF
    
    pre-commit install
    log_success "Pre-commit hooks configured"
}

# Function to check Docker
check_docker() {
    log_info "Checking Docker..."
    
    if ! command -v docker &> /dev/null; then
        log_warning "Docker is not installed. Some features may not work."
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        log_warning "Docker daemon is not running"
        return 1
    fi
    
    log_success "Docker is available"
    return 0
}

# Function to setup development environment variables
setup_env() {
    log_info "Setting up environment variables..."
    
    if [ ! -f ".env" ]; then
        log_info "Creating .env file from template..."
        
        cat > .env << 'EOF'
# Development Environment Configuration

# Application
DEBUG=true
ENVIRONMENT=development
HOST=127.0.0.1
PORT=8000
WORKERS=1

# Security
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Database
DATABASE_URL=postgresql+asyncpg://aoede:aoede_dev@localhost:5432/aoede_dev
TEST_DATABASE_URL=postgresql+asyncpg://aoede:aoede_dev@localhost:5432/aoede_test

# Redis
REDIS_URL=redis://localhost:6379/0

# AI Models
GITHUB_TOKEN=your-github-ai-api-key-here
GITHUB_AI_BASE_URL=https://models.inference.ai.azure.com
MAX_TOKENS_PER_REQUEST=4000
TOKEN_SAFETY_BUFFER=200
AI_MODELS=mistral-ai/Codestral-2501,openai/gpt-4.1,openai/gpt-4o,cohere/cohere-command-a

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=1000
RATE_LIMIT_BURST=100

# Monitoring
PROMETHEUS_PORT=9090
LOG_LEVEL=DEBUG

# Celery
CELERY_BROKER_URL=redis://localhost:6379/1
EOF
        
        log_success ".env file created"
        log_warning "Please update the .env file with your actual configuration values"
    else
        log_info ".env file already exists"
    fi
}

# Function to setup development database
setup_database() {
    log_info "Setting up development database..."
    
    if check_docker; then
        log_info "Starting PostgreSQL and Redis with Docker..."
        
        # Create docker-compose.dev.yml for development
        cat > docker-compose.dev.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: aoede-dev-postgres
    environment:
      POSTGRES_DB: aoede_dev
      POSTGRES_USER: aoede
      POSTGRES_PASSWORD: aoede_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
    restart: unless-stopped

  postgres-test:
    image: postgres:15
    container_name: aoede-test-postgres
    environment:
      POSTGRES_DB: aoede_test
      POSTGRES_USER: aoede
      POSTGRES_PASSWORD: aoede_dev
    ports:
      - "5433:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: aoede-dev-redis
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  postgres_dev_data:
EOF
        
        docker-compose -f docker-compose.dev.yml up -d
        
        # Wait for databases to be ready
        log_info "Waiting for databases to be ready..."
        sleep 10
        
        log_success "Development databases started"
    else
        log_warning "Docker not available. Please install PostgreSQL and Redis manually."
    fi
}

# Function to run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Wait for database to be ready
    sleep 5
    
    # Install alembic if not already installed
    pip install alembic
    
    # Initialize alembic if not already done
    if [ ! -d "alembic" ]; then
        alembic init alembic
        log_info "Alembic initialized"
    fi
    
    # Run migrations
    python -m alembic upgrade head
    
    log_success "Database migrations completed"
}

# Function to run tests
run_tests() {
    log_info "Running tests..."
    
    # Unit tests
    pytest tests/ -v --cov=app --cov-report=html --cov-report=term
    
    log_success "Tests completed"
}

# Function to start development server
start_dev_server() {
    log_info "Starting development server..."
    
    log_info "Server will be available at: http://localhost:8000"
    log_info "API documentation: http://localhost:8000/api/docs"
    log_info "Press Ctrl+C to stop the server"
    
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}

# Function to show development info
show_dev_info() {
    log_info "Development Environment Information:"
    echo "===================================="
    echo "Python version: $(python3 --version)"
    echo "Virtual environment: $(which python)"
    echo "Application directory: $(pwd)"
    echo ""
    
    log_info "Available commands:"
    echo "- Start server: python -m uvicorn app.main:app --reload"
    echo "- Run tests: pytest tests/"
    echo "- Format code: black . && isort ."
    echo "- Lint code: flake8 . && mypy app/"
    echo "- Security scan: bandit -r app/"
    echo ""
    
    log_info "Development URLs:"
    echo "- Application: http://localhost:8000"
    echo "- API Docs: http://localhost:8000/api/docs"
    echo "- Health Check: http://localhost:8000/api/v1/health"
    echo ""
    
    if check_docker; then
        log_info "Development services:"
        docker-compose -f docker-compose.dev.yml ps
    fi
}

# Main setup function
main_setup() {
    log_info "Starting Aoede development setup..."
    
    check_python
    create_venv
    activate_venv
    install_dependencies
    setup_precommit
    setup_env
    setup_database
    run_migrations
    
    log_success "Development environment setup completed!"
    echo ""
    show_dev_info
}

# Parse command line arguments
case "${1:-setup}" in
    "setup")
        main_setup
        ;;
    "start")
        activate_venv
        start_dev_server
        ;;
    "test")
        activate_venv
        run_tests
        ;;
    "info")
        show_dev_info
        ;;
    "db-start")
        if check_docker; then
            docker-compose -f docker-compose.dev.yml up -d
            log_success "Development databases started"
        else
            log_error "Docker not available"
        fi
        ;;
    "db-stop")
        if check_docker; then
            docker-compose -f docker-compose.dev.yml down
            log_success "Development databases stopped"
        else
            log_error "Docker not available"
        fi
        ;;
    "clean")
        log_warning "Cleaning development environment..."
        if [ -d "venv" ]; then
            rm -rf venv
            log_success "Virtual environment removed"
        fi
        if [ -f "docker-compose.dev.yml" ] && check_docker; then
            docker-compose -f docker-compose.dev.yml down -v
            log_success "Development containers removed"
        fi
        ;;
    *)
        echo "Usage: $0 [ACTION]"
        echo ""
        echo "ACTIONS:"
        echo "  setup    - Setup development environment (default)"
        echo "  start    - Start development server"
        echo "  test     - Run tests"
        echo "  info     - Show development environment info"
        echo "  db-start - Start development databases"
        echo "  db-stop  - Stop development databases"
        echo "  clean    - Clean development environment"
        echo ""
        echo "Examples:"
        echo "  $0 setup"
        echo "  $0 start"
        echo "  $0 test"
        exit 1
        ;;
esac
