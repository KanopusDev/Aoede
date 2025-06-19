/**
 * Main JavaScript application for Aoede
 */

// Application state
const App = {
    currentSection: 'dashboard',
    projects: [],
    models: [],
    currentGeneration: null,
    currentTest: null,
    
    // Initialize the application
    init() {
        this.setupEventListeners();
        this.loadInitialData();
        this.startHealthCheck();
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Menu toggle
        document.getElementById('menuButton').addEventListener('click', this.toggleMenu);
        
        // Form submissions
        document.getElementById('generateForm').addEventListener('submit', this.handleGenerateForm);
        document.getElementById('testForm').addEventListener('submit', this.handleTestForm);
        document.getElementById('modelTestForm').addEventListener('submit', this.handleModelTestForm);
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('menuDropdown');
            const button = document.getElementById('menuButton');
            
            if (!menu.contains(e.target) && !button.contains(e.target)) {
                menu.classList.add('hidden');
            }
        });
        
        // Close modal when clicking background
        document.getElementById('modalContainer').addEventListener('click', (e) => {
            if (e.target.id === 'modalContainer') {
                this.closeModal();
            }
        });
    },
    
    // Load initial data
    async loadInitialData() {
        try {
            await Promise.all([
                this.loadProjects(),
                this.loadModels(),
                this.loadDashboardStats()
            ]);
        } catch (error) {
            console.error('Error loading initial data:', error);
            UI.showNotification('Error loading application data', 'error');
        }
    },
    
    // Start periodic health check
    startHealthCheck() {
        this.checkHealth();
        setInterval(() => this.checkHealth(), 30000); // Check every 30 seconds
    },
      // Check system health
    async checkHealth() {
        try {
            if (typeof API === 'undefined') {
                console.error('API is not defined in checkHealth');
                this.updateHealthStatus('error', { error: 'API not available' });
                return;
            }
            const response = await API.get('/health/detailed');
            this.updateHealthStatus(response.status, response);
        } catch (error) {
            console.error('Health check failed:', error);
            this.updateHealthStatus('error', { error: error.message });
        }
    },
    
    // Update health status in UI
    updateHealthStatus(status, data) {
        const indicator = document.getElementById('healthIndicator');
        const text = document.getElementById('healthText');
        
        indicator.className = 'w-3 h-3 rounded-full';
        
        switch (status) {
            case 'healthy':
                indicator.classList.add('bg-green-500');
                text.textContent = 'Healthy';
                break;
            case 'degraded':
                indicator.classList.add('bg-yellow-500');
                text.textContent = 'Degraded';
                break;
            case 'unhealthy':
            case 'error':
                indicator.classList.add('bg-red-500');
                text.textContent = 'Unhealthy';
                break;
            default:
                indicator.classList.add('bg-gray-400');
                text.textContent = 'Unknown';
        }
    },
      // Load projects
    async loadProjects() {
        try {
            if (typeof API === 'undefined') {
                console.error('API is not defined in loadProjects');
                return;
            }
            this.projects = await API.get('/projects/');
            this.updateProjectsList();
            this.updateProjectSelect();
        } catch (error) {
            console.error('Error loading projects:', error);
        }
    },
      // Load AI models
    async loadModels() {
        try {
            if (typeof API === 'undefined') {
                console.error('API is not defined in loadModels');
                return;
            }
            this.models = await API.get('/models/');
            this.updateModelSelect();
            await this.loadModelStatus();
        } catch (error) {
            console.error('Error loading models:', error);
        }
    },
    
    // Load dashboard statistics
    async loadDashboardStats() {
        try {
            // In a real implementation, this would call actual stats endpoints
            document.getElementById('totalProjects').textContent = this.projects.length;
            document.getElementById('totalGenerations').textContent = '0';
            document.getElementById('totalTests').textContent = '0';
            document.getElementById('successRate').textContent = '100%';
            
            this.loadRecentActivity();
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    },
    
    // Load recent activity
    loadRecentActivity() {
        const activityContainer = document.getElementById('recentActivity');
        activityContainer.innerHTML = `
            <div class="text-sm text-gray-500">
                <p>• Application started successfully</p>
                <p>• ${this.projects.length} projects loaded</p>
                <p>• ${this.models.length} AI models available</p>
                <p>• System health check passed</p>
            </div>
        `;
    },
    
    // Update projects list
    updateProjectsList() {
        const container = document.getElementById('projectsList');
        
        if (this.projects.length === 0) {
            container.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                    </svg>
                    <h3 class="mt-2 text-sm font-medium text-gray-900">No projects</h3>
                    <p class="mt-1 text-sm text-gray-500">Get started by creating a new project.</p>
                    <div class="mt-6">
                        <button onclick="createProject()" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                            <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                            </svg>
                            New Project
                        </button>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.projects.map(project => `
            <div class="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">${UI.escapeHtml(project.name)}</h3>
                    <span class="badge badge-${this.getStatusColor(project.status)}">${project.status}</span>
                </div>
                
                ${project.description ? `<p class="text-gray-600 mb-4">${UI.escapeHtml(project.description)}</p>` : ''}
                
                <div class="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>${project.code_generations_count} generations</span>
                    <span>Created ${UI.formatDate(project.created_at)}</span>
                </div>
                
                <div class="flex space-x-2">
                    <button onclick="viewProject('${project.id}')" class="flex-1 text-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                        View
                    </button>
                    <button onclick="generateForProject('${project.id}')" class="flex-1 text-center px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700">
                        Generate
                    </button>
                </div>
            </div>
        `).join('');
    },
    
    // Update project select dropdown
    updateProjectSelect() {
        const select = document.getElementById('projectSelect');
        select.innerHTML = '<option value="">Select a project...</option>' + 
            this.projects.map(project => 
                `<option value="${project.id}">${UI.escapeHtml(project.name)}</option>`
            ).join('');
    },
    
    // Update model select dropdown
    updateModelSelect() {
        const select = document.getElementById('modelSelect');
        select.innerHTML = '<option value="">Auto-select</option>' + 
            this.models.map(model => 
                `<option value="${model.name}">${model.name} (${model.type})</option>`
            ).join('');
    },
    
    // Load model status
    async loadModelStatus() {
        try {
            const status = await API.get('/models/status');
            this.updateModelStatus(status);
        } catch (error) {
            console.error('Error loading model status:', error);
        }
    },
    
    // Update model status display
    updateModelStatus(status) {
        const container = document.getElementById('modelStatus');
        
        container.innerHTML = `
            <div class="mb-4">
                <div class="flex items-center justify-between">
                    <span class="text-sm font-medium">Overall Status</span>
                    <span class="badge badge-${status.overall_status === 'healthy' ? 'success' : 'error'}">
                        ${status.overall_status}
                    </span>
                </div>
                <p class="text-sm text-gray-500 mt-1">
                    ${status.healthy_models}/${status.total_models} models healthy
                </p>
            </div>
            
            <div class="space-y-2">
                ${Object.entries(status.models).map(([name, info]) => `
                    <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span class="text-sm font-medium">${name}</span>
                        <span class="badge badge-${info.status === 'healthy' ? 'success' : 'error'}">
                            ${info.status}
                        </span>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    // Get status color for badges
    getStatusColor(status) {
        const colorMap = {
            'active': 'success',
            'completed': 'info',
            'error': 'error',
            'paused': 'warning'
        };
        return colorMap[status] || 'info';
    },
    
    // Toggle menu dropdown
    toggleMenu() {
        const dropdown = document.getElementById('menuDropdown');
        dropdown.classList.toggle('hidden');
    },
    
    // Handle generate form submission
    async handleGenerateForm(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        
        const data = {
            prompt: formData.get('prompt'),
            language: formData.get('language'),
            project_id: formData.get('project_id') || null
        };
        
        if (!data.prompt.trim()) {
            UI.showNotification('Please enter a prompt', 'warning');
            return;
        }
        
        const button = document.getElementById('generateButtonText');
        const spinner = document.getElementById('generateSpinner');
        
        try {
            button.textContent = 'Generating...';
            spinner.classList.remove('hidden');
            
            const result = await API.post('/generate/code', data);
            
            if (result.success) {
                this.currentGeneration = result;
                this.showGenerationResult(result);
                UI.showNotification('Code generated successfully!', 'success');
            } else {
                throw new Error(result.error || 'Generation failed');
            }
            
        } catch (error) {
            console.error('Generate error:', error);
            UI.showNotification(`Generation failed: ${error.message}`, 'error');
        } finally {
            button.textContent = 'Generate Code';
            spinner.classList.add('hidden');
        }
    },
    
    // Show generation result
    showGenerationResult(result) {
        const container = document.getElementById('generationResult');
        const codeElement = document.getElementById('generatedCode');
        
        codeElement.textContent = result.code;
        container.classList.remove('hidden');
        
        // Scroll to result
        container.scrollIntoView({ behavior: 'smooth' });
    },
    
    // Handle test form submission
    async handleTestForm(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        
        const data = {
            code: formData.get('code'),
            language: formData.get('language')
        };
        
        if (!data.code.trim()) {
            UI.showNotification('Please enter code to test', 'warning');
            return;
        }
        
        const button = document.getElementById('testButtonText');
        const spinner = document.getElementById('testSpinner');
        
        try {
            button.textContent = 'Testing...';
            spinner.classList.remove('hidden');
            
            const result = await API.post('/test/execute', data);
            
            this.currentTest = result;
            this.showTestResult(result);
            
            if (result.success) {
                UI.showNotification('Tests completed successfully!', 'success');
            } else {
                UI.showNotification('Tests completed with errors', 'warning');
            }
            
        } catch (error) {
            console.error('Test error:', error);
            UI.showNotification(`Test failed: ${error.message}`, 'error');
        } finally {
            button.textContent = 'Run Full Test';
            spinner.classList.add('hidden');
        }
    },
    
    // Show test result
    showTestResult(result) {
        const container = document.getElementById('testResults');
        const output = document.getElementById('testOutput');
        
        let html = '';
        
        if (result.success) {
            html += `
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <svg class="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <h4 class="text-green-800 font-medium">Tests Passed</h4>
                    </div>
                    <p class="text-green-700 mt-2">
                        Code validation completed successfully in ${result.total_iterations} iterations.
                    </p>
                </div>
            `;
        } else {
            html += `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="flex items-center">
                        <svg class="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <h4 class="text-red-800 font-medium">Tests Failed</h4>
                    </div>
                    <p class="text-red-700 mt-2">${result.error || 'Unknown error occurred'}</p>
                </div>
            `;
        }
        
        // Show final code if different from input
        if (result.final_code && result.final_code !== document.getElementById('testCode').value) {
            html += `
                <div class="mt-4">
                    <h4 class="font-medium text-gray-900 mb-2">Fixed Code:</h4>
                    <div class="bg-gray-900 rounded-lg p-4">
                        <pre class="text-green-400 text-sm overflow-x-auto">${UI.escapeHtml(result.final_code)}</pre>
                    </div>
                </div>
            `;
        }
        
        output.innerHTML = html;
        container.classList.remove('hidden');
        
        // Scroll to result
        container.scrollIntoView({ behavior: 'smooth' });
    },
    
    // Handle model test form submission
    async handleModelTestForm(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        
        const data = {
            prompt: formData.get('prompt'),
            model: formData.get('model') || null
        };
        
        if (!data.prompt.trim()) {
            UI.showNotification('Please enter a test prompt', 'warning');
            return;
        }
        
        const button = document.getElementById('modelTestButtonText');
        const spinner = document.getElementById('modelTestSpinner');
        
        try {
            button.textContent = 'Testing...';
            spinner.classList.remove('hidden');
            
            const result = await API.post('/models/test', data);
            
            this.showModelTestResult(result);
            
            if (result.success) {
                UI.showNotification('Model test completed!', 'success');
            } else {
                UI.showNotification('Model test failed', 'error');
            }
            
        } catch (error) {
            console.error('Model test error:', error);
            UI.showNotification(`Model test failed: ${error.message}`, 'error');
        } finally {
            button.textContent = 'Test Model';
            spinner.classList.add('hidden');
        }
    },
    
    // Show model test result
    showModelTestResult(result) {
        const container = document.getElementById('modelTestResult');
        const output = document.getElementById('modelTestOutput');
        
        let content = '';
        
        if (result.success) {
            content = `Model: ${result.model_used}
Response Time: ${result.response_time.toFixed(3)}s
Input Tokens: ${result.input_tokens}
Output Tokens: ${result.output_tokens}

Response:
${result.response}`;
        } else {
            content = `Error: ${result.error}`;
        }
        
        output.textContent = content;
        container.classList.remove('hidden');
    },
    
    // Close modal
    closeModal() {
        document.getElementById('modalContainer').classList.add('hidden');
    },
    
    // Show modal
    showModal(content) {
        document.getElementById('modalContent').innerHTML = content;
        document.getElementById('modalContainer').classList.remove('hidden');
    }
};

// Global functions for onclick handlers
function showSection(section) {
    App.currentSection = section;
    
    // Hide all sections
    document.querySelectorAll('.section').forEach(el => {
        el.classList.add('hidden');
    });
    
    // Show selected section
    document.getElementById(section).classList.remove('hidden');
    
    // Hide menu
    document.getElementById('menuDropdown').classList.add('hidden');
    
    // Load section-specific data
    switch (section) {
        case 'projects':
            App.loadProjects();
            break;
        case 'models':
            App.loadModelStatus();
            break;
        case 'monitoring':
            loadMonitoringData();
            break;
    }
}

function createProject() {
    const content = `
        <div class="px-4 py-5 sm:p-6">
            <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Create New Project</h3>
            <form id="createProjectForm" class="space-y-4">
                <div>
                    <label for="projectName" class="block text-sm font-medium text-gray-700">Project Name</label>
                    <input type="text" id="projectName" name="name" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                </div>
                
                <div>
                    <label for="projectDescription" class="block text-sm font-medium text-gray-700">Description (Optional)</label>
                    <textarea id="projectDescription" name="description" rows="3" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"></textarea>
                </div>
                
                <div class="flex justify-end space-x-3 pt-4">
                    <button type="button" onclick="App.closeModal()" class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Cancel
                    </button>
                    <button type="submit" class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                        Create Project
                    </button>
                </div>
            </form>
        </div>
    `;
    
    App.showModal(content);
    
    // Handle form submission
    document.getElementById('createProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = {
            name: formData.get('name'),
            description: formData.get('description') || null
        };
        
        try {
            const project = await API.post('/projects/', data);
            App.projects.push(project);
            App.updateProjectsList();
            App.updateProjectSelect();
            App.closeModal();
            UI.showNotification('Project created successfully!', 'success');
        } catch (error) {
            console.error('Create project error:', error);
            UI.showNotification(`Failed to create project: ${error.message}`, 'error');
        }
    });
}

function viewProject(projectId) {
    // Implementation for viewing project details
    UI.showNotification('Project view not implemented yet', 'info');
}

function generateForProject(projectId) {
    // Set project in generate form and switch to generate section
    document.getElementById('projectSelect').value = projectId;
    showSection('generate');
}

function copyCode() {
    const code = document.getElementById('generatedCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        UI.showNotification('Code copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        UI.showNotification('Failed to copy code', 'error');
    });
}

function testGenerated() {
    if (App.currentGeneration) {
        document.getElementById('testCode').value = App.currentGeneration.code;
        document.getElementById('testLanguage').value = App.currentGeneration.language;
        showSection('test');
    }
}

async function validateCode() {
    const code = document.getElementById('testCode').value;
    const language = document.getElementById('testLanguage').value;
    
    if (!code.trim()) {
        UI.showNotification('Please enter code to validate', 'warning');
        return;
    }
    
    try {
        const result = await API.post('/test/validate-only', {
            code: code,
            language: language
        });
        
        App.showTestResult(result);
        
        if (result.success) {
            UI.showNotification('Code validation passed!', 'success');
        } else {
            UI.showNotification('Code validation found issues', 'warning');
        }
        
    } catch (error) {
        console.error('Validation error:', error);
        UI.showNotification(`Validation failed: ${error.message}`, 'error');
    }
}

async function loadMonitoringData() {
    try {
        const [health, stats] = await Promise.all([
            API.get('/health/detailed'),
            API.get('/models/usage/summary')
        ]);
        
        updateSystemHealth(health);
        updateUsageStats(stats);
        
    } catch (error) {
        console.error('Error loading monitoring data:', error);
        UI.showNotification('Failed to load monitoring data', 'error');
    }
}

function updateSystemHealth(health) {
    const container = document.getElementById('systemHealth');
    
    container.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center justify-between">
                <span class="text-sm font-medium">Overall Status</span>
                <span class="badge badge-${health.status === 'healthy' ? 'success' : 'error'}">
                    ${health.status}
                </span>
            </div>
            
            <div class="space-y-2">
                <div class="flex justify-between text-sm">
                    <span>CPU Usage</span>
                    <span>${health.system?.cpu_percent?.toFixed(1) || 0}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-blue-600 h-2 rounded-full" style="width: ${health.system?.cpu_percent || 0}%"></div>
                </div>
            </div>
            
            <div class="space-y-2">
                <div class="flex justify-between text-sm">
                    <span>Memory Usage</span>
                    <span>${health.system?.memory_percent?.toFixed(1) || 0}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="bg-green-600 h-2 rounded-full" style="width: ${health.system?.memory_percent || 0}%"></div>
                </div>
            </div>
            
            <div class="pt-2 border-t">
                <p class="text-xs text-gray-500">
                    Last updated: ${new Date().toLocaleTimeString()}
                </p>
            </div>
        </div>
    `;
}

function updateUsageStats(stats) {
    const container = document.getElementById('usageStats');
    
    container.innerHTML = `
        <div class="space-y-3">
            <div class="grid grid-cols-2 gap-4">
                <div class="text-center">
                    <p class="text-2xl font-semibold text-blue-600">${stats.total_requests || 0}</p>
                    <p class="text-sm text-gray-500">Total Requests</p>
                </div>
                <div class="text-center">
                    <p class="text-2xl font-semibold text-green-600">${stats.total_tokens || 0}</p>
                    <p class="text-sm text-gray-500">Total Tokens</p>
                </div>
            </div>
            
            <div class="pt-2 border-t">
                <div class="flex justify-between text-sm">
                    <span>Success Rate</span>
                    <span class="font-medium">${stats.success_rate || 100}%</span>
                </div>
                <div class="flex justify-between text-sm mt-1">
                    <span>Avg Response Time</span>
                    <span class="font-medium">${stats.average_response_time || 0}ms</span>
                </div>
            </div>
            
            <div class="pt-2 border-t">
                <p class="text-xs text-gray-500">                    Period: ${stats.time_period || 'Last 24 hours'}
                </p>
            </div>
        </div>
    `;
}

// App object is available globally for manual initialization
