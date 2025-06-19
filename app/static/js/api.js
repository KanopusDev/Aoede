/**
 * API Client Module
 * Handles all communication with the backend API
 */

class APIClient {
    constructor() {
        this.baseURL = window.location.origin;
        this.apiVersion = 'v1';
        this.baseAPIURL = `${this.baseURL}/api/${this.apiVersion}`;
        this.token = localStorage.getItem('auth_token');
        this.requestId = 0;
    }

    /**
     * Generate unique request ID for tracking
     */
    generateRequestId() {
        return `req_${Date.now()}_${++this.requestId}`;
    }

    /**
     * Default headers for API requests
     */
    getDefaultHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Request-ID': this.generateRequestId()
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    /**
     * Generic API request method
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseAPIURL}${endpoint}`;
        const config = {
            headers: this.getDefaultHeaders(),
            ...options
        };

        try {
            console.log(`API Request: ${config.method || 'GET'} ${url}`);
            
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `HTTP error! status: ${response.status}`);
            }

            console.log(`API Response: ${response.status}`, data);
            return data;
        } catch (error) {
            console.error(`API Error for ${endpoint}:`, error);
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(endpoint, params = {}) {
        const url = new URL(`${this.baseAPIURL}${endpoint}`);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });

        return this.request(endpoint + (url.search || ''), {
            method: 'GET'
        });
    }

    /**
     * POST request
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }

    // ============ PROJECT API METHODS ============

    /**
     * Get all projects
     */
    async getProjects(skip = 0, limit = 100) {
        return this.get('/projects', { skip, limit });
    }

    /**
     * Get project by ID
     */
    async getProject(projectId) {
        return this.get(`/projects/${projectId}`);
    }

    /**
     * Create new project
     */
    async createProject(projectData) {
        return this.post('/projects', projectData);
    }

    /**
     * Update project
     */
    async updateProject(projectId, projectData) {
        return this.put(`/projects/${projectId}`, projectData);
    }

    /**
     * Delete project
     */
    async deleteProject(projectId) {
        return this.delete(`/projects/${projectId}`);
    }

    // ============ CODE GENERATION API METHODS ============

    /**
     * Generate code
     */
    async generateCode(generationData) {
        return this.post('/generate/code', generationData);
    }

    /**
     * Get generation by ID
     */
    async getGeneration(generationId) {
        return this.get(`/generate/${generationId}`);
    }

    /**
     * Get project generations
     */
    async getProjectGenerations(projectId, skip = 0, limit = 50) {
        return this.get(`/generate/project/${projectId}`, { skip, limit });
    }

    /**
     * Update generation
     */
    async updateGeneration(generationId, updateData) {
        return this.put(`/generate/${generationId}`, updateData);
    }

    /**
     * Delete generation
     */
    async deleteGeneration(generationId) {
        return this.delete(`/generate/${generationId}`);
    }

    // ============ TESTING API METHODS ============

    /**
     * Execute code tests
     */
    async executeTests(testData) {
        return this.post('/test/execute', testData);
    }

    /**
     * Validate code
     */
    async validateCode(validationData) {
        return this.post('/test/validate', validationData);
    }

    /**
     * Generate fixes for code
     */
    async generateFixes(fixData) {
        return this.post('/test/fix', fixData);
    }

    /**
     * Get test results
     */
    async getTestResults(generationId) {
        return this.get(`/test/results/${generationId}`);
    }

    /**
     * Get test metrics
     */
    async getTestMetrics(projectId, days = 7) {
        return this.get(`/test/metrics/${projectId}`, { days });
    }

    // ============ AI MODELS API METHODS ============

    /**
     * Get available models
     */
    async getModels() {
        return this.get('/models');
    }

    /**
     * Get model status
     */
    async getModelStatus() {
        return this.get('/models/status');
    }

    /**
     * Get model usage metrics
     */
    async getModelUsage(modelName = null, days = 7) {
        const params = { days };
        if (modelName) params.model_name = modelName;
        return this.get('/models/usage', params);
    }

    /**
     * Test model health
     */
    async testModelHealth(modelName) {
        return this.post('/models/health', { model_name: modelName });
    }

    // ============ HEALTH API METHODS ============

    /**
     * Get system health
     */
    async getHealth() {
        return this.get('/health');
    }

    /**
     * Get detailed health info
     */
    async getHealthDetailed() {
        return this.get('/health/detailed');
    }

    // ============ WEBSOCKET METHODS ============

    /**
     * Connect to WebSocket for real-time updates
     */
    connectWebSocket(endpoint, onMessage, onError = null, onClose = null) {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsURL = `${wsProtocol}//${window.location.host}/ws${endpoint}`;
        
        console.log(`Connecting to WebSocket: ${wsURL}`);
        
        const ws = new WebSocket(wsURL);
        
        ws.onopen = () => {
            console.log(`WebSocket connected: ${endpoint}`);
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (error) {
                console.error('WebSocket message parse error:', error);
                if (onError) onError(error);
            }
        };
        
        ws.onerror = (error) => {
            console.error(`WebSocket error on ${endpoint}:`, error);
            if (onError) onError(error);
        };
        
        ws.onclose = (event) => {
            console.log(`WebSocket closed: ${endpoint}`, event.code, event.reason);
            if (onClose) onClose(event);
        };
        
        return ws;
    }

    /**
     * Connect to project status WebSocket
     */
    connectProjectStatus(projectId, onMessage, onError, onClose) {
        return this.connectWebSocket(
            `/project/${projectId}/status`,
            onMessage,
            onError,
            onClose
        );
    }

    /**
     * Connect to generation progress WebSocket
     */
    connectGenerationProgress(onMessage, onError, onClose) {
        return this.connectWebSocket(
            '/generation/progress',
            onMessage,
            onError,
            onClose
        );
    }

    /**
     * Connect to test results WebSocket
     */
    connectTestResults(onMessage, onError, onClose) {
        return this.connectWebSocket(
            '/testing/results',
            onMessage,
            onError,
            onClose
        );
    }

    // ============ FILE UPLOAD METHODS ============

    /**
     * Upload file
     */
    async uploadFile(file, endpoint = '/upload') {
        const formData = new FormData();
        formData.append('file', file);

        const headers = {
            'X-Request-ID': this.generateRequestId()
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(`${this.baseAPIURL}${endpoint}`, {
                method: 'POST',
                headers: headers,
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    }

    // ============ BULK OPERATIONS ============

    /**
     * Bulk delete projects
     */
    async bulkDeleteProjects(projectIds) {
        return this.post('/projects/bulk-delete', { project_ids: projectIds });
    }

    /**
     * Bulk generate code
     */
    async bulkGenerateCode(generationRequests) {
        return this.post('/generate/bulk', { requests: generationRequests });
    }

    // ============ EXPORT METHODS ============

    /**
     * Export project data
     */
    async exportProject(projectId, format = 'json') {
        return this.get(`/projects/${projectId}/export`, { format });
    }

    /**
     * Export generation code
     */
    async exportGeneration(generationId, format = 'zip') {
        return this.get(`/generate/${generationId}/export`, { format });
    }

    // ============ SEARCH METHODS ============

    /**
     * Search projects
     */
    async searchProjects(query, filters = {}) {
        return this.get('/projects/search', { q: query, ...filters });
    }

    /**
     * Search generations
     */
    async searchGenerations(query, filters = {}) {
        return this.get('/generate/search', { q: query, ...filters });
    }

    // ============ ANALYTICS METHODS ============

    /**
     * Get usage analytics
     */
    async getUsageAnalytics(startDate, endDate, granularity = 'day') {
        return this.get('/analytics/usage', {
            start_date: startDate,
            end_date: endDate,
            granularity
        });
    }

    /**
     * Get performance metrics
     */
    async getPerformanceMetrics(metricType = 'all', days = 7) {
        return this.get('/analytics/performance', {
            metric_type: metricType,
            days
        });
    }

    // ============ UTILITY METHODS ============

    /**
     * Set authentication token
     */
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    /**
     * Clear authentication token
     */
    clearToken() {
        this.setToken(null);
    }

    /**
     * Check if authenticated
     */
    isAuthenticated() {
        return !!this.token;
    }

    /**
     * Handle API errors globally
     */
    handleError(error, context = '') {
        console.error(`API Error ${context}:`, error);
        
        // Handle specific error types
        if (error.message.includes('401')) {
            this.clearToken();
            window.location.reload();
        } else if (error.message.includes('429')) {
            // Rate limiting
            console.warn('Rate limit exceeded, please try again later');
        } else if (error.message.includes('500')) {
            console.error('Server error, please try again later');
        }
        
        return error;
    }
}

// Create global API client instance
console.log('Creating API client...');
const API = new APIClient();
window.API = API;
window.apiClient = API; // Keep backward compatibility
console.log('API client created:', typeof API, typeof window.API);

// Double-check API is available
if (typeof window.API === 'undefined') {
    console.error('Failed to create global API object');
} else {
    console.log('Global API object created successfully');
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
}
