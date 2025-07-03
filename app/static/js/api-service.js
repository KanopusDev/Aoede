/**
 * Aoede - Enterprise AI No-Code Agent Platform
 * API Service for managing API interactions
 * 
 * @author Pradyumn Tandon (Gamecooler19)
 * @organization Kanopus
 * @website https://aoede.kanopus.org
 * @version 1.0.0
 */

// API Configuration
const API_BASE_URL = '/api';
const API_VERSION = 'v1';
const API_ENDPOINT = `${API_BASE_URL}/${API_VERSION}`;

// Error Types
const ErrorTypes = {
  NETWORK: 'network_error',
  AUTH: 'authentication_error',
  VALIDATION: 'validation_error',
  SERVER: 'server_error',
  NOT_FOUND: 'not_found_error',
  RATE_LIMIT: 'rate_limit_error',
  GITHUB_UNAVAILABLE: 'github_unavailable',
  UNKNOWN: 'unknown_error'
};

/**
 * API Service for handling API requests
 */
const ApiService = {
  /**
   * Get the authentication token
   * @returns {string|null} The authentication token or null if not found
   */
  getToken() {
    return localStorage.getItem('access_token');
  },
  
  /**
   * Set the authentication token
   * @param {string|null} token - The token to store or null to remove
   */
  setToken(token) {
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  },
  
  /**
   * Get the refresh token
   * @returns {string|null} The refresh token or null if not found
   */
  getRefreshToken() {
    return localStorage.getItem('refresh_token');
  },
  
  /**
   * Set the refresh token
   * @param {string|null} token - The token to store or null to remove
   */
  setRefreshToken(token) {
    if (token) {
      localStorage.setItem('refresh_token', token);
    } else {
      localStorage.removeItem('refresh_token');
    }
  },
  
  /**
   * Get user data from localStorage
   * @returns {Object|null} The user data or null if not found
   */
  getUserData() {
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  },
  
  /**
   * Set user data in localStorage
   * @param {Object|null} userData - The user data to store or null to remove
   */
  setUserData(userData) {
    if (userData) {
      localStorage.setItem('user_data', JSON.stringify(userData));
    } else {
      localStorage.removeItem('user_data');
    }
  },
  
  /**
   * Check if the user is authenticated
   * @returns {boolean} True if authenticated, false otherwise
   */
  isAuthenticated() {
    return !!this.getToken();
  },
  
  /**
   * Clear all authentication data
   */
  clearAuth() {
    this.setToken(null);
    this.setRefreshToken(null);
    this.setUserData(null);
  },
  
  /**
   * Handle API errors and return standardized error objects
   * @param {Error|Response} error - The error to handle
   * @returns {Object} Standardized error object
   */
  handleError(error) {
    // Network error
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return {
        type: ErrorTypes.NETWORK,
        message: 'Unable to connect to the server. Please check your internet connection.',
        original: error
      };
    }
    
    // Response error (with status code)
    if (error instanceof Response) {
      switch (error.status) {
        case 401:
          this.clearAuth(); // Clear auth on 401 responses
          return {
            type: ErrorTypes.AUTH,
            message: 'Authentication failed. Please log in again.',
            status: error.status,
            original: error
          };
          
        case 403:
          return {
            type: ErrorTypes.AUTH,
            message: 'You do not have permission to perform this action.',
            status: error.status,
            original: error
          };
          
        case 404:
          return {
            type: ErrorTypes.NOT_FOUND,
            message: 'The requested resource was not found.',
            status: error.status,
            original: error
          };
          
        case 422:
          return {
            type: ErrorTypes.VALIDATION,
            message: 'Validation failed. Please check your input.',
            status: error.status,
            original: error
          };
          
        case 429:
          return {
            type: ErrorTypes.RATE_LIMIT,
            message: 'Rate limit exceeded. Please try again later.',
            status: error.status,
            original: error
          };
          
        default:
          if (error.status >= 500) {
            return {
              type: ErrorTypes.SERVER,
              message: 'Server error. Please try again later.',
              status: error.status,
              original: error
            };
          }
      }
    }
    
    // For other errors
    return {
      type: ErrorTypes.UNKNOWN,
      message: error.message || 'An unknown error occurred.',
      original: error
    };
  },
  
  /**
   * Make an HTTP request with authentication and error handling
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @param {boolean} [requiresAuth=true] - Whether the request requires authentication
   * @returns {Promise<any>} Response data
   */
  async request(endpoint, options = {}, requiresAuth = true) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_ENDPOINT}${endpoint}`;
    
    // Default request headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    // Add authentication token if required
    if (requiresAuth) {
      const token = this.getToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Prepare the request
    const requestOptions = {
      ...options,
      headers
    };
    
    try {
      const response = await fetch(url, requestOptions);
      
      // Check for successful response
      if (!response.ok) {
        // Try to get error details from response
        try {
          const errorData = await response.json();
          const error = new Error(errorData.detail || errorData.message || 'API request failed');
          error.status = response.status;
          error.data = errorData;
          throw error;
        } catch (jsonError) {
          // If JSON parsing fails, throw response directly
          throw response;
        }
      }
      
      // Parse JSON response if content exists
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      // Standardize and log error
      const standardError = this.handleError(error);
      console.error('API request failed:', standardError);
      
      // Handle 401 errors by redirecting to login
      if (standardError.type === ErrorTypes.AUTH && standardError.status === 401) {
        window.location.href = '/login';
      }
      
      throw standardError;
    }
  },
  
  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} [options={}] - Request options
   * @param {boolean} [requiresAuth=true] - Whether the request requires authentication
   * @returns {Promise<any>} Response data
   */
  async get(endpoint, options = {}, requiresAuth = true) {
    return this.request(endpoint, { ...options, method: 'GET' }, requiresAuth);
  },
  
  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @param {Object} [options={}] - Request options
   * @param {boolean} [requiresAuth=true] - Whether the request requires authentication
   * @returns {Promise<any>} Response data
   */
  async post(endpoint, data, options = {}, requiresAuth = true) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    }, requiresAuth);
  },
  
  /**
   * Make a PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @param {Object} [options={}] - Request options
   * @param {boolean} [requiresAuth=true] - Whether the request requires authentication
   * @returns {Promise<any>} Response data
   */
  async put(endpoint, data, options = {}, requiresAuth = true) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    }, requiresAuth);
  },
  
  /**
   * Make a DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} [options={}] - Request options
   * @param {boolean} [requiresAuth=true] - Whether the request requires authentication
   * @returns {Promise<any>} Response data
   */
  async delete(endpoint, options = {}, requiresAuth = true) {
    return this.request(endpoint, {
      ...options,
      method: 'DELETE'
    }, requiresAuth);
  },
  
  /**
   * Make a PATCH request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @param {Object} [options={}] - Request options
   * @param {boolean} [requiresAuth=true] - Whether the request requires authentication
   * @returns {Promise<any>} Response data
   */
  async patch(endpoint, data, options = {}, requiresAuth = true) {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(data)
    }, requiresAuth);
  },
  
  // Authentication API Methods
  
  /**
   * Login with username/email and password
   * @param {string} usernameOrEmail - Username or email
   * @param {string} password - Password
   * @param {boolean} rememberMe - Whether to remember the user
   * @returns {Promise<Object>} Authentication response
   */
  async login(usernameOrEmail, password, rememberMe = false) {
    const response = await this.post('/auth/login', {
      username_or_email: usernameOrEmail,
      password,
      remember_me: rememberMe
    }, {}, false);
    
    if (response.access_token && response.refresh_token && response.user) {
      this.setToken(response.access_token);
      this.setRefreshToken(response.refresh_token);
      this.setUserData(response.user);
    }
    
    return response;
  },
  
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Registration response
   */
  async register(userData) {
    return this.post('/auth/register', userData, {}, false);
  },
  
  /**
   * Logout the current user
   * @returns {Promise<Object>} Logout response
   */
  async logout() {
    try {
      await this.post('/auth/logout', {});
    } finally {
      this.clearAuth();
    }
  },
  
  /**
   * Get the current user's profile
   * @returns {Promise<Object>} User profile
   */
  async getCurrentUser() {
    const userData = this.getUserData();
    if (userData && userData.id) {
      try {
        const freshUserData = await this.get('/auth/me');
        this.setUserData(freshUserData);
        return freshUserData;
      } catch (error) {
        if (error.status === 401) {
          this.clearAuth();
        }
        throw error;
      }
    }
    throw new Error('User not authenticated');
  },
  
  /**
   * Request a password reset
   * @param {string} email - User email
   * @returns {Promise<Object>} Password reset request response
   */
  async requestPasswordReset(email) {
    return this.post('/auth/password-reset', { email }, {}, false);
  },
  
  /**
   * Reset password with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @param {string} confirmPassword - Confirm new password
   * @returns {Promise<Object>} Password reset response
   */
  async resetPassword(token, newPassword, confirmPassword) {
    return this.post('/auth/password-reset/confirm', {
      token,
      new_password: newPassword,
      confirm_password: confirmPassword
    }, {}, false);
  },
  
  // Project API Methods
  
  /**
   * Get all projects for the current user
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<Array>} List of projects
   */
  async getProjects(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.skip) queryParams.append('skip', params.skip);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);
    
    const query = queryParams.toString();
    const endpoint = `/projects/${query ? `?${query}` : ''}`;
    
    return this.get(endpoint);
  },
  
  /**
   * Get a project by ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project details
   */
  async getProject(projectId) {
    return this.get(`/projects/${projectId}`);
  },
  
  /**
   * Create a new project
   * @param {Object} projectData - Project data
   * @returns {Promise<Object>} Created project
   */
  async createProject(projectData) {
    return this.post('/projects', projectData);
  },
  
  /**
   * Update a project
   * @param {string} projectId - Project ID
   * @param {Object} projectData - Project data to update
   * @returns {Promise<Object>} Updated project
   */
  async updateProject(projectId, projectData) {
    return this.put(`/projects/${projectId}`, projectData);
  },
  
  /**
   * Delete a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Deletion response
   */
  async deleteProject(projectId) {
    return this.delete(`/projects/${projectId}`);
  },
  
  // Code Generation API Methods
  
  /**
   * Generate code based on prompt
   * @param {Object} generationData - Code generation data
   * @returns {Promise<Object>} Generated code
   */
  async generateCode(generationData) {
    return this.post('/generator/code', generationData);
  },
  
  /**
   * Validate code snippet
   * @param {Object} validationData - Code validation data
   * @returns {Promise<Object>} Validation result
   */
  async validateCode(validationData) {
    return this.post('/generator/validate', validationData);
  },
  
  /**
   * Get all code generations for a project
   * @param {string} projectId - Project ID
   * @param {Object} [params={}] - Query parameters
   * @returns {Promise<Array>} List of code generations
   */
  async getCodeGenerations(projectId, params = {}) {
    const queryParams = new URLSearchParams();
    if (params.skip) queryParams.append('skip', params.skip);
    if (params.limit) queryParams.append('limit', params.limit);
    
    const query = queryParams.toString();
    const endpoint = `/projects/${projectId}/generations${query ? `?${query}` : ''}`;
    
    return this.get(endpoint);
  },
  
  // Health API Methods
  
  /**
   * Get API health status
   * @param {boolean} [detailed=false] - Whether to get detailed health info
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus(detailed = false) {
    const endpoint = detailed ? '/health/detailed' : '/health';
    return this.get(endpoint, {}, false);
  },
  
  /**
   * Check if GitHub models are available
   * @returns {Promise<boolean>} True if available, false otherwise
   */
  async checkGitHubModelsAvailability() {
    try {
      const healthData = await this.get('/health/detailed', {}, false);
      return healthData.components && 
             healthData.components.ai_models && 
             healthData.components.ai_models.github_models_available === true;
    } catch (error) {
      console.error('Failed to check GitHub models availability:', error);
      return false;
    }
  },
  
  /**
   * Check if user is authenticated
   * @returns {boolean} Whether the user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken();
  },
  
  /**
   * Clear all authentication data
   */
  clearAuth() {
    this.setToken(null);
    this.setRefreshToken(null);
    this.setUserData(null);
  },
  
  /**
   * Create headers for API requests
   * @param {boolean} includeAuth - Whether to include authentication headers
   * @returns {Object} Headers object
   */
  createHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (includeAuth) {
      const token = this.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    return headers;
  },
  
  /**
   * Handle API response errors
   * @param {Object} error - The error object
   * @param {string} fallbackMessage - Fallback message if error details cannot be determined
   * @returns {Object} Standardized error object
   */
  handleError(error, fallbackMessage = 'An unknown error occurred') {
    // Network errors
    if (error.message === 'Failed to fetch' || !navigator.onLine) {
      return {
        type: ErrorTypes.NETWORK,
        message: 'Network connection error. Please check your internet connection.',
        original: error
      };
    }

    // Handle response with error status
    if (error.status) {
      switch (error.status) {
        case 401:
          // Unauthorized - clear tokens and redirect to login
          this.clearAuth();
          
          // Only redirect if not already on login page
          if (!window.location.pathname.includes('/login')) {
            setTimeout(() => {
              window.location.href = '/login?session_expired=true';
            }, 100);
          }
          
          return {
            type: ErrorTypes.AUTH,
            message: 'Your session has expired. Please log in again.',
            original: error
          };
          
        case 403:
          return {
            type: ErrorTypes.AUTH,
            message: 'You do not have permission to perform this action.',
            original: error
          };
          
        case 404:
          return {
            type: ErrorTypes.NOT_FOUND,
            message: 'The requested resource was not found.',
            original: error
          };
          
        case 422:
          let validationMessage = 'Validation error. Please check your input.';
          let details = [];
          
          // Extract validation details if available
          try {
            if (error.data?.detail) {
              if (Array.isArray(error.data.detail)) {
                details = error.data.detail;
                // Create a more user-friendly message from the first error
                if (details.length > 0 && details[0].msg) {
                  validationMessage = details[0].msg;
                }
              } else if (typeof error.data.detail === 'string') {
                validationMessage = error.data.detail;
              }
            }
          } catch (e) {
            console.error('Error parsing validation details:', e);
          }
          
          return {
            type: ErrorTypes.VALIDATION,
            message: validationMessage,
            details: details,
            original: error
          };
          
        case 429:
          return {
            type: ErrorTypes.RATE_LIMIT,
            message: 'Too many requests. Please try again later.',
            original: error
          };
          
        case 503:
          // Check if this is specifically GitHub models being unavailable
          if (error.data?.detail?.includes('GitHub')) {
            return {
              type: ErrorTypes.GITHUB_UNAVAILABLE,
              message: 'GitHub AI models are currently unavailable. Please try again later.',
              original: error
            };
          }
          // Fall through to server error
          
        case 500:
        case 502:
        case 504:
          return {
            type: ErrorTypes.SERVER,
            message: 'Server error. Please try again later.',
            original: error
          };
          
        default:
          return {
            type: ErrorTypes.UNKNOWN,
            message: error.data?.detail || fallbackMessage,
            original: error
          };
      }
    }

    // Default error response
    return {
      type: ErrorTypes.UNKNOWN,
      message: fallbackMessage,
      original: error
    };
  },
  
  /**
   * Base fetch method with error handling and authentication
   * @param {string} url - The URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} The response data
   */
  async fetchWithAuth(url, options = {}) {
    // Add authorization headers if needed
    const headers = options.headers || this.createHeaders();
    
    // Track request start time for performance monitoring
    const startTime = performance.now();
    
    try {
      console.debug(`API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers,
        // Add credentials to ensure cookies are sent
        credentials: 'same-origin'
      });
      
      // Log response time for performance monitoring
      const endTime = performance.now();
      const duration = endTime - startTime;
      console.debug(`API Response: ${response.status} ${url} (${Math.round(duration)}ms)`);
      
      // Check for JSON response
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      // Parse response data
      let data;
      try {
        data = isJson ? await response.json() : await response.text();
      } catch (e) {
        console.error('Error parsing response:', e);
        data = { error: 'Failed to parse response' };
      }
      
      // Handle error responses
      if (!response.ok) {
        const error = {
          status: response.status,
          statusText: response.statusText,
          data
        };
        
        // If it's an auth error and we have a refresh token, try to refresh
        if (response.status === 401 && this.getRefreshToken()) {
          console.debug('Access token expired, attempting refresh');
          const refreshed = await this.refreshAuth();
          if (refreshed) {
            // Retry with new token
            console.debug('Token refreshed, retrying request');
            options.headers = this.createHeaders();
            return this.fetchWithAuth(url, options);
          }
        }
        
        throw this.handleError(error);
      }
      
      return data;
    } catch (error) {
      if (error.type) {
        // Already handled error
        throw error;
      }
      throw this.handleError(error);
    }
  },
  
  /**
   * Refresh authentication token
   */
  async refreshAuth() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;
    
    try {
      const response = await fetch(`${API_ENDPOINT}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      
      if (!response.ok) {
        this.clearAuth();
        return false;
      }
      
      const data = await response.json();
      this.setToken(data.access_token);
      
      if (data.refresh_token) {
        this.setRefreshToken(data.refresh_token);
      }
      
      return true;
    } catch (error) {
      this.clearAuth();
      return false;
    }
  },
  
  // =========================================================================
  // Authentication endpoints
  // =========================================================================
  
  /**
   * Login user with username/email and password
   */
  async login(username, password) {
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      
      const response = await fetch(`${API_ENDPOINT}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw { status: response.status, data };
      }
      
      // Store tokens
      this.setToken(data.access_token);
      if (data.refresh_token) {
        this.setRefreshToken(data.refresh_token);
      }
      
      return {
        success: true,
        user: data.user
      };
    } catch (error) {
      throw this.handleError(error, 'Login failed');
    }
  },
  
  /**
   * Register new user
   */
  async register(userData) {
    try {
      const response = await fetch(`${API_ENDPOINT}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw { status: response.status, data };
      }
      
      return {
        success: true,
        user: data.user
      };
    } catch (error) {
      throw this.handleError(error, 'Registration failed');
    }
  },
  
  /**
   * Get current user details
   */
  async getCurrentUser() {
    if (!this.isAuthenticated()) {
      return null;
    }
    
    try {
      return await this.fetchWithAuth(`${API_ENDPOINT}/auth/me`);
    } catch (error) {
      if (error.type === ErrorTypes.AUTH) {
        this.clearAuth();
        return null;
      }
      throw error;
    }
  },
  
  /**
   * Log out the current user
   */
  async logout() {
    if (!this.isAuthenticated()) {
      this.clearAuth();
      return true;
    }
    
    try {
      await this.fetchWithAuth(`${API_ENDPOINT}/auth/logout`, {
        method: 'POST'
      });
      this.clearAuth();
      return true;
    } catch (error) {
      this.clearAuth();
      return false;
    }
  },

  // =========================================================================
  // Project management endpoints
  // =========================================================================
  
  /**
   * Get all projects for the current user
   */
  async getProjects(params = { skip: 0, limit: 100, status: null }) {
    const queryParams = new URLSearchParams();
    if (params.skip) queryParams.append('skip', params.skip);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);
    
    const url = `${API_ENDPOINT}/projects/?${queryParams.toString()}`;
    return this.fetchWithAuth(url);
  },

}
