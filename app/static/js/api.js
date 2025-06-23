/**
 * Enterprise API Service Module
 * Handles all HTTP communications with the Aoede backend
 */
class APIService {
    constructor() {
        this.baseURL = window.location.origin;
        this.apiVersion = '/api/v1';
        this.authToken = localStorage.getItem('auth_token');
        this.refreshToken = localStorage.getItem('refresh_token');
        this.isProduction = true;
        
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        this.requestInterceptors = [];
        this.responseInterceptors = [];

        // Setup automatic token refresh and request retry
        this.setupTokenRefresh();
        this.setupRequestRetry();
        this.setupErrorHandling();
    }

    /**
     * Set authentication token with secure storage
     */
    setAuthToken(token) {
        this.authToken = token;
        if (token) {
            localStorage.setItem('auth_token', token);
            
            // Set token expiry monitoring
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.exp) {
                    const expiryTime = payload.exp * 1000 - 60000; // 1 minute before expiry
                    setTimeout(() => {
                        this.refreshAuthToken().catch(() => {
                            this.clearAuth();
                        });
                    }, expiryTime - Date.now());
                }
            } catch (e) {
                // Invalid token format, clear it
                this.clearAuth();
            }
        }
    }

    /**
     * Clear authentication with cleanup
     */
    clearAuth() {
        this.authToken = null;
        this.refreshToken = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        
        // Dispatch auth cleared event
        window.dispatchEvent(new CustomEvent('auth:cleared'));
    }

    /**
     * Get default headers with authentication
     */
    getHeaders(customHeaders = {}) {
        const headers = Object.assign({}, this.defaultHeaders, customHeaders);
        
        if (this.authToken) {
            headers['Authorization'] = 'Bearer ' + this.authToken;
        }
        
        return headers;
    }    /**
     * Setup automatic token refresh with improved error handling
     */
    setupTokenRefresh() {
        var self = this;
        setInterval(function() {
            if (self.refreshToken && self.authToken) {
                self.refreshAuthToken().catch(function(error) {
                    self.handleError('Token refresh failed', error);
                    self.clearAuth();
                    window.dispatchEvent(new CustomEvent('auth:logout'));
                });
            }
        }, 15 * 60 * 1000); // Refresh every 15 minutes
    }

    /**
     * Setup request retry mechanism
     */
    setupRequestRetry() {
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second base delay
    }

    /**
     * Setup centralized error handling
     */
    setupErrorHandling() {
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason instanceof APIError) {
                this.handleAPIError(event.reason);
                event.preventDefault();
            }
        });
    }

    /**
     * Handle API errors centrally
     */
    handleAPIError(error) {
        if (error.isAuthError) {
            this.clearAuth();
            window.dispatchEvent(new CustomEvent('api:error', {
                detail: { ...error, isAuthError: true }
            }));
        } else if (error.isNetworkError) {
            window.dispatchEvent(new CustomEvent('api:error', {
                detail: { ...error, isNetworkError: true }
            }));
        } else {
            window.dispatchEvent(new CustomEvent('api:error', {
                detail: error
            }));
        }
    }

    /**
     * Enhanced error handling
     */
    handleError(message, error) {
        if (this.isProduction) {
            // Log error to monitoring service
            this.logError(message, error);
        }
    }

    logError(message, error) {
        // Send to error logging service
        if (typeof this.logErrorToService === 'function') {
            this.logErrorToService({
                message: message,
                error: error ? error.toString() : null,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent
            }).catch(() => {
                // Silently fail if logging service unavailable
            });
        }
    }    /**
     * Core HTTP request method with retry logic and enhanced error handling
     */
    async request(endpoint, options, retryCount = 0) {
        options = options || {};
        const url = this.baseURL + this.apiVersion + endpoint;
        const config = Object.assign({
            method: 'GET',
            headers: this.getHeaders(options.headers)
        }, options);

        // Apply request interceptors
        for (var i = 0; i < this.requestInterceptors.length; i++) {
            await this.requestInterceptors[i](config);
        }

        try {
            const response = await fetch(url, config);
            
            // Apply response interceptors
            for (var i = 0; i < this.responseInterceptors.length; i++) {
                await this.responseInterceptors[i](response);
            }

            if (!response.ok) {
                const errorData = await response.json().catch(function() { return null; });
                
                // Handle specific error cases
                if (response.status === 401 && this.authToken) {
                    // Try to refresh token
                    try {
                        await this.refreshAuthToken();
                        // Retry the original request
                        return this.request(endpoint, options, retryCount);
                    } catch (refreshError) {
                        this.clearAuth();
                        throw new APIError('Authentication failed', 401, errorData);
                    }
                }
                
                throw new APIError(
                    errorData?.message || `HTTP ${response.status}: ${response.statusText}`,
                    response.status,
                    errorData
                );
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            return await response.text();
        } catch (error) {
            if (error instanceof APIError) {
                throw error;
            }
            
            // Retry on network errors
            if (retryCount < this.maxRetries && this.isRetryableError(error)) {
                await this.delay(this.retryDelay * Math.pow(2, retryCount)); // Exponential backoff
                return this.request(endpoint, options, retryCount + 1);
            }
            
            throw new APIError('Network request failed', 0, { originalError: error.message });
        }
    }

    /**
     * Check if error is retryable
     */
    isRetryableError(error) {
        return error.name === 'TypeError' || // Network error
               error.name === 'AbortError' || // Request aborted
               (error.status >= 500 && error.status < 600); // Server errors
    }

    /**
     * Delay utility for retry mechanism
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * GET request
     */
    async get(endpoint, params) {
        params = params || {};
        const searchParams = new URLSearchParams(params);
        const queryString = searchParams.toString();
        const url = queryString ? endpoint + '?' + queryString : endpoint;
        
        return this.request(url);
    }

    /**
     * POST request
     */
    async post(endpoint, data, options) {
        options = options || {};
        return this.request(endpoint, Object.assign({
            method: 'POST',
            body: data ? JSON.stringify(data) : null
        }, options));
    }

    /**
     * PUT request
     */
    async put(endpoint, data, options) {
        options = options || {};
        return this.request(endpoint, Object.assign({
            method: 'PUT',
            body: data ? JSON.stringify(data) : null
        }, options));
    }

    /**
     * PATCH request
     */
    async patch(endpoint, data, options) {
        options = options || {};
        return this.request(endpoint, Object.assign({
            method: 'PATCH',
            body: data ? JSON.stringify(data) : null
        }, options));
    }

    /**
     * DELETE request
     */
    async delete(endpoint, options) {
        options = options || {};
        return this.request(endpoint, Object.assign({
            method: 'DELETE'
        }, options));
    }

    // Authentication endpoints
    async register(userData) {
        return this.post('/auth/register', userData);
    }

    async login(credentials) {
        const response = await this.post('/auth/login', credentials);
        
        if (response.access_token) {
            this.setAuthToken(response.access_token);
            if (response.refresh_token) {
                this.refreshToken = response.refresh_token;
                localStorage.setItem('refresh_token', response.refresh_token);
            }
        }
        
        return response;
    }

    async logout() {
        try {
            await this.post('/auth/logout');        } catch (error) {
            // Silent logout failure - authentication is cleared anyway
        }finally {
            this.clearAuth();
        }
    }

    async refreshAuthToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        const response = await this.post('/auth/refresh', {
            refresh_token: this.refreshToken
        });

        if (response.access_token) {
            this.setAuthToken(response.access_token);
        }

        return response;
    }

    async getCurrentUser() {
        return this.get('/auth/me');
    }

    async updateProfile(profileData) {
        return this.put('/auth/profile', profileData);
    }

    // Project endpoints
    async getProjects(params) {
        return this.get('/projects', params);
    }

    async getProject(projectId) {
        return this.get('/projects/' + projectId);
    }

    async createProject(projectData) {
        return this.post('/projects', projectData);
    }

    async updateProject(projectId, projectData) {
        return this.put('/projects/' + projectId, projectData);
    }

    async deleteProject(projectId) {
        return this.delete('/projects/' + projectId);
    }

    // Code generation endpoints
    async generateCode(generationData) {
        return this.post('/generate/code', generationData);
    }

    async validateCode(codeData) {
        return this.post('/generate/validate', codeData);
    }

    async getGenerationHistory(params) {
        return this.get('/generate/history', params);
    }

    async getGeneration(generationId) {
        return this.get('/generate/' + generationId);
    }

    // AI models endpoints
    async getAIModels() {
        return this.get('/models');
    }

    async testModel(modelData) {
        return this.post('/models/test', modelData);
    }

    async getModelUsage(params) {
        return this.get('/models/usage', params);
    }

    // Testing endpoints
    async runTests(testData) {
        return this.post('/testing/run', testData);
    }

    async getTestResults(testId) {
        return this.get('/testing/results/' + testId);
    }

    async getTestHistory(params) {
        return this.get('/testing/history', params);
    }

    // Health endpoints
    async healthCheck() {
        return this.get('/health');
    }

    async getMetrics() {
        return this.get('/health/metrics');
    }
}

/**
 * Custom API Error class
 */
class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.name = 'APIError';
        this.status = status || 0;
        this.data = data || null;
    }

    get isNetworkError() {
        return this.status === 0;
    }

    get isClientError() {
        return this.status >= 400 && this.status < 500;
    }

    get isServerError() {
        return this.status >= 500;
    }

    get isAuthError() {
        return this.status === 401 || this.status === 403;
    }
}

// Create global instances
window.APIService = APIService;
window.APIError = APIError;
window.api = new APIService();
