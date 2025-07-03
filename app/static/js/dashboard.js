/**
 * Aoede Platform
 * Dashboard JavaScript File
 * 
 * @author Pradyumn Tandon (Gamecooler19)
 * @organization Kanopus
 * @website https://aoede.kanopus.org
 * @version 1.0.0
 * @license MIT
 */

// Dashboard state management
const DashboardState = {
  activeProjects: [],
  archivedProjects: [],
  currentProject: null,
  stats: {
    totalProjects: 0,
    totalGeneratedFiles: 0,
    averageExecutionTime: 0,
    successRate: 0
  },
  filters: {
    status: null,
    search: '',
    sort: 'newest'
  },
  pagination: {
    current: 1,
    limit: 10,
    total: 0
  },
  loading: {
    projects: false,
    stats: false
  },
  error: null
};

/**
 * Initialize the dashboard
 */
async function initializeDashboard() {
  try {
    showLoading();
    
    // Check if user is authenticated
    if (!ApiService.isAuthenticated()) {
      window.location.href = '/login';
      return;
    }
    
    // Get user profile
    const user = await ApiService.getCurrentUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }
    
    // Update UI with user info
    updateUserInfo(user);
    
    // Load dashboard data
    await Promise.all([
      loadProjects(),
      loadDashboardStats()
    ]);
    
    // Initialize dashboard events
    initializeDashboardEvents();
    
    // Setup WebSocket for real-time updates
    setupWebSocketConnections();
    
    hideLoading();
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
    showErrorNotification('Failed to initialize dashboard. Please refresh the page.');
    hideLoading();
  }
}

/**
 * Load projects from API
 */
async function loadProjects() {
  try {
    DashboardState.loading.projects = true;
    updateLoadingState();
    
    // Get active projects
    const activeProjects = await ApiService.getProjects({
      skip: (DashboardState.pagination.current - 1) * DashboardState.pagination.limit,
      limit: DashboardState.pagination.limit,
      status: 'ACTIVE'
    });
    
    // Get archived projects (if needed)
    let archivedProjects = [];
    if (DashboardState.filters.status === 'ARCHIVED' || DashboardState.filters.status === null) {
      archivedProjects = await ApiService.getProjects({
        skip: 0,
        limit: 100,
        status: 'ARCHIVED'
      });
    }
    
    // Update state
    DashboardState.activeProjects = activeProjects;
    DashboardState.archivedProjects = archivedProjects;
    DashboardState.pagination.total = activeProjects.length + archivedProjects.length;
    DashboardState.stats.totalProjects = activeProjects.length + archivedProjects.length;
    
    // Update UI
    renderProjects();
    updatePagination();
    updateProjectStats();
    
    DashboardState.loading.projects = false;
    updateLoadingState();
  } catch (error) {
    console.error('Failed to load projects:', error);
    showErrorNotification('Failed to load projects. Please try again.');
    DashboardState.error = error;
    DashboardState.loading.projects = false;
    updateLoadingState();
  }
}

/**
 * Load dashboard statistics from API
 */
async function loadDashboardStats() {
  try {
    DashboardState.loading.stats = true;
    updateLoadingState();
    
    // Get projects to calculate stats
    const projects = [...DashboardState.activeProjects];
    
    // Collect stats from all projects
    let totalGeneratedFiles = 0;
    let totalExecutionTime = 0;
    let successfulGenerations = 0;
    let totalGenerations = 0;
    
    // For each project, get code generations
    for (const project of projects) {
      try {
        const generations = await ApiService.getCodeGenerations(project.id);
        
        if (generations && generations.length) {
          totalGeneratedFiles += generations.length;
          
          // Calculate execution time and success rate
          generations.forEach(gen => {
            totalExecutionTime += gen.generation_time || 0;
            totalGenerations++;
            if (gen.success) {
              successfulGenerations++;
            }
          });
        }
      } catch (error) {
        console.warn(`Failed to get generations for project ${project.id}:`, error);
      }
    }
    
    // Update state
    DashboardState.stats.totalGeneratedFiles = totalGeneratedFiles;
    DashboardState.stats.averageExecutionTime = totalGenerations > 0 
      ? (totalExecutionTime / totalGenerations).toFixed(2) 
      : 0;
    DashboardState.stats.successRate = totalGenerations > 0 
      ? Math.round((successfulGenerations / totalGenerations) * 100) 
      : 0;
    
    // Update UI
    updateDashboardStats();
    
    DashboardState.loading.stats = false;
    updateLoadingState();
  } catch (error) {
    console.error('Failed to load dashboard stats:', error);
    DashboardState.loading.stats = false;
    updateLoadingState();
  }
}

/**
 * Update user information in the UI
 */
function updateUserInfo(user) {
  if (!user) return;
  
  const userNameElement = document.getElementById('user-name');
  if (userNameElement) {
    userNameElement.textContent = user.full_name || user.username;
  }
  
  const userAvatarElement = document.getElementById('user-avatar');
  if (userAvatarElement) {
    if (user.avatar_url) {
      userAvatarElement.src = user.avatar_url;
    } else {
      // Set default avatar with initials
      const initials = (user.full_name || user.username || 'U')
        .split(' ')
        .map(part => part[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
      
      userAvatarElement.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="%230ea5e9" rx="16" ry="16"/><text x="50%" y="50%" dy=".1em" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
    }
  }
}

/**
 * Render projects in the UI
 */
function renderProjects() {
  const projectsContainer = document.getElementById('projects-container');
  if (!projectsContainer) return;
  
  // Get projects based on filter
  let projects = [];
  
  if (DashboardState.filters.status === 'ACTIVE' || DashboardState.filters.status === null) {
    projects = projects.concat(DashboardState.activeProjects);
  }
  
  if (DashboardState.filters.status === 'ARCHIVED' || DashboardState.filters.status === null) {
    projects = projects.concat(DashboardState.archivedProjects);
  }
  
  // Apply search filter
  if (DashboardState.filters.search) {
    const searchTerm = DashboardState.filters.search.toLowerCase();
    projects = projects.filter(project => 
      project.name.toLowerCase().includes(searchTerm) || 
      (project.description && project.description.toLowerCase().includes(searchTerm))
    );
  }
  
  // Apply sort
  if (DashboardState.filters.sort === 'newest') {
    projects.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } else if (DashboardState.filters.sort === 'oldest') {
    projects.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (DashboardState.filters.sort === 'name') {
    projects.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  // Clear container
  projectsContainer.innerHTML = '';
  
  // Show message if no projects
  if (projects.length === 0) {
    projectsContainer.innerHTML = `
      <div class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No projects</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new project.</p>
        <div class="mt-6">
          <button type="button" onclick="openCreateProjectModal()" class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
            <svg class="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            New Project
          </button>
        </div>
      </div>
    `;
    return;
  }
  
  // Apply pagination
  const start = (DashboardState.pagination.current - 1) * DashboardState.pagination.limit;
  const end = start + DashboardState.pagination.limit;
  const paginatedProjects = projects.slice(start, end);
  
  // Render projects
  paginatedProjects.forEach(project => {
    const projectCard = document.createElement('div');
    projectCard.className = 'project-card bg-white dark:bg-gray-800 rounded-lg shadow p-6 border-t-4 border-primary-500 flex flex-col';
    projectCard.innerHTML = `
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">${escapeHtml(project.name)}</h3>
        <span class="text-xs px-2 py-1 rounded-full ${project.status === 'ACTIVE' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}">${project.status}</span>
      </div>
      
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-grow">${escapeHtml(project.description || 'No description provided.')}</p>
      
      <div class="mt-4 flex items-center justify-between">
        <div class="text-xs text-gray-500 dark:text-gray-400">
          Created: ${formatDate(project.created_at)}
        </div>
        
        <div class="flex space-x-2">
          <button class="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300" onclick="viewProject('${project.id}')">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
            </svg>
          </button>
          
          <button class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300" onclick="editProject('${project.id}')">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
          </button>
          
          ${project.status === 'ACTIVE' ? `
            <button class="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300" onclick="archiveProject('${project.id}')">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path>
              </svg>
            </button>
          ` : `
            <button class="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300" onclick="activateProject('${project.id}')">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
            </button>
          `}
          
          <button class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300" onclick="confirmDeleteProject('${project.id}')">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    
    projectsContainer.appendChild(projectCard);
  });
}

/**
 * Update dashboard statistics
 */
function updateDashboardStats() {
  // Update active projects count
  const activeProjectsCount = document.getElementById('active-projects-count');
  if (activeProjectsCount) {
    activeProjectsCount.textContent = DashboardState.activeProjects.length;
  }
  
  // Update generated files count
  const generatedFilesCount = document.getElementById('generated-files-count');
  if (generatedFilesCount) {
    generatedFilesCount.textContent = DashboardState.stats.totalGeneratedFiles;
  }
  
  // Update execution time
  const executionTime = document.getElementById('execution-time');
  if (executionTime) {
    executionTime.textContent = `${DashboardState.stats.averageExecutionTime}s`;
  }
  
  // Update success rate
  const successRate = document.getElementById('success-rate');
  if (successRate) {
    successRate.textContent = `${DashboardState.stats.successRate}%`;
  }
}

/**
 * Update pagination UI
 */
function updatePagination() {
  const paginationContainer = document.getElementById('pagination-container');
  if (!paginationContainer) return;
  
  const totalPages = Math.ceil(DashboardState.pagination.total / DashboardState.pagination.limit) || 1;
  
  // Simple pagination UI
  paginationContainer.innerHTML = `
    <div class="flex items-center justify-between">
      <button 
        class="px-3 py-1 rounded-md ${DashboardState.pagination.current === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800' : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}"
        ${DashboardState.pagination.current === 1 ? 'disabled' : 'onclick="changePage(' + (DashboardState.pagination.current - 1) + ')"'}
      >
        Previous
      </button>
      
      <span class="text-sm text-gray-700 dark:text-gray-300">
        Page ${DashboardState.pagination.current} of ${totalPages}
      </span>
      
      <button 
        class="px-3 py-1 rounded-md ${DashboardState.pagination.current === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800' : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'}"
        ${DashboardState.pagination.current === totalPages ? 'disabled' : 'onclick="changePage(' + (DashboardState.pagination.current + 1) + ')"'}
      >
        Next
      </button>
    </div>
  `;
}

/**
 * Initialize dashboard event listeners
 */
function initializeDashboardEvents() {
  // Project filter change
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      DashboardState.filters.status = e.target.value || null;
      DashboardState.pagination.current = 1;
      renderProjects();
      updatePagination();
    });
  }
  
  // Search input
  const searchInput = document.getElementById('project-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      DashboardState.filters.search = e.target.value;
      renderProjects();
      updatePagination();
    });
  }
  
  // Sort change
  const sortFilter = document.getElementById('sort-filter');
  if (sortFilter) {
    sortFilter.addEventListener('change', (e) => {
      DashboardState.filters.sort = e.target.value;
      renderProjects();
    });
  }
  
  // New project button
  const newProjectBtn = document.getElementById('new-project-btn');
  if (newProjectBtn) {
    newProjectBtn.addEventListener('click', openCreateProjectModal);
  }
  
  // Create project form
  const createProjectForm = document.getElementById('create-project-form');
  if (createProjectForm) {
    createProjectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await createNewProject();
    });
  }
  
  // Refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await Promise.all([
        loadProjects(),
        loadDashboardStats()
      ]);
    });
  }
}

/**
 * Setup WebSocket connections for real-time updates
 */
function setupWebSocketConnections() {
  try {
    // Model status WebSocket
    const modelStatusWs = ApiService.createWebSocketConnection('model_status');
    
    modelStatusWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Update GitHub models banner
        updateGitHubModelsBanner(data);
        
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    // Set up reconnection logic
    modelStatusWs.onclose = () => {
      // Try to reconnect after 5 seconds
      setTimeout(() => {
        setupWebSocketConnections();
      }, 5000);
    };
  } catch (error) {
    console.error('Failed to setup WebSocket connections:', error);
  }
}

/**
 * Update GitHub models banner based on status
 */
function updateGitHubModelsBanner(statusData) {
  const githubBanner = document.getElementById('github-models-banner');
  if (!githubBanner) return;
  
  if (statusData && statusData.providers && statusData.providers.github) {
    const githubStatus = statusData.providers.github.status;
    
    if (githubStatus === 'down') {
      githubBanner.classList.remove('hidden');
      
      // Update banner message if needed
      const bannerMessage = githubBanner.querySelector('.banner-message');
      if (bannerMessage) {
        bannerMessage.textContent = statusData.providers.github.message || 'GitHub AI models are currently down. Some features may be limited.';
      }
    } else {
      // Don't hide banner as it should be permanent per requirements
      // Just update the message to be informative
      const bannerMessage = githubBanner.querySelector('.banner-message');
      if (bannerMessage) {
        bannerMessage.textContent = 'GitHub AI models integration available. Note: AI generation is disabled in this open source version.';
      }
    }
  }
}

/**
 * Change pagination page
 */
function changePage(page) {
  DashboardState.pagination.current = page;
  renderProjects();
  updatePagination();
  
  // Scroll to top of projects section
  const projectsSection = document.getElementById('projects-section');
  if (projectsSection) {
    projectsSection.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * View project details
 */
async function viewProject(projectId) {
  try {
    showLoading();
    
    // Get project details
    const project = await ApiService.getProject(projectId);
    
    // Update state
    DashboardState.currentProject = project;
    
    // Redirect to project page
    window.location.href = `/project/${projectId}`;
  } catch (error) {
    console.error('Failed to view project:', error);
    showErrorNotification('Failed to load project details');
    hideLoading();
  }
}

/**
 * Open create project modal
 */
function openCreateProjectModal() {
  const modal = document.getElementById('create-project-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

/**
 * Close create project modal
 */
function closeCreateProjectModal() {
  const modal = document.getElementById('create-project-modal');
  if (modal) {
    modal.classList.add('hidden');
    
    // Clear form
    const form = document.getElementById('create-project-form');
    if (form) {
      form.reset();
    }
  }
}

/**
 * Create a new project
 */
async function createNewProject() {
  try {
    // Get form values
    const nameInput = document.getElementById('project-name');
    const descInput = document.getElementById('project-description');
    
    if (!nameInput || !nameInput.value.trim()) {
      showErrorNotification('Project name is required');
      return;
    }
    
    const projectData = {
      name: nameInput.value.trim(),
      description: descInput ? descInput.value.trim() : ''
    };
    
    // Show loading
    showLoading();
    
    // Create project
    const newProject = await ApiService.createProject(projectData);
    
    // Close modal
    closeCreateProjectModal();
    
    // Show success message
    showSuccessNotification('Project created successfully');
    
    // Reload projects
    await loadProjects();
    
    // Redirect to new project
    viewProject(newProject.id);
  } catch (error) {
    console.error('Failed to create project:', error);
    showErrorNotification(error.message || 'Failed to create project');
    hideLoading();
  }
}

/**
 * Edit project
 */
function editProject(projectId) {
  try {
    // Find project
    const project = [...DashboardState.activeProjects, ...DashboardState.archivedProjects]
      .find(p => p.id === projectId);
    
    if (!project) {
      showErrorNotification('Project not found');
      return;
    }
    
    // Get edit modal
    const modal = document.getElementById('edit-project-modal');
    if (!modal) return;
    
    // Set form values
    const nameInput = document.getElementById('edit-project-name');
    const descInput = document.getElementById('edit-project-description');
    const projectIdInput = document.getElementById('edit-project-id');
    
    if (nameInput) nameInput.value = project.name;
    if (descInput) descInput.value = project.description || '';
    if (projectIdInput) projectIdInput.value = projectId;
    
    // Show modal
    modal.classList.remove('hidden');
  } catch (error) {
    console.error('Failed to open edit project modal:', error);
    showErrorNotification('Failed to open edit project modal');
  }
}

/**
 * Update project
 */
async function updateProject(form) {
  try {
    // Prevent default form submission
    event.preventDefault();
    
    // Get form values
    const nameInput = document.getElementById('edit-project-name');
    const descInput = document.getElementById('edit-project-description');
    const projectIdInput = document.getElementById('edit-project-id');
    
    if (!nameInput || !nameInput.value.trim()) {
      showErrorNotification('Project name is required');
      return;
    }
    
    if (!projectIdInput || !projectIdInput.value) {
      showErrorNotification('Project ID is missing');
      return;
    }
    
    const projectData = {
      name: nameInput.value.trim(),
      description: descInput ? descInput.value.trim() : ''
    };
    
    // Show loading
    showLoading();
    
    // Update project
    await ApiService.updateProject(projectIdInput.value, projectData);
    
    // Close modal
    const modal = document.getElementById('edit-project-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    
    // Show success message
    showSuccessNotification('Project updated successfully');
    
    // Reload projects
    await loadProjects();
    
    hideLoading();
  } catch (error) {
    console.error('Failed to update project:', error);
    showErrorNotification(error.message || 'Failed to update project');
    hideLoading();
  }
}

/**
 * Archive project
 */
async function archiveProject(projectId) {
  try {
    if (!confirm('Are you sure you want to archive this project?')) {
      return;
    }
    
    showLoading();
    
    // Archive project
    await ApiService.archiveProject(projectId);
    
    // Show success message
    showSuccessNotification('Project archived successfully');
    
    // Reload projects
    await loadProjects();
    
    hideLoading();
  } catch (error) {
    console.error('Failed to archive project:', error);
    showErrorNotification(error.message || 'Failed to archive project');
    hideLoading();
  }
}

/**
 * Activate archived project
 */
async function activateProject(projectId) {
  try {
    showLoading();
    
    // Activate project
    await ApiService.activateProject(projectId);
    
    // Show success message
    showSuccessNotification('Project activated successfully');
    
    // Reload projects
    await loadProjects();
    
    hideLoading();
  } catch (error) {
    console.error('Failed to activate project:', error);
    showErrorNotification(error.message || 'Failed to activate project');
    hideLoading();
  }
}

/**
 * Confirm delete project
 */
function confirmDeleteProject(projectId) {
  // Show confirmation modal
  const modal = document.getElementById('delete-project-modal');
  if (!modal) {
    // Fallback to basic confirm
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      deleteProject(projectId);
    }
    return;
  }
  
  // Set project ID in hidden input
  const projectIdInput = document.getElementById('delete-project-id');
  if (projectIdInput) {
    projectIdInput.value = projectId;
  }
  
  // Show modal
  modal.classList.remove('hidden');
}

/**
 * Delete project
 */
async function deleteProject(projectId) {
  try {
    showLoading();
    
    // If projectId is not provided, get it from the form
    if (!projectId) {
      const projectIdInput = document.getElementById('delete-project-id');
      if (!projectIdInput || !projectIdInput.value) {
        showErrorNotification('Project ID is missing');
        hideLoading();
        return;
      }
      projectId = projectIdInput.value;
    }
    
    // Delete project
    await ApiService.deleteProject(projectId);
    
    // Close modal
    const modal = document.getElementById('delete-project-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
    
    // Show success message
    showSuccessNotification('Project deleted successfully');
    
    // Reload projects
    await loadProjects();
    
    hideLoading();
  } catch (error) {
    console.error('Failed to delete project:', error);
    showErrorNotification(error.message || 'Failed to delete project');
    hideLoading();
  }
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
  const projectsLoadingIndicator = document.getElementById('projects-loading');
  if (projectsLoadingIndicator) {
    projectsLoadingIndicator.classList.toggle('hidden', !DashboardState.loading.projects);
  }
  
  const statsLoadingIndicator = document.getElementById('stats-loading');
  if (statsLoadingIndicator) {
    statsLoadingIndicator.classList.toggle('hidden', !DashboardState.loading.stats);
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
    day: 'numeric' 
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

// Initialize dashboard when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  initializeDashboard();
});
