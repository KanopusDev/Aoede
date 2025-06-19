#!/bin/bash

# Aoede Production Deployment Script
# This script handles the complete deployment of Aoede to production

set -e  # Exit on any error

# Configuration
APP_NAME="aoede"
NAMESPACE="aoede"
DOCKER_IMAGE="ghcr.io/aoede/aoede"
VERSION=${1:-"latest"}

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

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to create namespace if it doesn't exist
create_namespace() {
    log_info "Creating namespace $NAMESPACE if it doesn't exist..."
    
    if ! kubectl get namespace $NAMESPACE &> /dev/null; then
        kubectl create namespace $NAMESPACE
        log_success "Namespace $NAMESPACE created"
    else
        log_info "Namespace $NAMESPACE already exists"
    fi
}

# Function to apply secrets
apply_secrets() {
    log_info "Applying secrets..."
    
    # Check if secrets exist
    if [ ! -f "k8s/secrets.yaml" ]; then
        log_error "secrets.yaml not found. Please create k8s/secrets.yaml with your secrets"
        exit 1
    fi
    
    kubectl apply -f k8s/secrets.yaml -n $NAMESPACE
    log_success "Secrets applied"
}

# Function to deploy database components
deploy_database() {
    log_info "Deploying database components..."
    
    kubectl apply -f k8s/database.yaml -n $NAMESPACE
    
    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s
    
    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s
    
    log_success "Database components deployed successfully"
}

# Function to run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Create a temporary job to run migrations
    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: aoede-migration-$(date +%s)
  namespace: $NAMESPACE
spec:
  template:
    spec:
      containers:
      - name: migration
        image: $DOCKER_IMAGE:$VERSION
        command: ["python", "-m", "alembic", "upgrade", "head"]
        envFrom:
        - configMapRef:
            name: aoede-config
        - secretRef:
            name: aoede-secrets
      restartPolicy: Never
  backoffLimit: 3
EOF
    
    log_success "Database migration job created"
}

# Function to deploy application
deploy_application() {
    log_info "Deploying Aoede application..."
    
    # Update image version in deployment
    sed "s|image: aoede:latest|image: $DOCKER_IMAGE:$VERSION|g" k8s/deployment.yaml | kubectl apply -f - -n $NAMESPACE
    
    # Wait for deployment to be ready
    log_info "Waiting for application deployment to be ready..."
    kubectl wait --for=condition=available deployment/aoede-app -n $NAMESPACE --timeout=600s
    
    log_success "Application deployed successfully"
}

# Function to deploy monitoring
deploy_monitoring() {
    log_info "Deploying monitoring components..."
    
    # Apply monitoring configurations if they exist
    if [ -f "k8s/monitoring.yaml" ]; then
        kubectl apply -f k8s/monitoring.yaml -n $NAMESPACE
        log_success "Monitoring components deployed"
    else
        log_warning "No monitoring configuration found, skipping..."
    fi
}

# Function to verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check if all pods are running
    log_info "Checking pod status..."
    kubectl get pods -n $NAMESPACE
    
    # Check if all deployments are ready
    log_info "Checking deployment status..."
    kubectl get deployments -n $NAMESPACE
    
    # Check if services are available
    log_info "Checking service status..."
    kubectl get services -n $NAMESPACE
    
    # Test application health endpoint
    log_info "Testing application health..."
    
    # Port forward to test locally (in background)
    kubectl port-forward svc/aoede-app-service 8080:8000 -n $NAMESPACE &
    PORT_FORWARD_PID=$!
    
    # Wait a moment for port forward to establish
    sleep 5
    
    # Test health endpoint
    if curl -f http://localhost:8080/api/v1/health > /dev/null 2>&1; then
        log_success "Application health check passed"
    else
        log_warning "Application health check failed or service not yet ready"
    fi
    
    # Kill port forward process
    kill $PORT_FORWARD_PID 2>/dev/null || true
    
    log_success "Deployment verification completed"
}

# Function to show deployment info
show_deployment_info() {
    log_info "Deployment Information:"
    echo "========================="
    echo "Application: $APP_NAME"
    echo "Namespace: $NAMESPACE"
    echo "Version: $VERSION"
    echo "Image: $DOCKER_IMAGE:$VERSION"
    echo ""
    
    log_info "Getting external access information..."
    kubectl get ingress -n $NAMESPACE
    
    log_info "Application endpoints:"
    echo "- Health Check: /api/v1/health"
    echo "- API Documentation: /api/docs"
    echo "- WebSocket: /ws/"
    echo ""
    
    log_info "To view logs:"
    echo "kubectl logs -f deployment/aoede-app -n $NAMESPACE"
    echo ""
    
    log_info "To scale application:"
    echo "kubectl scale deployment/aoede-app --replicas=N -n $NAMESPACE"
}

# Function to rollback deployment
rollback_deployment() {
    log_warning "Rolling back deployment..."
    
    kubectl rollout undo deployment/aoede-app -n $NAMESPACE
    
    log_info "Waiting for rollback to complete..."
    kubectl rollout status deployment/aoede-app -n $NAMESPACE --timeout=300s
    
    log_success "Deployment rolled back successfully"
}

# Function to cleanup deployment
cleanup_deployment() {
    log_warning "Cleaning up deployment..."
    
    read -p "Are you sure you want to delete the entire $NAMESPACE namespace? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete namespace $NAMESPACE
        log_success "Namespace $NAMESPACE deleted"
    else
        log_info "Cleanup cancelled"
    fi
}

# Main deployment function
main_deploy() {
    log_info "Starting Aoede deployment process..."
    log_info "Version: $VERSION"
    
    check_prerequisites
    create_namespace
    apply_secrets
    deploy_database
    
    # Wait a bit for database to be fully ready
    sleep 10
    
    run_migrations
    deploy_application
    deploy_monitoring
    verify_deployment
    show_deployment_info
    
    log_success "Aoede deployment completed successfully!"
}

# Parse command line arguments
case "${2:-deploy}" in
    "deploy")
        main_deploy
        ;;
    "rollback")
        rollback_deployment
        ;;
    "cleanup")
        cleanup_deployment
        ;;
    "verify")
        verify_deployment
        ;;
    "info")
        show_deployment_info
        ;;
    *)
        echo "Usage: $0 [VERSION] [ACTION]"
        echo ""
        echo "VERSION: Docker image version (default: latest)"
        echo "ACTION:"
        echo "  deploy   - Deploy application (default)"
        echo "  rollback - Rollback to previous version"
        echo "  cleanup  - Delete entire deployment"
        echo "  verify   - Verify current deployment"
        echo "  info     - Show deployment information"
        echo ""
        echo "Examples:"
        echo "  $0 v1.0.0 deploy"
        echo "  $0 latest rollback"
        echo "  $0 v1.0.0 verify"
        exit 1
        ;;
esac
