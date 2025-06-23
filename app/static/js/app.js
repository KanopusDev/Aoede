/**
 * Aoede Application Main Entry Point
 * Enterprise-grade Progressive Web Application
 */
class AoedeApp {
    constructor() {
        this.version = '1.0.0';
        this.isInitialized = false;
        this.features = {};
        this.isProduction = true;
        this.serviceWorker = null;
        
        this.init();
    }

    async init() {
        try {
            // Setup emergency fallback FIRST
            this.setupEmergencyFallback();
            
            // Register service worker for PWA functionality
            await this.registerServiceWorker();
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(function(resolve) {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Initialize core modules with error handling
            try {
                await this.initializeCore();
            } catch (error) {
                this.handleError('Core initialization failed', error);
            }
            
            // Initialize features with error handling
            try {
                await this.initializeFeatures();
            } catch (error) {
                this.handleError('Feature initialization failed', error);
            }
            
            // Setup global event handlers
            this.setupGlobalEventHandlers();
            
            // Initialize UI enhancements
            this.initializeUIEnhancements();
            
            // Initialize enterprise features
            this.initializeEnterpriseFeatures();
            
            // Hide loading screen
            this.hideLoadingScreen();
            
            this.isInitialized = true;
            
        } catch (error) {
            this.handleInitializationError(error);
        }
    }    setupEmergencyFallback() {
        // Ensure basic navigation works even if everything else fails
        
        // Create fallback UI functions
        if (!window.showSection) {
            window.showSection = function(section) {
                const sections = document.querySelectorAll('.section');
                sections.forEach(function(sec) {
                    sec.classList.add('hidden');
                    sec.classList.remove('active');
                });
                
                const targetSection = document.getElementById(section);
                if (targetSection) {
                    targetSection.classList.remove('hidden');
                    targetSection.classList.add('active');
                    targetSection.style.animation = 'fadeInUp 0.5s ease-out';
                }
            };
        }
        
        // Hide loading screen immediately if visible
        setTimeout(function() {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
        }, 100);
    }    async initializeCore() {
        // Core modules should already be initialized
        // Just verify they exist and create fallbacks if needed
        if (!window.api) {
            this.handleError('API Service not available - creating fallback');
            window.api = {
                get: function() { return Promise.resolve({}); },
                post: function() { return Promise.resolve({}); },
                put: function() { return Promise.resolve({}); },
                delete: function() { return Promise.resolve({}); }
            };
        }
        
        if (!window.ui) {
            this.handleError('UI Manager not available - creating fallback');
            window.ui = {
                navigateToView: function(view) { 
                    if (window.showSection) window.showSection(view);
                },
                openModal: function(modal) { 
                    const modalElement = document.getElementById(modal);
                    if (modalElement) {
                        modalElement.classList.remove('hidden');
                        modalElement.classList.add('show');
                    }
                },
                closeModal: function(modal) { 
                    const modalElement = document.getElementById(modal);
                    if (modalElement) {
                        modalElement.classList.add('hidden');
                        modalElement.classList.remove('show');
                    }
                },
                showToast: function(msg, type) { 
                    this.createToast(msg, type);
                },
                createToast: function(message, type) {
                    const toast = document.createElement('div');
                    toast.className = `alert alert-${type} fixed top-4 right-4 z-50`;
                    toast.innerHTML = `
                        <div class="alert-content">
                            <span>${message}</span>
                        </div>
                        <button class="alert-close" onclick="this.parentElement.remove()">×</button>
                    `;
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 5000);
                }
            };
        }
        
        if (!window.auth) {
            this.handleError('Auth Manager not available - creating fallback');
            window.auth = {
                isAuthenticated: false,
                currentUser: null,
                requireAuth: function() { return false; }
            };
        }
    }    async initializeFeatures() {
        try {
            // Initialize project management feature
            this.features.projects = new ProjectsFeature();
        } catch (error) {
            this.handleError('Failed to initialize Projects feature', error);
        }
        
        try {
            // Initialize code generation feature
            this.features.codeGeneration = new CodeGenerationFeature();
        } catch (error) {
            this.handleError('Failed to initialize Code Generation feature', error);
        }
        
        try {
            // Initialize analysis feature
            this.features.analysis = new AnalysisFeature();
        } catch (error) {
            this.handleError('Failed to initialize Analysis feature', error);
        }
        
        try {
            // Initialize models feature
            this.features.models = new ModelsFeature();
        } catch (error) {
            this.handleError('Failed to initialize Models feature', error);
        }
    }

    initializeUIEnhancements() {
        // Initialize enhanced button interactions
        this.initializeButtonEnhancements();
        
        // Initialize card hover effects
        this.initializeCardEnhancements();
        
        // Initialize form enhancements
        this.initializeFormEnhancements();
        
        // Initialize loading states
        this.initializeLoadingStates();
        
        // Initialize responsive behaviors
        this.initializeResponsiveBehaviors();
    }

    initializeButtonEnhancements() {
        // Add ripple effect to buttons
        const buttons = document.querySelectorAll('.btn');
        buttons.forEach(button => {
            button.addEventListener('click', function(e) {
                const ripple = document.createElement('span');
                ripple.classList.add('ripple');
                this.appendChild(ripple);
                
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.width = ripple.style.height = size + 'px';
                ripple.style.left = x + 'px';
                ripple.style.top = y + 'px';
                
                setTimeout(() => ripple.remove(), 600);
            });
        });
    }

    initializeCardEnhancements() {
        // Add enhanced hover effects for cards
        const cards = document.querySelectorAll('.project-card, .model-card, .feature-card, .dashboard-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-4px)';
                this.style.transition = 'all 0.3s ease-out';
            });
            
            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });
    }

    initializeFormEnhancements() {
        // Add floating label animations
        const formInputs = document.querySelectorAll('.form-input, .form-textarea');
        formInputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.classList.add('focused');
                const label = this.parentNode.querySelector('.form-label');
                if (label) {
                    label.classList.add('floating');
                }
            });
            
            input.addEventListener('blur', function() {
                this.classList.remove('focused');
                if (!this.value) {
                    const label = this.parentNode.querySelector('.form-label');
                    if (label) {
                        label.classList.remove('floating');
                    }
                }
            });
        });
    }

    initializeLoadingStates() {
        // Add loading state management for buttons
        const loadingButtons = document.querySelectorAll('[data-loading]');
        loadingButtons.forEach(button => {
            button.addEventListener('click', function() {
                if (!this.disabled) {
                    this.classList.add('loading');
                    this.disabled = true;
                    
                    const spinner = this.querySelector('.fa-spinner');
                    if (spinner) {
                        spinner.classList.remove('hidden');
                    }
                }
            });
        });
    }

    initializeResponsiveBehaviors() {
        // Handle mobile navigation
        const mobileToggle = document.querySelector('.mobile-nav-toggle');
        const mobileMenu = document.querySelector('.mobile-nav-menu');
        
        if (mobileToggle && mobileMenu) {
            mobileToggle.addEventListener('click', function() {
                mobileMenu.classList.toggle('show');
            });
        }
        
        // Handle responsive table scrolling
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-responsive';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        });
    }

    handleError(message, error) {
        if (this.isProduction) {
            // In production, log to error service
            this.logError(message, error);
        }
    }    
    logError(message, error) {
        // Send error to logging service
        if (window.api && typeof window.api.logError === 'function') {
            try {
                const logPromise = window.api.logError({
                    message: message,
                    error: error ? error.toString() : null,
                    timestamp: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    url: window.location.href
                });
                
                // Only call catch if it's a Promise
                if (logPromise && typeof logPromise.catch === 'function') {
                    logPromise.catch(() => {
                        // Silently fail if logging service is unavailable
                    });
                }
            } catch (e) {
                // Silently fail if logging service is unavailable
            }
        }
    }

    setupGlobalEventHandlers() {
        // Handle API errors globally
        window.addEventListener('api:error', function(e) {
            const error = e.detail;
            
            if (error.isAuthError) {
                window.auth.clearAuthentication();
                window.ui.openModal('authModal');
                window.ui.showToast('Please sign in to continue', 'warning');
            } else if (error.isNetworkError) {
                window.ui.showToast('Network error - please check your connection', 'error');
            } else {
                window.ui.showToast('An error occurred: ' + error.message, 'error');
            }
        });

        // Handle authentication events
        window.addEventListener('auth:login', function() {
            window.ui.navigateToView('dashboard');
        });

        window.addEventListener('auth:logout', function() {
            window.ui.navigateToView('dashboard');
        });
    }    hideLoadingScreen() {
        try {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.opacity = '0';
                loadingScreen.style.transition = 'opacity 0.5s ease-out';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }
            
            // Ensure dashboard is visible with animation
            const dashboard = document.getElementById('dashboard');
            if (dashboard) {
                dashboard.classList.remove('hidden');
                dashboard.classList.add('active');
                dashboard.style.animation = 'fadeInUp 0.5s ease-out';
            }
        } catch (error) {
            this.handleError('Error hiding loading screen', error);
        }
    }

    handleInitializationError(error) {
        this.handleError('Initialization error', error);
        
        // Force hide loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        // Show dashboard as fallback
        const dashboard = document.getElementById('dashboard');
        if (dashboard) {
            dashboard.classList.remove('hidden');
            dashboard.classList.add('active');
        }
        
        // Show error message to user
        setTimeout(function() {
            if (window.ui && window.ui.showToast) {
                window.ui.showToast('Application started with limited functionality', 'warning');
            }
        }, 1000);
    }    /**
     * Emergency initialization fallback
     * This runs if normal initialization takes too long
     */
    setupEmergencyTimeout() {
        // If loading screen is still visible after 10 seconds, force hide it
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen && loadingScreen.style.display !== 'none') {
                this.hideLoadingScreen();
                this.showDashboardFallback();
            }
        }, 10000);
    }

    showDashboardFallback() {
        // Force show dashboard section
        const dashboard = document.getElementById('dashboard');
        if (dashboard) {
            // Hide all sections first
            const sections = document.querySelectorAll('.section');
            sections.forEach(section => {
                section.classList.add('hidden');
                section.classList.remove('active');
            });
            
            // Show dashboard
            dashboard.classList.remove('hidden');
            dashboard.classList.add('active');
            dashboard.style.animation = 'fadeInUp 0.5s ease-out';
        }
    }
}

/**
 * Base class for application features
 */
class FeatureBase {
    constructor(name) {
        this.name = name;
        this.isInitialized = false;
    }    async initialize() {
        this.isInitialized = true;
    }
}

/**
 * Projects management feature
 */
class ProjectsFeature extends FeatureBase {
    constructor() {
        super('Projects');
        this.currentProject = null;
        this.projects = [];
        this.initialize();
    }

    async initialize() {
        await super.initialize();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        const self = this;
        
        // Handle project creation
        window.addEventListener('form:submit', function(e) {
            const detail = e.detail;
            if (detail.formId === 'createProjectForm') {
                self.createProject(detail.data);
            }
        });
    }    async createProject(projectData) {
        try {
            if (!window.auth.requireAuth()) {
                return;
            }

            // Show loading state
            const createButton = document.querySelector('[data-form="createProject"] .btn-primary');
            if (createButton) {
                createButton.classList.add('loading');
                createButton.disabled = true;
            }

            const project = await window.api.createProject(projectData);
            this.projects.push(project);
            
            window.ui.closeModal('createProjectModal');
            window.ui.showToast('Project created successfully!', 'success');
            
            // Refresh projects view with animation
            this.refreshProjectsList();
            
        } catch (error) {
            this.handleError('Failed to create project', error);
            window.ui.showToast('Failed to create project: ' + error.message, 'error');
        } finally {
            // Remove loading state
            const createButton = document.querySelector('[data-form="createProject"] .btn-primary');
            if (createButton) {
                createButton.classList.remove('loading');
                createButton.disabled = false;
            }
        }
    }

    async refreshProjectsList() {
        try {
            this.projects = await window.api.getProjects();
            this.renderProjectsList();
            
            // Add fade-in animation
            const projectCards = document.querySelectorAll('.project-card');
            projectCards.forEach((card, index) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    card.style.transition = 'all 0.3s ease-out';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, index * 100);
            });
        } catch (error) {
            this.handleError('Failed to load projects', error);
        }
    }

    handleError(message, error) {
        if (window.app && typeof window.app.handleError === 'function') {
            window.app.handleError(message, error);
        }
    }renderProjectsList() {
        const container = document.getElementById('projectsList');
        if (!container) return;

        if (this.projects.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 col-span-full">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-folder-open text-gray-400 text-xl"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">No projects yet</h3>
                    <p class="text-gray-600 mb-6">Create your first project to get started with AI code generation.</p>
                    <button onclick="createProject()" class="btn-primary">
                        <i class="fas fa-plus"></i>
                        Create Your First Project
                    </button>
                </div>
            `;
            return;
        }

        const projectsHTML = this.projects.map(function(project) {
            return `
                <div class="project-card" data-project-id="${project.id}">
                    <div class="project-card-header">
                        <h3 class="project-card-title">
                            <i class="fas fa-folder text-primary-600"></i>
                            ${project.name}
                        </h3>
                        <p class="project-card-description">${project.description || 'No description'}</p>
                    </div>
                    <div class="project-card-body">
                        <div class="project-meta">
                            <div class="project-meta-item">
                                <i class="fas fa-calendar"></i>
                                <span>${new Date(project.created_at).toLocaleDateString()}</span>
                            </div>
                            <div class="project-meta-item">
                                <i class="fas fa-code"></i>
                                <span>${project.language || 'Multiple'}</span>
                            </div>
                        </div>
                        <div class="project-status ${project.status || 'active'}">${project.status || 'Active'}</div>
                    </div>
                    <div class="project-card-footer">
                        <div class="project-stats">
                            <div class="project-stat">
                                <i class="fas fa-file-code"></i>
                                <span>${project.files_count || 0}</span>
                            </div>
                            <div class="project-stat">
                                <i class="fas fa-clock"></i>
                                <span>${project.last_modified || 'Never'}</span>
                            </div>
                        </div>
                        <div class="project-actions">
                            <button onclick="selectProject('${project.id}')" class="btn-primary btn-sm">
                                <i class="fas fa-folder-open"></i>
                                Open
                            </button>
                            <button onclick="editProject('${project.id}')" class="btn-secondary btn-sm">
                                <i class="fas fa-edit"></i>
                                Edit
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = projectsHTML;
    }
}

/**
 * Code generation feature
 */
class CodeGenerationFeature extends FeatureBase {
    constructor() {
        super('Code Generation');
        this.generationHistory = [];
        this.initialize();
    }

    async initialize() {
        await super.initialize();
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        const self = this;
        
        window.addEventListener('form:submit', function(e) {
            const detail = e.detail;
            if (detail.formId === 'generateCodeForm') {
                self.generateCode(detail.data);
            }
        });
    }    async generateCode(generationData) {
        try {
            if (!window.auth.requireAuth()) {
                return;
            }

            // Show loading UI
            this.showGenerationLoading(true);
            
            const result = await window.api.generateCode(generationData);
            
            this.generationHistory.unshift(result);
            this.displayGenerationResult(result);
            
            window.ui.showToast('Code generated successfully!', 'success');
            
        } catch (error) {
            this.handleError('Code generation failed', error);
            window.ui.showToast('Code generation failed: ' + error.message, 'error');
        } finally {
            this.showGenerationLoading(false);
        }
    }

    showGenerationLoading(isLoading) {
        const generateButton = document.querySelector('#generateForm .btn-primary');
        const spinner = document.getElementById('generateSpinner');
        const icon = document.getElementById('generateIcon');
        const text = document.getElementById('generateButtonText');

        if (generateButton) {
            generateButton.disabled = isLoading;
        }

        if (spinner) {
            spinner.classList.toggle('hidden', !isLoading);
        }

        if (icon) {
            icon.classList.toggle('hidden', isLoading);
        }

        if (text) {
            text.textContent = isLoading ? 'Generating...' : 'Generate Code';
        }
    }

    displayGenerationResult(result) {
        const container = document.getElementById('generationResult');
        if (!container) return;

        const resultHTML = `
            <div class="generation-result-card">
                <div class="generation-result-header">
                    <h3><i class="fas fa-check-circle"></i> Generated Code</h3>
                    <div class="flex items-center space-x-2">
                        <button onclick="copyCode()" class="btn-ghost btn-sm">
                            <i class="fas fa-copy"></i>
                            Copy
                        </button>
                        <button onclick="testGenerated()" class="btn-secondary btn-sm">
                            <i class="fas fa-vial"></i>
                            Test
                        </button>
                        <button onclick="saveToProject()" class="btn-primary btn-sm">
                            <i class="fas fa-save"></i>
                            Save
                        </button>
                    </div>
                </div>
                <div class="code-block-container">
                    <button class="code-copy-btn" onclick="copyToClipboard('${result.id}')">
                        <i class="fas fa-copy"></i>
                    </button>
                    <pre id="generatedCode" class="code-block">${this.escapeHtml(result.code)}</pre>
                </div>
                <div class="generation-meta p-4 bg-gray-50 border-t">
                    <div class="flex justify-between items-center text-sm text-gray-600">
                        <span><i class="fas fa-code"></i> Language: ${result.language}</span>
                        <span><i class="fas fa-clock"></i> Generated: ${new Date(result.created_at).toLocaleString()}</span>
                        <span><i class="fas fa-file"></i> Size: ${result.code.length} characters</span>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = resultHTML;
        container.classList.remove('hidden');
        
        // Add animation
        const resultCard = container.querySelector('.generation-result-card');
        if (resultCard) {
            resultCard.style.opacity = '0';
            resultCard.style.transform = 'translateY(20px)';
            setTimeout(() => {
                resultCard.style.transition = 'all 0.5s ease-out';
                resultCard.style.opacity = '1';
                resultCard.style.transform = 'translateY(0)';
            }, 100);
        }
    }

    handleError(message, error) {
        if (window.app && typeof window.app.handleError === 'function') {
            window.app.handleError(message, error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

/**
 * Analysis feature
 */
class AnalysisFeature extends FeatureBase {
    constructor() {
        super('Analysis');
        this.initialize();
    }

    async initialize() {
        await super.initialize();
        // Analysis feature initialization
    }
}

/**
 * Models management feature
 */
class ModelsFeature extends FeatureBase {
    constructor() {
        super('Models');
        this.availableModels = [];
        this.initialize();
    }

    async initialize() {
        await super.initialize();
        await this.loadAvailableModels();
    }    async loadAvailableModels() {
        try {
            this.availableModels = await window.api.getAIModels();
            this.renderModelsList();
            this.updateModelsStats();
        } catch (error) {
            this.handleError('Failed to load models', error);
        }
    }

    renderModelsList() {
        const container = document.getElementById('modelsList');
        if (!container) return;

        if (this.availableModels.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 col-span-full">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-brain text-gray-400 text-xl"></i>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 mb-2">Loading models...</h3>
                    <p class="text-gray-600">Please wait while we check model availability.</p>
                </div>
            `;
            return;
        }

        const modelsHTML = this.availableModels.map(function(model) {
            return `
                <div class="model-card" data-model-id="${model.id}">
                    <div class="model-card-header">
                        <div class="model-name">
                            <div class="model-status-indicator ${model.status}"></div>
                            ${model.name}
                        </div>
                        <div class="model-provider">${model.provider}</div>
                    </div>
                    <div class="model-card-body">
                        <div class="model-description">${model.description}</div>
                        <div class="model-specs">
                            <div class="model-spec">
                                <span class="spec-label">Type</span>
                                <span class="spec-value">${model.type || 'N/A'}</span>
                            </div>
                            <div class="model-spec">
                                <span class="spec-label">Version</span>
                                <span class="spec-value">${model.version || 'N/A'}</span>
                            </div>
                        </div>
                        <div class="model-capabilities">
                            <div class="capabilities-title">Capabilities</div>
                            <div class="capabilities-list">
                                ${(model.capabilities || []).map(cap => `<span class="capability-tag">${cap}</span>`).join('')}
                            </div>
                        </div>
                        <div class="model-metrics">
                            <div class="model-metric">
                                <div class="metric-number">${model.response_time || '0'}ms</div>
                                <div class="metric-label">Avg Response</div>
                            </div>
                            <div class="model-metric">
                                <div class="metric-number">${model.usage_count || '0'}</div>
                                <div class="metric-label">Usage</div>
                            </div>
                            <div class="model-metric">
                                <div class="metric-number">${model.accuracy || '0'}%</div>
                                <div class="metric-label">Accuracy</div>
                            </div>
                        </div>
                    </div>
                    <div class="model-card-footer">
                        <div class="model-last-used">
                            Last used: ${model.last_used ? new Date(model.last_used).toLocaleDateString() : 'Never'}
                        </div>
                        <div class="model-actions">
                            <button onclick="testModel('${model.id}')" class="btn-secondary btn-sm">
                                <i class="fas fa-vial"></i>
                                Test
                            </button>
                            <button onclick="useModel('${model.id}')" class="btn-primary btn-sm">
                                <i class="fas fa-play"></i>
                                Use Model
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = modelsHTML;
        
        // Add staggered animation
        const modelCards = container.querySelectorAll('.model-card');
        modelCards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            setTimeout(() => {
                card.style.transition = 'all 0.3s ease-out';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    updateModelsStats() {
        const onlineModels = this.availableModels.filter(m => m.status === 'online').length;
        const totalModels = this.availableModels.length;
        const avgResponseTime = this.calculateAverageResponseTime();

        const onlineElement = document.getElementById('modelsOnline');
        const totalElement = document.getElementById('totalModels');
        const avgResponseElement = document.getElementById('avgResponseTime');

        if (onlineElement) onlineElement.textContent = onlineModels;
        if (totalElement) totalElement.textContent = totalModels;
        if (avgResponseElement) avgResponseElement.textContent = avgResponseTime + 'ms';
    }

    calculateAverageResponseTime() {
        if (this.availableModels.length === 0) return 0;
        
        const totalTime = this.availableModels.reduce((sum, model) => {
            return sum + (model.response_time || 0);
        }, 0);
        
        return Math.round(totalTime / this.availableModels.length);
    }

    handleError(message, error) {
        if (window.app && typeof window.app.handleError === 'function') {
            window.app.handleError(message, error);
        }
    }
}

// Global utility functions with enhanced styling
function selectProject(projectId) {
    if (window.app && window.app.features.projects) {
        window.app.features.projects.selectProject(projectId);
    }
}

function editProject(projectId) {
    if (window.app && window.app.features.projects) {
        window.app.features.projects.editProject(projectId);
    }
}

function testModel(modelId) {
    if (window.app && window.app.features.models) {
        window.app.features.models.testModel(modelId);
    }
}

function useModel(modelId) {
    if (window.app && window.app.features.models) {
        window.app.features.models.useModel(modelId);
    }
}

function copyCode() {
    const codeElement = document.getElementById('generatedCode');
    if (codeElement) {
        navigator.clipboard.writeText(codeElement.textContent).then(() => {
            window.ui.showToast('Code copied to clipboard!', 'success');
        }).catch(() => {
            window.ui.showToast('Failed to copy code', 'error');
        });
    }
}

function testGenerated() {
    const codeElement = document.getElementById('generatedCode');
    if (codeElement && window.app.features.codeGeneration) {
        window.app.features.codeGeneration.testGeneratedCode(codeElement.textContent);
    }
}

function saveToProject() {
    const codeElement = document.getElementById('generatedCode');
    if (codeElement && window.app.features.projects) {
        window.app.features.projects.saveCode(codeElement.textContent);
    }
}

function copyToClipboard(generationId) {
    const codeElement = document.getElementById('generatedCode');
    if (codeElement) {
        navigator.clipboard.writeText(codeElement.textContent).then(() => {
            window.ui.showToast('Copied to clipboard!', 'success');
            
            // Add visual feedback
            const copyBtn = document.querySelector('.code-copy-btn');
            if (copyBtn) {
                copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                copyBtn.classList.add('btn-success');
                setTimeout(() => {
                    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                    copyBtn.classList.remove('btn-success');
                }, 2000);
            }
        }).catch(() => {
            window.ui.showToast('Failed to copy to clipboard', 'error');
        });
    }
}

function createProject() {
    window.ui.openModal('createProjectModal');
}

function toggleAdvancedOptions() {
    const advancedOptions = document.getElementById('advancedOptions');
    const toggleIcon = document.getElementById('advancedToggleIcon');
    const toggleText = document.getElementById('advancedToggleText');
    
    if (advancedOptions) {
        const isHidden = advancedOptions.classList.contains('hidden');
        
        if (isHidden) {
            advancedOptions.classList.remove('hidden');
            advancedOptions.style.animation = 'slideDown 0.3s ease-out';
            if (toggleIcon) toggleIcon.classList.replace('fa-chevron-down', 'fa-chevron-up');
            if (toggleText) toggleText.textContent = 'Hide Advanced Options';
        } else {
            advancedOptions.style.animation = 'slideUp 0.3s ease-out';
            setTimeout(() => {
                advancedOptions.classList.add('hidden');
            }, 300);
            if (toggleIcon) toggleIcon.classList.replace('fa-chevron-up', 'fa-chevron-down');
            if (toggleText) toggleText.textContent = 'Show Advanced Options';
        }
    }
}

function showDemo() {
    // Implementation for demo functionality
    window.ui.showToast('Demo feature coming soon!', 'info');
}

// Character count for textareas
function updateCharCount(textarea, countElement) {
    if (countElement) {
        countElement.textContent = textarea.value.length;
    }
}

// Enhanced debug functions (removed console logs)
window.debugAoede = function() {
    const debugInfo = {
        api: window.api ? 'Loaded' : 'NOT LOADED',
        ui: window.ui ? 'Loaded' : 'NOT LOADED',
        auth: window.auth ? 'Loaded' : 'NOT LOADED',
        app: window.app ? 'Loaded' : 'NOT LOADED'
    };
    
    if (window.app) {
        debugInfo.appInitialized = window.app.isInitialized;
        debugInfo.appFeatures = Object.keys(window.app.features || {});
    }
    
    if (window.ui) {
        debugInfo.currentView = window.ui.currentView;
    }
    
    if (window.auth) {
        debugInfo.authenticated = window.auth.isAuthenticated;
        debugInfo.currentUser = window.auth.currentUser;
    }
    
    return debugInfo;
};

// Enhanced utility functions
window.forceHideLoading = function() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
};

window.forceShowSection = function(sectionName) {
    // Hide all sections
    const sections = document.querySelectorAll('.section');
    sections.forEach(function(section) {
        section.classList.add('hidden');
        section.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');
        targetSection.style.animation = 'fadeInUp 0.5s ease-out';
    }
};

// Add service worker registration method to AoedeApp prototype
AoedeApp.prototype.registerServiceWorker = async function() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/static/sw.js');
            this.serviceWorker = registration;
            
            // Handle service worker updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        this.showUpdateNotification();
                    }
                });
            });
            
            return registration;
        } catch (error) {
            console.error('Service worker registration failed:', error);
            return null;
        }
    }
    return null;
};

// Add enterprise features initialization
AoedeApp.prototype.initializeEnterpriseFeatures = function() {
    // Initialize PWA features
    this.initializePWAFeatures();
    
    // Initialize performance monitoring
    this.initializePerformanceMonitoring();
    
    // Initialize offline support
    this.initializeOfflineSupport();
    
    // Initialize security features
    this.initializeSecurityFeatures();
};

// PWA Features
AoedeApp.prototype.initializePWAFeatures = function() {
    // Add to home screen prompt
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button if needed
        const installButton = document.getElementById('installApp');
        if (installButton) {
            installButton.style.display = 'block';
            installButton.addEventListener('click', async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    deferredPrompt = null;
                    installButton.style.display = 'none';
                }
            });
        }
    });
    
    // Handle app installed
    window.addEventListener('appinstalled', () => {
        if (this.ui && this.ui.showToast) {
            this.ui.showToast('Aoede has been installed successfully!', 'success');
        }
    });
};

// Performance monitoring
AoedeApp.prototype.initializePerformanceMonitoring = function() {
    // Monitor Core Web Vitals
    if ('web-vital' in window) {
        import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
            getCLS(this.sendToAnalytics.bind(this));
            getFID(this.sendToAnalytics.bind(this));
            getFCP(this.sendToAnalytics.bind(this));
            getLCP(this.sendToAnalytics.bind(this));
            getTTFB(this.sendToAnalytics.bind(this));
        });
    }
};

// Offline support
AoedeApp.prototype.initializeOfflineSupport = function() {
    // Monitor online/offline status
    window.addEventListener('online', () => {
        if (this.ui && this.ui.showToast) {
            this.ui.showToast('Connection restored', 'success');
        }
        this.syncOfflineActions();
    });
    
    window.addEventListener('offline', () => {
        if (this.ui && this.ui.showToast) {
            this.ui.showToast('Working offline', 'warning');
        }
    });
};

// Security features
AoedeApp.prototype.initializeSecurityFeatures = function() {
    // CSP violation reporting
    document.addEventListener('securitypolicyviolation', (e) => {
        console.error('CSP Violation:', e.violatedDirective, e.blockedURI);
    });
    
    // Prevent XSS
    this.sanitizeUserInputs();
};

// Utility methods
AoedeApp.prototype.showUpdateNotification = function() {
    if (this.ui && this.ui.showToast) {
        this.ui.showToast('App update available. Refresh to apply.', 'info', {
            persistent: true,
            action: {
                text: 'Refresh',
                callback: () => window.location.reload()
            }
        });
    }
};

AoedeApp.prototype.sendToAnalytics = function(metric) {
    // Send performance metrics to analytics
    if (this.isProduction) {
        console.log('Performance metric:', metric.name, metric.value);
    }
};

AoedeApp.prototype.syncOfflineActions = function() {
    // Sync any offline actions when back online
    if (this.serviceWorker && this.serviceWorker.sync) {
        this.serviceWorker.sync.register('background-sync');
    }
};

AoedeApp.prototype.sanitizeUserInputs = function() {
    // Add input sanitization for security
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            // Basic XSS prevention
            e.target.value = e.target.value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        });
    });
};

// Create and initialize application
window.AoedeApp = AoedeApp;
window.FeatureBase = FeatureBase;
window.app = new AoedeApp();
