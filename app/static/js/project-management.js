/**
 * Aoede Platform
 * Project Management JavaScript File
 * 
 * @author Pradyumn Tandon (Gamecooler19)
 * @organization Kanopus
 * @website https://aoede.kanopus.org
 * @version 1.0.0
 * @license MIT
 */

// Project management state
const ProjectState = {
  currentProject: null,
  generatedFiles: [],
  testResults: [],
  isLoading: false,
  error: null,
  websocket: null
};

/**
 * Initialize the project view
 */
async function initializeProjectView() {
  try {
    // Get project ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');
    
    if (!projectId) {
      showNotification('No project ID specified', 'error');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
      return;
    }
    
    // Show loading state
    showProjectLoading(true);
    
    // Fetch project details
    const project = await ApiService.getProjectDetails(projectId);
    ProjectState.currentProject = project;
    
    // Update UI with project details
    updateProjectUI(project);
    
    // Initialize websocket connection for real-time updates
    initProjectWebsocket(projectId);
    
    // Setup event listeners
    setupProjectEventListeners();
    
    // Hide loading state
    showProjectLoading(false);
  } catch (error) {
    console.error('Error initializing project view:', error);
    showNotification('Failed to load project details: ' + (error.message || 'Unknown error'), 'error');
    showProjectLoading(false);
  }
}

/**
 * Update the project UI with the project details
 * @param {Object} project - The project details
 */
function updateProjectUI(project) {
  // Update project header
  document.getElementById('project-name').textContent = project.name;
  document.getElementById('project-description').textContent = project.description || 'No description available';
  document.getElementById('project-status').textContent = formatProjectStatus(project.status);
  document.getElementById('project-status').className = getProjectStatusClass(project.status);
  document.getElementById('project-created').textContent = formatDate(project.created_at);
  
  // Update project stats
  document.getElementById('generations-count').textContent = project.code_generations_count || 0;
  
  // Update code generations list
  updateCodeGenerationsList(project.code_generations || []);
  
  // Update breadcrumb
  document.getElementById('breadcrumb-project-name').textContent = project.name;
  
  // Update page title
  document.title = `${project.name} - Aoede Enterprise AI`;
}

/**
 * Update the code generations list
 * @param {Array} generations - List of code generations
 */
function updateCodeGenerationsList(generations) {
  const generationsList = document.getElementById('generations-list');
  generationsList.innerHTML = '';
  
  if (generations.length === 0) {
    generationsList.innerHTML = `
      <div class="text-center py-8">
        <svg class="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
        </svg>
        <p class="mt-2 text-gray-500 dark:text-gray-400">No code generations yet</p>
        <button id="start-generation-btn" class="mt-4 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
          Start New Generation
        </button>
      </div>
    `;
    return;
  }
  
  generations.forEach(gen => {
    const generationItem = document.createElement('div');
    generationItem.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-4 hover:shadow-lg transition-all';
    generationItem.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">${gen.prompt.substring(0, 50)}${gen.prompt.length > 50 ? '...' : ''}</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Generated ${formatDate(gen.created_at)}</p>
        </div>
        <span class="px-2 py-1 text-xs font-semibold rounded-full ${getGenerationStatusClass(gen.status)}">
          ${formatGenerationStatus(gen.status)}
        </span>
      </div>
      
      <div class="mt-4 grid grid-cols-3 gap-4">
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">Files</p>
          <p class="text-lg font-semibold text-gray-900 dark:text-white">${gen.files_count || 0}</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">Execution Time</p>
          <p class="text-lg font-semibold text-gray-900 dark:text-white">${formatExecutionTime(gen.execution_time)}</p>
        </div>
        <div class="text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">Test Results</p>
          <p class="text-lg font-semibold text-gray-900 dark:text-white">
            ${gen.test_results ? `${gen.test_results.passed || 0}/${gen.test_results.total || 0}` : 'N/A'}
          </p>
        </div>
      </div>
      
      <div class="mt-4 flex space-x-2">
        <button class="view-generation-btn px-3 py-1 bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800" data-id="${gen.id}">
          View Details
        </button>
        <button class="test-generation-btn px-3 py-1 bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800" data-id="${gen.id}">
          Run Tests
        </button>
        <button class="download-generation-btn px-3 py-1 bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800" data-id="${gen.id}">
          Download Files
        </button>
      </div>
    `;
    
    generationsList.appendChild(generationItem);
  });
  
  // Add event listeners for generation buttons
  document.querySelectorAll('.view-generation-btn').forEach(btn => {
    btn.addEventListener('click', () => viewGenerationDetails(btn.dataset.id));
  });
  
  document.querySelectorAll('.test-generation-btn').forEach(btn => {
    btn.addEventListener('click', () => runGenerationTests(btn.dataset.id));
  });
  
  document.querySelectorAll('.download-generation-btn').forEach(btn => {
    btn.addEventListener('click', () => downloadGenerationFiles(btn.dataset.id));
  });
}

/**
 * Setup project event listeners
 */
function setupProjectEventListeners() {
  // New generation button
  const newGenBtn = document.getElementById('new-generation-btn');
  if (newGenBtn) {
    newGenBtn.addEventListener('click', showNewGenerationModal);
  }
  
  // Start generation button (for empty state)
  const startGenBtn = document.getElementById('start-generation-btn');
  if (startGenBtn) {
    startGenBtn.addEventListener('click', showNewGenerationModal);
  }
  
  // New generation form
  const newGenForm = document.getElementById('new-generation-form');
  if (newGenForm) {
    newGenForm.addEventListener('submit', handleNewGeneration);
  }
  
  // Delete project button
  const deleteProjectBtn = document.getElementById('delete-project-btn');
  if (deleteProjectBtn) {
    deleteProjectBtn.addEventListener('click', confirmDeleteProject);
  }
  
  // Edit project button
  const editProjectBtn = document.getElementById('edit-project-btn');
  if (editProjectBtn) {
    editProjectBtn.addEventListener('click', showEditProjectModal);
  }
}

/**
 * Initialize websocket connection for real-time updates
 * @param {string} projectId - The project ID
 */
function initProjectWebsocket(projectId) {
  try {
    // Close existing connection if any
    if (ProjectState.websocket) {
      ProjectState.websocket.close();
    }
    
    // Create new websocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws/project/${projectId}`;
    
    ProjectState.websocket = new WebSocket(wsUrl);
    
    ProjectState.websocket.onopen = () => {
    };
    
    ProjectState.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error handling websocket message:', error);
      }
    };
    
    ProjectState.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ProjectState.websocket.onclose = () => {
      // Try to reconnect after delay
      setTimeout(() => {
        if (document.visibilityState !== 'hidden') {
          initProjectWebsocket(projectId);
        }
      }, 5000);
    };
  } catch (error) {
    console.error('Error initializing project websocket:', error);
  }
}

/**
 * Handle websocket message
 * @param {Object} data - The websocket message data
 */
function handleWebSocketMessage(data) {
  
  switch(data.type) {
    case 'generation_started':
      showNotification('Code generation started', 'info');
      break;
      
    case 'generation_completed':
      showNotification('Code generation completed', 'success');
      refreshProjectData();
      break;
      
    case 'generation_failed':
      showNotification(`Code generation failed: ${data.error || 'Unknown error'}`, 'error');
      refreshProjectData();
      break;
      
    case 'test_started':
      showNotification('Tests started running', 'info');
      break;
      
    case 'test_completed':
      showNotification(`Tests completed: ${data.passed || 0}/${data.total || 0} passed`, 'success');
      refreshProjectData();
      break;
      
    case 'test_failed':
      showNotification(`Tests failed: ${data.error || 'Unknown error'}`, 'error');
      refreshProjectData();
      break;
      
    case 'project_updated':
      showNotification('Project details updated', 'success');
      refreshProjectData();
      break;
  }
}

/**
 * Refresh project data from the API
 */
async function refreshProjectData() {
  try {
    if (!ProjectState.currentProject || !ProjectState.currentProject.id) {
      return;
    }
    
    const projectId = ProjectState.currentProject.id;
    const project = await ApiService.getProjectDetails(projectId);
    ProjectState.currentProject = project;
    
    // Update UI with project details
    updateProjectUI(project);
  } catch (error) {
    console.error('Error refreshing project data:', error);
  }
}

/**
 * Show the new generation modal
 */
function showNewGenerationModal() {
  // Implementation depends on your modal system
  const modal = document.getElementById('new-generation-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

/**
 * Handle new generation form submission
 * @param {Event} event - The form submission event
 */
async function handleNewGeneration(event) {
  event.preventDefault();
  
  try {
    showProjectLoading(true);
    
    const prompt = document.getElementById('generation-prompt').value;
    const language = document.getElementById('generation-language').value;
    const options = {
      includeTests: document.getElementById('generation-include-tests').checked,
      includeDocumentation: document.getElementById('generation-include-docs').checked,
      complexity: document.getElementById('generation-complexity').value
    };
    
    // Create the generation
    await ApiService.createCodeGeneration(ProjectState.currentProject.id, {
      prompt,
      language,
      options
    });
    
    // Close the modal
    const modal = document.getElementById('new-generation-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    
    showNotification('Code generation started. This may take a few moments...', 'info');
    
    // Reset the form
    document.getElementById('new-generation-form').reset();
    
    // No need to refresh immediately as websocket will notify when complete
  } catch (error) {
    console.error('Error starting new generation:', error);
    showNotification('Failed to start code generation: ' + (error.message || 'Unknown error'), 'error');
  } finally {
    showProjectLoading(false);
  }
}

/**
 * Show/hide the project loading state
 * @param {boolean} isLoading - Whether loading is in progress
 */
function showProjectLoading(isLoading) {
  ProjectState.isLoading = isLoading;
  const loadingIndicator = document.getElementById('project-loading');
  
  if (loadingIndicator) {
    if (isLoading) {
      loadingIndicator.classList.remove('hidden');
    } else {
      loadingIndicator.classList.add('hidden');
    }
  }
}

/**
 * View generation details
 * @param {string} generationId - The generation ID
 */
async function viewGenerationDetails(generationId) {
  try {
    showProjectLoading(true);
    
    // Fetch generation details
    const generation = await ApiService.getGenerationDetails(generationId);
    
    // Show in modal or navigate to details page
    // Implementation depends on your UI approach
    const detailsContent = document.getElementById('generation-details-content');
    if (detailsContent) {
      detailsContent.innerHTML = renderGenerationDetails(generation);
      
      // Show the modal
      const modal = document.getElementById('generation-details-modal');
      if (modal) {
        modal.classList.remove('hidden');
      }
    } else {
      // Alternative: Navigate to dedicated page
      window.location.href = `/generation?id=${generationId}`;
    }
  } catch (error) {
    console.error('Error viewing generation details:', error);
    showNotification('Failed to load generation details: ' + (error.message || 'Unknown error'), 'error');
  } finally {
    showProjectLoading(false);
  }
}

/**
 * Run tests for a generation
 * @param {string} generationId - The generation ID
 */
async function runGenerationTests(generationId) {
  try {
    showProjectLoading(true);
    
    await ApiService.runGenerationTests(generationId);
    showNotification('Tests started. Results will appear shortly...', 'info');
    
    // Results will be updated via websocket
  } catch (error) {
    console.error('Error running tests:', error);
    showNotification('Failed to start tests: ' + (error.message || 'Unknown error'), 'error');
  } finally {
    showProjectLoading(false);
  }
}

/**
 * Download files from a generation
 * @param {string} generationId - The generation ID
 */
async function downloadGenerationFiles(generationId) {
  try {
    // Redirect to download endpoint
    window.location.href = `${API_ENDPOINT}/generations/${generationId}/download`;
  } catch (error) {
    console.error('Error downloading files:', error);
    showNotification('Failed to download files: ' + (error.message || 'Unknown error'), 'error');
  }
}

/**
 * Render generation details HTML
 * @param {Object} generation - The generation object
 * @returns {string} HTML for the generation details
 */
function renderGenerationDetails(generation) {
  return `
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Prompt</h3>
        <div class="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
          <p class="text-gray-700 dark:text-gray-300 whitespace-pre-line">${generation.prompt}</p>
        </div>
      </div>
      
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Status</h3>
        <div class="mt-1">
          <span class="px-2 py-1 text-xs font-semibold rounded-full ${getGenerationStatusClass(generation.status)}">
            ${formatGenerationStatus(generation.status)}
          </span>
        </div>
      </div>
      
      <div>
        <h3 class="text-lg font-medium text-gray-900 dark:text-white">Details</h3>
        <div class="mt-1 grid grid-cols-2 gap-4">
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Language</p>
            <p class="font-medium text-gray-900 dark:text-white">${generation.language}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Created</p>
            <p class="font-medium text-gray-900 dark:text-white">${formatDate(generation.created_at)}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Execution Time</p>
            <p class="font-medium text-gray-900 dark:text-white">${formatExecutionTime(generation.execution_time)}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500 dark:text-gray-400">Files Generated</p>
            <p class="font-medium text-gray-900 dark:text-white">${generation.files_count || 0}</p>
          </div>
        </div>
      </div>
      
      ${generation.files && generation.files.length > 0 ? `
        <div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Generated Files</h3>
          <div class="mt-1 space-y-2">
            ${generation.files.map(file => `
              <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                <div class="flex justify-between items-center">
                  <p class="font-mono text-sm text-gray-700 dark:text-gray-300">${file.filename}</p>
                  <button class="view-file-btn px-2 py-1 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800" data-id="${file.id}">
                    View
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      ${generation.test_results ? `
        <div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Test Results</h3>
          <div class="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <div class="flex items-center space-x-2">
              <div class="w-16 h-16 rounded-full bg-${generation.test_results.passed === generation.test_results.total ? 'green' : 'yellow'}-100 dark:bg-${generation.test_results.passed === generation.test_results.total ? 'green' : 'yellow'}-900 flex items-center justify-center">
                <span class="text-${generation.test_results.passed === generation.test_results.total ? 'green' : 'yellow'}-600 dark:text-${generation.test_results.passed === generation.test_results.total ? 'green' : 'yellow'}-300 font-semibold text-lg">
                  ${Math.round((generation.test_results.passed / generation.test_results.total) * 100)}%
                </span>
              </div>
              <div>
                <p class="font-medium text-gray-900 dark:text-white">
                  ${generation.test_results.passed} / ${generation.test_results.total} tests passed
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Last run: ${formatDate(generation.test_results.timestamp)}
                </p>
              </div>
            </div>
            
            ${generation.test_results.details ? `
              <div class="mt-3 space-y-2">
                ${generation.test_results.details.map(test => `
                  <div class="p-2 rounded-md ${test.passed ? 'bg-green-50 dark:bg-green-900/30' : 'bg-red-50 dark:bg-red-900/30'}">
                    <div class="flex items-center">
                      <span class="${test.passed ? 'text-green-500 dark:text-green-300' : 'text-red-500 dark:text-red-300'} mr-2">
                        ${test.passed ? '✓' : '✗'}
                      </span>
                      <span class="text-gray-700 dark:text-gray-300">${test.name}</span>
                    </div>
                    ${!test.passed && test.message ? `
                      <p class="mt-1 text-xs text-red-600 dark:text-red-400 font-mono pl-6">${test.message}</p>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Confirm delete project
 */
function confirmDeleteProject() {
  if (!ProjectState.currentProject) return;
  
  const confirmed = window.confirm(`Are you sure you want to delete project "${ProjectState.currentProject.name}"? This action cannot be undone.`);
  
  if (confirmed) {
    deleteProject();
  }
}

/**
 * Delete the current project
 */
async function deleteProject() {
  try {
    showProjectLoading(true);
    
    await ApiService.deleteProject(ProjectState.currentProject.id);
    
    showNotification('Project deleted successfully', 'success');
    
    // Redirect to dashboard
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1000);
  } catch (error) {
    console.error('Error deleting project:', error);
    showNotification('Failed to delete project: ' + (error.message || 'Unknown error'), 'error');
    showProjectLoading(false);
  }
}

/**
 * Show edit project modal
 */
function showEditProjectModal() {
  if (!ProjectState.currentProject) return;
  
  // Set current values in form
  document.getElementById('edit-project-name').value = ProjectState.currentProject.name;
  document.getElementById('edit-project-description').value = ProjectState.currentProject.description || '';
  
  // Show modal
  const modal = document.getElementById('edit-project-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

/**
 * Handle edit project form submission
 * @param {Event} event - The form submission event
 */
async function handleEditProject(event) {
  event.preventDefault();
  
  try {
    showProjectLoading(true);
    
    const name = document.getElementById('edit-project-name').value;
    const description = document.getElementById('edit-project-description').value;
    
    // Update the project
    await ApiService.updateProject(ProjectState.currentProject.id, {
      name,
      description
    });
    
    // Close the modal
    const modal = document.getElementById('edit-project-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    
    showNotification('Project updated successfully', 'success');
    
    // Refresh project data
    refreshProjectData();
  } catch (error) {
    console.error('Error updating project:', error);
    showNotification('Failed to update project: ' + (error.message || 'Unknown error'), 'error');
  } finally {
    showProjectLoading(false);
  }
}

/**
 * Format project status
 * @param {string} status - The project status
 * @returns {string} Formatted status text
 */
function formatProjectStatus(status) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'archived':
      return 'Archived';
    case 'completed':
      return 'Completed';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Get CSS class for project status
 * @param {string} status - The project status
 * @returns {string} CSS class
 */
function getProjectStatusClass(status) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded-full text-xs font-medium';
    case 'archived':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-medium';
    case 'completed':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded-full text-xs font-medium';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-medium';
  }
}

/**
 * Format generation status
 * @param {string} status - The generation status
 * @returns {string} Formatted status text
 */
function formatGenerationStatus(status) {
  switch (status) {
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'queued':
      return 'Queued';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  }
}

/**
 * Get CSS class for generation status
 * @param {string} status - The generation status
 * @returns {string} CSS class
 */
function getGenerationStatusClass(status) {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'failed':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'queued':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
}

/**
 * Format execution time
 * @param {number} time - Execution time in seconds
 * @returns {string} Formatted execution time
 */
function formatExecutionTime(time) {
  if (!time) return 'N/A';
  
  if (time < 1) {
    return `${Math.round(time * 1000)}ms`;
  } else if (time < 60) {
    return `${time.toFixed(1)}s`;
  } else {
    const minutes = Math.floor(time / 60);
    const seconds = Math.round(time % 60);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Format date
 * @param {string} dateStr - The date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  
  const date = new Date(dateStr);
  return date.toLocaleString();
}

// Initialize event handler for edit project form
document.addEventListener('DOMContentLoaded', function() {
  const editProjectForm = document.getElementById('edit-project-form');
  if (editProjectForm) {
    editProjectForm.addEventListener('submit', handleEditProject);
  }
});
