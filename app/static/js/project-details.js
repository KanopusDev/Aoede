/**
 * Aoede Platform
 * Project Details JavaScript File
 * 
 * @author Pradyumn Tandon (Gamecooler19)
 * @organization Kanopus
 * @website https://aoede.kanopus.org
 * @version 1.0.0
 * @license MIT
 */

// Project Details state management
const ProjectState = {
  project: null,
  codeGenerations: [],
  testResults: {},
  availableModels: [],
  loading: {
    project: false,
    generations: false,
    tests: false,
    models: false
  },
  filters: {
    status: null,
    search: '',
    model: 'all',
    sort: 'newest'
  },
  pagination: {
    current: 1,
    limit: 10,
    total: 0
  },
  editor: {
    language: 'javascript',
    theme: 'vs-dark',
    content: ''
  },
  websockets: {
    projectStatus: null,
    generationProgress: null,
    testResults: null
  },
  activeGeneration: null,
  error: null
};

/**
 * Initialize the project details page
 */
async function initializeProjectPage() {
  try {
    showLoading();
    
    // Check if user is authenticated
    if (!ApiService.isAuthenticated()) {
      window.location.href = '/login';
      return;
    }
    
    // Get project ID from URL
    const projectId = getProjectIdFromUrl();
    if (!projectId) {
      showErrorNotification('Project ID is missing from URL');
      window.location.href = '/dashboard';
      return;
    }
    
    // Load project data
    await Promise.all([
      loadProject(projectId),
      loadCodeGenerations(projectId),
      loadAvailableModels()
    ]);
    
    // Initialize UI components
    initializeUIComponents();
    
    // Initialize WebSocket connections
    setupWebSocketConnections(projectId);
    
    hideLoading();
  } catch (error) {
    console.error('Failed to initialize project page:', error);
    showErrorNotification('Failed to load project. Please try again.');
    hideLoading();
  }
}

/**
 * Load project data from API
 */
async function loadProject(projectId) {
  try {
    ProjectState.loading.project = true;
    updateLoadingState();
    
    // Get project details
    const project = await ApiService.getProject(projectId);
    
    // Update state
    ProjectState.project = project;
    
    // Update UI
    updateProjectDetails();
    
    ProjectState.loading.project = false;
    updateLoadingState();
    
    return project;
  } catch (error) {
    console.error('Failed to load project:', error);
    showErrorNotification('Failed to load project details');
    ProjectState.error = error;
    ProjectState.loading.project = false;
    updateLoadingState();
    throw error;
  }
}

/**
 * Load code generations for the project
 */
async function loadCodeGenerations(projectId) {
  try {
    ProjectState.loading.generations = true;
    updateLoadingState();
    
    // Get code generations
    const params = {
      skip: (ProjectState.pagination.current - 1) * ProjectState.pagination.limit,
      limit: ProjectState.pagination.limit
    };
    
    const generations = await ApiService.getCodeGenerations(projectId, params);
    
    // Update state
    ProjectState.codeGenerations = generations;
    ProjectState.pagination.total = generations.length; // This will need to be updated if pagination is implemented on the server
    
    // Update UI
    renderCodeGenerations();
    updatePagination();
    
    // Load test results for each generation
    for (const gen of generations) {
      if (gen.generation_id) {
        loadTestResults(gen.generation_id);
      }
    }
    
    ProjectState.loading.generations = false;
    updateLoadingState();
    
    return generations;
  } catch (error) {
    console.error('Failed to load code generations:', error);
    showErrorNotification('Failed to load code generations');
    ProjectState.error = error;
    ProjectState.loading.generations = false;
    updateLoadingState();
    throw error;
  }
}

/**
 * Load test results for a code generation
 */
async function loadTestResults(generationId) {
  try {
    ProjectState.loading.tests = true;
    updateLoadingState();
    
    // Get test results
    const results = await ApiService.getTestResults(generationId);
    
    // Update state
    ProjectState.testResults[generationId] = results;
    
    // Update UI
    updateTestResultsUI(generationId);
    
    ProjectState.loading.tests = false;
    updateLoadingState();
    
    return results;
  } catch (error) {
    console.error(`Failed to load test results for generation ${generationId}:`, error);
    ProjectState.loading.tests = false;
    updateLoadingState();
  }
}

/**
 * Load available AI models
 */
async function loadAvailableModels() {
  try {
    ProjectState.loading.models = true;
    updateLoadingState();
    
    // Get available models
    const models = await ApiService.getAvailableModels();
    
    // Update state
    ProjectState.availableModels = models;
    
    // Update UI
    updateModelsDropdown();
    
    ProjectState.loading.models = false;
    updateLoadingState();
    
    return models;
  } catch (error) {
    console.error('Failed to load available models:', error);
    ProjectState.loading.models = false;
    updateLoadingState();
  }
}

/**
 * Initialize UI components
 */
function initializeUIComponents() {
  // Initialize tabs
  const tabButtons = document.querySelectorAll('[data-tab-target]');
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      activateTab(button.dataset.tabTarget);
    });
  });
  
  // Initialize language selector
  const languageSelector = document.getElementById('language-selector');
  if (languageSelector) {
    languageSelector.addEventListener('change', (e) => {
      ProjectState.editor.language = e.target.value;
      updateEditorLanguage();
    });
  }
  
  // Initialize code generation form
  const generateCodeForm = document.getElementById('generate-code-form');
  if (generateCodeForm) {
    generateCodeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await generateCode();
    });
  }
  
  // Initialize run tests button
  const runTestsButtons = document.querySelectorAll('.run-tests-btn');
  runTestsButtons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      const generationId = button.dataset.generationId;
      if (generationId) {
        await runTests(generationId);
      }
    });
  });
  
  // Initialize copy code buttons
  const copyButtons = document.querySelectorAll('.copy-code-btn');
  copyButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const codeElement = button.closest('.code-block').querySelector('code');
      if (codeElement) {
        copyToClipboard(codeElement.textContent);
        showSuccessNotification('Code copied to clipboard');
      }
    });
  });
  
  // Initialize code search
  const codeSearchInput = document.getElementById('code-search');
  if (codeSearchInput) {
    codeSearchInput.addEventListener('input', (e) => {
      ProjectState.filters.search = e.target.value;
      renderCodeGenerations();
      updatePagination();
    });
  }
  
  // Initialize model filter
  const modelFilter = document.getElementById('model-filter');
  if (modelFilter) {
    modelFilter.addEventListener('change', (e) => {
      ProjectState.filters.model = e.target.value;
      renderCodeGenerations();
      updatePagination();
    });
  }
  
  // Initialize sort filter
  const sortFilter = document.getElementById('sort-filter');
  if (sortFilter) {
    sortFilter.addEventListener('change', (e) => {
      ProjectState.filters.sort = e.target.value;
      renderCodeGenerations();
    });
  }
  
  // Initialize editor (if Monaco editor is available)
  initializeCodeEditor();
}

/**
 * Initialize Monaco code editor
 */
function initializeCodeEditor() {
  if (typeof monaco !== 'undefined') {
    monaco.editor.create(document.getElementById('code-editor'), {
      value: ProjectState.editor.content,
      language: ProjectState.editor.language,
      theme: ProjectState.editor.theme,
      automaticLayout: true,
      minimap: {
        enabled: true
      },
      scrollBeyondLastLine: false,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, monospace',
      lineNumbers: 'on'
    });
  } else {
    // Fallback to basic textarea
    const editorContainer = document.getElementById('code-editor');
    if (editorContainer) {
      const textarea = document.createElement('textarea');
      textarea.className = 'w-full h-full p-4 font-mono text-sm bg-gray-800 text-white';
      textarea.value = ProjectState.editor.content;
      editorContainer.appendChild(textarea);
    }
  }
}

/**
 * Update editor language
 */
function updateEditorLanguage() {
  if (typeof monaco !== 'undefined' && monaco.editor) {
    const editor = monaco.editor.getEditors()[0];
    if (editor) {
      monaco.editor.setModelLanguage(
        editor.getModel(),
        ProjectState.editor.language
      );
    }
  }
}

/**
 * Setup WebSocket connections
 */
function setupWebSocketConnections(projectId) {
  try {
    // Project status WebSocket
    ProjectState.websockets.projectStatus = ApiService.createWebSocketConnection('project_status', projectId);
    
    ProjectState.websockets.projectStatus.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Update project status
        if (data.project_id === ProjectState.project.id) {
          ProjectState.project = {
            ...ProjectState.project,
            ...data.project
          };
          updateProjectDetails();
        }
      } catch (error) {
        console.error('Error processing project status WebSocket message:', error);
      }
    };
    
    // Generation progress WebSocket
    ProjectState.websockets.generationProgress = ApiService.createWebSocketConnection('generation_progress');
    
    ProjectState.websockets.generationProgress.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Update generation progress
        if (data.project_id === ProjectState.project.id) {
          updateGenerationProgress(data);
        }
      } catch (error) {
        console.error('Error processing generation progress WebSocket message:', error);
      }
    };
    
    // Test results WebSocket
    ProjectState.websockets.testResults = ApiService.createWebSocketConnection('test_results');
    
    ProjectState.websockets.testResults.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Update test results
        if (data.generation_id && ProjectState.testResults[data.generation_id]) {
          ProjectState.testResults[data.generation_id] = data;
          updateTestResultsUI(data.generation_id);
        }
      } catch (error) {
        console.error('Error processing test results WebSocket message:', error);
      }
    };
    
    // Set up reconnection logic for all WebSockets
    for (const key in ProjectState.websockets) {
      if (ProjectState.websockets[key]) {
        ProjectState.websockets[key].onclose = () => {
          // Try to reconnect after 5 seconds
          setTimeout(() => {
            setupWebSocketConnections(projectId);
          }, 5000);
        };
      }
    }
  } catch (error) {
    console.error('Failed to setup WebSocket connections:', error);
  }
}

/**
 * Update project details in the UI
 */
function updateProjectDetails() {
  const project = ProjectState.project;
  if (!project) return;
  
  // Update project name
  const projectNameElements = document.querySelectorAll('.project-name');
  projectNameElements.forEach(element => {
    element.textContent = project.name;
  });
  
  // Update project description
  const projectDescElement = document.getElementById('project-description');
  if (projectDescElement) {
    projectDescElement.textContent = project.description || 'No description provided.';
  }
  
  // Update project status
  const projectStatusElement = document.getElementById('project-status');
  if (projectStatusElement) {
    projectStatusElement.textContent = project.status;
    projectStatusElement.className = `text-xs px-2 py-1 rounded-full ${
      project.status === 'ACTIVE' 
        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }`;
  }
  
  // Update project metadata
  const createdAtElement = document.getElementById('project-created-at');
  if (createdAtElement) {
    createdAtElement.textContent = formatDate(project.created_at);
  }
  
  const updatedAtElement = document.getElementById('project-updated-at');
  if (updatedAtElement) {
    updatedAtElement.textContent = formatDate(project.updated_at);
  }
  
  // Update project stats
  const generationsCountElement = document.getElementById('generations-count');
  if (generationsCountElement) {
    generationsCountElement.textContent = project.code_generations_count || 0;
  }
}

/**
 * Render code generations in the UI
 */
function renderCodeGenerations() {
  const generationsContainer = document.getElementById('generations-container');
  if (!generationsContainer) return;
  
  // Apply filters
  let generations = [...ProjectState.codeGenerations];
  
  // Apply search filter
  if (ProjectState.filters.search) {
    const searchTerm = ProjectState.filters.search.toLowerCase();
    generations = generations.filter(gen => 
      gen.prompt.toLowerCase().includes(searchTerm) || 
      gen.code.toLowerCase().includes(searchTerm)
    );
  }
  
  // Apply model filter
  if (ProjectState.filters.model && ProjectState.filters.model !== 'all') {
    generations = generations.filter(gen => 
      gen.model === ProjectState.filters.model
    );
  }
  
  // Apply sort
  if (ProjectState.filters.sort === 'newest') {
    generations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (ProjectState.filters.sort === 'oldest') {
    generations.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (ProjectState.filters.sort === 'fastest') {
    generations.sort((a, b) => (a.generation_time || 0) - (b.generation_time || 0));
  } else if (ProjectState.filters.sort === 'slowest') {
    generations.sort((a, b) => (b.generation_time || 0) - (a.generation_time || 0));
  }
  
  // Update pagination state
  ProjectState.pagination.total = generations.length;
  
  // Apply pagination
  const start = (ProjectState.pagination.current - 1) * ProjectState.pagination.limit;
  const end = start + ProjectState.pagination.limit;
  const paginatedGenerations = generations.slice(start, end);
  
  // Clear container
  generationsContainer.innerHTML = '';
  
  // Show message if no generations
  if (paginatedGenerations.length === 0) {
    generationsContainer.innerHTML = `
      <div class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No code generations</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Start by generating some code.</p>
        <div class="mt-6">
          <button type="button" onclick="activateTab('code-generation')" class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
            <svg class="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>
            Generate Code
          </button>
        </div>
      </div>
    `;
    return;
  }
  
  // Render generations
  paginatedGenerations.forEach(gen => {
    const generationElement = document.createElement('div');
    generationElement.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4';
    
    // Get test results
    const testResults = ProjectState.testResults[gen.generation_id] || null;
    
    generationElement.innerHTML = `
      <div class="flex justify-between items-start mb-4">
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">${escapeHtml(gen.language)} Code Generation</h3>
        <span class="text-xs px-2 py-1 rounded-full ${
          gen.success 
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }">${gen.success ? 'Success' : 'Failed'}</span>
      </div>
      
      <div class="mb-3">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Prompt:</h4>
        <p class="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 p-3 rounded">${escapeHtml(gen.prompt)}</p>
      </div>
      
      <div class="mb-3">
        <div class="flex justify-between items-center mb-2">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Generated Code:</h4>
          <button class="copy-code-btn text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300" data-generation-id="${gen.generation_id}">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-8m-10 0v-2a2 2 0 012-2h6a2 2 0 012 2v2m-2 4h.01"></path>
            </svg>
          </button>
        </div>
        <div class="code-block bg-gray-800 rounded overflow-hidden">
          <pre><code class="language-${gen.language}">${escapeHtml(gen.code)}</code></pre>
        </div>
      </div>
      
      <div class="mb-3">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Validation:</h4>
        <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded">
          <div class="flex items-center">
            <span class="mr-2 ${gen.validation_result.is_valid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                ${gen.validation_result.is_valid 
                  ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>'
                  : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>'
                }
              </svg>
            </span>
            <span class="text-sm ${gen.validation_result.is_valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}">
              ${gen.validation_result.is_valid ? 'Valid code' : 'Invalid code'}
            </span>
          </div>
          
          ${gen.validation_result.errors.length > 0 ? `
            <div class="mt-2">
              <p class="text-xs font-medium text-gray-700 dark:text-gray-300">Errors:</p>
              <ul class="list-disc list-inside text-xs text-red-600 dark:text-red-400">
                ${gen.validation_result.errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${gen.validation_result.warnings.length > 0 ? `
            <div class="mt-2">
              <p class="text-xs font-medium text-gray-700 dark:text-gray-300">Warnings:</p>
              <ul class="list-disc list-inside text-xs text-amber-600 dark:text-amber-400">
                ${gen.validation_result.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          
          ${gen.validation_result.suggestions.length > 0 ? `
            <div class="mt-2">
              <p class="text-xs font-medium text-gray-700 dark:text-gray-300">Suggestions:</p>
              <ul class="list-disc list-inside text-xs text-blue-600 dark:text-blue-400">
                ${gen.validation_result.suggestions.map(suggestion => `<li>${escapeHtml(suggestion)}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="mb-3">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Test Results:</h4>
        <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded test-results" id="test-results-${gen.generation_id}">
          ${renderTestResults(testResults)}
        </div>
      </div>
      
      <div class="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
        <div>
          <span class="mr-4">Model: ${gen.model || 'Default'}</span>
          <span>Time: ${gen.generation_time ? `${gen.generation_time.toFixed(2)}s` : 'Unknown'}</span>
        </div>
        <div>
          <button 
            class="run-tests-btn text-sm px-3 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded-md"
            data-generation-id="${gen.generation_id}"
          >
            Run Tests
          </button>
        </div>
      </div>
    `;
    
    generationsContainer.appendChild(generationElement);
    
    // Initialize syntax highlighting if Prism or Highlight.js is available
    if (typeof Prism !== 'undefined') {
      Prism.highlightAllUnder(generationElement);
    } else if (typeof hljs !== 'undefined') {
      generationElement.querySelectorAll('pre code').forEach(block => {
        hljs.highlightBlock(block);
      });
    }
  });
}

/**
 * Render test results
 */
function renderTestResults(results) {
  if (!results) {
    return `
      <div class="flex items-center justify-center p-4">
        <span class="text-sm text-gray-600 dark:text-gray-400">No test results available. Click "Run Tests" to execute tests.</span>
      </div>
    `;
  }
  
  if (results.status === 'pending') {
    return `
      <div class="flex items-center justify-center p-4">
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-600 dark:text-primary-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm text-gray-600 dark:text-gray-400">Running tests...</span>
      </div>
    `;
  }
  
  if (results.status === 'error') {
    return `
      <div class="flex items-center p-4">
        <span class="mr-2 text-red-600 dark:text-red-400">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        </span>
        <span class="text-sm text-red-600 dark:text-red-400">${escapeHtml(results.message || 'An error occurred running tests')}</span>
      </div>
    `;
  }
  
  // Calculate summary
  const totalTests = results.tests ? results.tests.length : 0;
  const passedTests = results.tests ? results.tests.filter(test => test.status === 'pass').length : 0;
  const failedTests = results.tests ? results.tests.filter(test => test.status === 'fail').length : 0;
  
  return `
    <div>
      <div class="flex items-center justify-between mb-3">
        <div class="text-sm">
          <span class="font-medium">Total: ${totalTests}</span>
          <span class="ml-3 text-green-600 dark:text-green-400">Passed: ${passedTests}</span>
          <span class="ml-3 text-red-600 dark:text-red-400">Failed: ${failedTests}</span>
        </div>
        <div>
          <span class="text-xs px-2 py-1 rounded-full ${
            passedTests === totalTests
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }">
            ${passedTests === totalTests ? 'All Passed' : `${passedTests}/${totalTests} Passed`}
          </span>
        </div>
      </div>
      
      ${results.tests && results.tests.length > 0 ? `
        <div class="space-y-2 max-h-64 overflow-y-auto">
          ${results.tests.map(test => `
            <div class="p-2 rounded ${
              test.status === 'pass'
                ? 'bg-green-50 dark:bg-green-900 bg-opacity-50'
                : 'bg-red-50 dark:bg-red-900 bg-opacity-50'
            }">
              <div class="flex items-center">
                <span class="mr-2 ${test.status === 'pass' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    ${test.status === 'pass'
                      ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>'
                      : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>'
                    }
                  </svg>
                </span>
                <span class="text-xs font-medium">${escapeHtml(test.name)}</span>
              </div>
              ${test.error ? `
                <div class="mt-1 text-xs text-red-600 dark:text-red-400 pl-6 whitespace-pre-wrap">${escapeHtml(test.error)}</div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="text-center text-sm text-gray-600 dark:text-gray-400">
          No tests were executed
        </div>
      `}
      
      <div class="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Executed in ${results.execution_time ? `${results.execution_time.toFixed(2)}s` : 'unknown'} at ${formatDate(results.timestamp)}
      </div>
    </div>
  `;
}

/**
 * Update test results UI for a specific generation
 */
function updateTestResultsUI(generationId) {
  const testResultsElement = document.getElementById(`test-results-${generationId}`);
  if (!testResultsElement) return;
  
  const results = ProjectState.testResults[generationId];
  testResultsElement.innerHTML = renderTestResults(results);
}

/**
 * Update pagination UI
 */
function updatePagination() {
  const paginationContainer = document.getElementById('pagination-container');
  if (!paginationContainer) return;
  
  const totalPages = Math.ceil(ProjectState.pagination.total / ProjectState.pagination.limit) || 1;
  
  // Simple pagination UI
  paginationContainer.innerHTML = `
    <div class="flex items-center justify-between">
      <button 
        class="px-3 py-1 rounded-md ${ProjectState.pagination.current === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800' : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}"
        ${ProjectState.pagination.current === 1 ? 'disabled' : 'onclick="changePage(' + (ProjectState.pagination.current - 1) + ')"'}
      >
        Previous
      </button>
      
      <span class="text-sm text-gray-700 dark:text-gray-300">
        Page ${ProjectState.pagination.current} of ${totalPages}
      </span>
      
      <button 
        class="px-3 py-1 rounded-md ${ProjectState.pagination.current === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800' : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}"
        ${ProjectState.pagination.current === totalPages ? 'disabled' : 'onclick="changePage(' + (ProjectState.pagination.current + 1) + ')"'}
      >
        Next
      </button>
    </div>
  `;
}

/**
 * Update models dropdown
 */
function updateModelsDropdown() {
  const modelSelect = document.getElementById('model-select');
  if (!modelSelect || !ProjectState.availableModels.length) return;
  
  // Clear options
  modelSelect.innerHTML = '';
  
  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Default';
  modelSelect.appendChild(defaultOption);
  
  // Add available models
  ProjectState.availableModels.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    modelSelect.appendChild(option);
  });
}

/**
 * Update generation progress UI
 */
function updateGenerationProgress(data) {
  // Update progress bar
  const progressBar = document.getElementById('generation-progress-bar');
  const progressText = document.getElementById('generation-progress-text');
  
  if (progressBar && progressText) {
    const percent = Math.round(data.progress * 100);
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${percent}%`;
    
    // Show progress container
    const progressContainer = document.getElementById('generation-progress-container');
    if (progressContainer) {
      progressContainer.classList.remove('hidden');
    }
    
    // Hide when complete
    if (data.progress >= 1) {
      setTimeout(() => {
        if (progressContainer) {
          progressContainer.classList.add('hidden');
        }
        
        // Reload generations if generation is complete
        if (data.status === 'complete') {
          loadCodeGenerations(ProjectState.project.id);
        }
      }, 1500);
    }
  }
}

/**
 * Activate a tab
 */
function activateTab(tabId) {
  // Hide all tabs
  document.querySelectorAll('[data-tab-content]').forEach(tab => {
    tab.classList.add('hidden');
  });
  
  // Deactivate all tab buttons
  document.querySelectorAll('[data-tab-target]').forEach(button => {
    button.classList.remove('bg-primary-100', 'text-primary-700', 'dark:bg-primary-900', 'dark:text-primary-300');
    button.classList.add('text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400', 'dark:hover:text-gray-300');
  });
  
  // Show selected tab
  const tabContent = document.querySelector(`[data-tab-content="${tabId}"]`);
  if (tabContent) {
    tabContent.classList.remove('hidden');
  }
  
  // Activate selected tab button
  const tabButton = document.querySelector(`[data-tab-target="${tabId}"]`);
  if (tabButton) {
    tabButton.classList.remove('text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400', 'dark:hover:text-gray-300');
    tabButton.classList.add('bg-primary-100', 'text-primary-700', 'dark:bg-primary-900', 'dark:text-primary-300');
  }
}

/**
 * Change pagination page
 */
function changePage(page) {
  ProjectState.pagination.current = page;
  renderCodeGenerations();
  updatePagination();
}

/**
 * Generate code
 */
async function generateCode() {
  try {
    // Get form values
    const promptInput = document.getElementById('prompt-input');
    const languageSelect = document.getElementById('language-selector');
    const modelSelect = document.getElementById('model-select');
    
    if (!promptInput || !promptInput.value.trim()) {
      showErrorNotification('Prompt is required');
      return;
    }
    
    if (!languageSelect || !languageSelect.value) {
      showErrorNotification('Language is required');
      return;
    }
    
    const codeRequest = {
      prompt: promptInput.value.trim(),
      language: languageSelect.value,
      project_id: ProjectState.project.id
    };
    
    if (modelSelect && modelSelect.value) {
      codeRequest.model = modelSelect.value;
    }
    
    // Show loading
    showLoading();
    
    // Update editor with prompt
    ProjectState.editor.content = `// Generating code for prompt: ${codeRequest.prompt}`;
    updateEditorContent();
    
    // Generate code
    const result = await ApiService.generateCode(codeRequest);
    
    // Update editor with generated code
    ProjectState.editor.content = result.code;
    updateEditorContent();
    
    // Show success message
    showSuccessNotification('Code generated successfully');
    
    // Reload generations
    await loadCodeGenerations(ProjectState.project.id);
    
    // Switch to generations tab
    activateTab('generations');
    
    hideLoading();
  } catch (error) {
    console.error('Failed to generate code:', error);
    showErrorNotification(error.message || 'Failed to generate code');
    hideLoading();
  }
}

/**
 * Update editor content
 */
function updateEditorContent() {
  if (typeof monaco !== 'undefined' && monaco.editor) {
    const editor = monaco.editor.getEditors()[0];
    if (editor) {
      editor.setValue(ProjectState.editor.content);
    }
  } else {
    // Fallback for basic textarea
    const textarea = document.querySelector('#code-editor textarea');
    if (textarea) {
      textarea.value = ProjectState.editor.content;
    }
  }
}

/**
 * Run tests for a code generation
 */
async function runTests(generationId) {
  try {
    // Show loading state
    const testResultsElement = document.getElementById(`test-results-${generationId}`);
    if (testResultsElement) {
      testResultsElement.innerHTML = renderTestResults({
        status: 'pending'
      });
    }
    
    // Update state
    ProjectState.testResults[generationId] = {
      status: 'pending'
    };
    
    // Run tests
    const testRequest = {
      generation_id: generationId
    };
    
    const result = await ApiService.runTests(testRequest);
    
    // Update state
    ProjectState.testResults[generationId] = result;
    
    // Update UI
    updateTestResultsUI(generationId);
  } catch (error) {
    console.error(`Failed to run tests for generation ${generationId}:`, error);
    
    // Update state with error
    ProjectState.testResults[generationId] = {
      status: 'error',
      message: error.message || 'Failed to run tests'
    };
    
    // Update UI
    updateTestResultsUI(generationId);
  }
}

/**
 * Get project ID from URL
 */
function getProjectIdFromUrl() {
  // Get project ID from URL (e.g., /project/123)
  const pathParts = window.location.pathname.split('/');
  const projectIndex = pathParts.indexOf('project');
  
  if (projectIndex !== -1 && pathParts.length > projectIndex + 1) {
    return pathParts[projectIndex + 1];
  }
  
  return null;
}

/**
 * Show loading state
 */
function showLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
  }
}

/**
 * Hide loading state
 */
function hideLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
  }
}

/**
 * Update loading state indicators
 */
function updateLoadingState() {
  const projectLoadingIndicator = document.getElementById('project-loading');
  if (projectLoadingIndicator) {
    projectLoadingIndicator.classList.toggle('hidden', !ProjectState.loading.project);
  }
  
  const generationsLoadingIndicator = document.getElementById('generations-loading');
  if (generationsLoadingIndicator) {
    generationsLoadingIndicator.classList.toggle('hidden', !ProjectState.loading.generations);
  }
}

/**
 * Show success notification
 */
function showSuccessNotification(message) {
  UiUtils.showNotification(message, 'success');
}

/**
 * Show error notification
 */
function showErrorNotification(message) {
  UiUtils.showNotification(message, 'error');
}

/**
 * Format date to readable string
 */
function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Copy text to clipboard
 */
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(err => {
    console.error('Failed to copy text: ', err);
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialize project page when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  initializeProjectPage();
});
