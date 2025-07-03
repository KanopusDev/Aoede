/**
 * Code generation functionality for Aoede application
 * This file handles the code generation features, including code editing,
 * generation requests, and code validation.
 */

// API endpoint for code generation
const GENERATE_API_ENDPOINT = '/api/v1/generate';

/**
 * Initialize code generation form
 */
document.addEventListener('DOMContentLoaded', () => {
  const generationForm = document.getElementById('code-generation-form');
  
  if (generationForm) {
    generationForm.addEventListener('submit', handleGenerationSubmit);
    
    // Initialize language selector
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
      languageSelect.addEventListener('change', updateLanguageSelection);
    }
    
    // Initialize model selector
    const modelSelect = document.getElementById('model-select');
    if (modelSelect) {
      loadAvailableModels();
    }
    
    // Initialize template selector
    const templateSelect = document.getElementById('template-select');
    if (templateSelect) {
      templateSelect.addEventListener('change', loadTemplatePreview);
    }
  }
  
  // Initialize code validation button
  const validateButton = document.getElementById('validate-code-button');
  if (validateButton) {
    validateButton.addEventListener('click', validateCode);
  }
  
  // Initialize code improvement button
  const improveButton = document.getElementById('improve-code-button');
  if (improveButton) {
    improveButton.addEventListener('click', improveCode);
  }
  
  // Initialize generated code container
  setupCopyCodeButtons();
  
  // Add github model banner 
  showGithubModelsBanner();
});

/**
 * Handle code generation form submission
 * @param {Event} e - Form submission event
 */
async function handleGenerationSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const promptInput = form.querySelector('#prompt-input');
  const languageSelect = form.querySelector('#language-select');
  const modelSelect = form.querySelector('#model-select');
  const projectSelect = form.querySelector('#project-select');
  
  if (!promptInput || !promptInput.value.trim()) {
    showNotification('Please enter a prompt for code generation', 'error');
    return;
  }
  
  if (!languageSelect || !languageSelect.value) {
    showNotification('Please select a programming language', 'error');
    return;
  }
  
  const generationData = {
    prompt: promptInput.value.trim(),
    language: languageSelect.value,
    model: modelSelect ? modelSelect.value : null,
    project_id: projectSelect && projectSelect.value !== "none" ? projectSelect.value : null
  };
  
  const resultContainer = document.getElementById('generation-result');
  const loadingIndicator = document.getElementById('generation-loading');
  
  if (resultContainer) resultContainer.classList.add('hidden');
  if (loadingIndicator) loadingIndicator.classList.remove('hidden');
  
  try {
    const result = await apiRequest('/generate/code', {
      method: 'POST',
      body: JSON.stringify(generationData)
    });
    
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
    
    if (!result) {
      throw new Error('Failed to generate code');
    }
    
    displayGeneratedCode(result);
    showNotification('Code generated successfully', 'success');
  } catch (error) {
    console.error('Code generation error:', error);
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
    showNotification(error.message || 'Failed to generate code', 'error');
  }
}

/**
 * Display generated code in the result container
 * @param {Object} result - Generation result data
 */
function displayGeneratedCode(result) {
  const resultContainer = document.getElementById('generation-result');
  if (!resultContainer) return;
  
  resultContainer.classList.remove('hidden');
  
  resultContainer.innerHTML = `
    <div class="code-editor-container">
      <div class="code-editor-header">
        <div class="code-editor-language">
          <span>${result.language}</span>
        </div>
        <div class="code-editor-actions">
          <button class="btn-secondary btn-sm copy-code-button" data-code-id="generated-code">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
            </svg>
            Copy
          </button>
        </div>
      </div>
      <div class="code-editor-content" id="generated-code">${escapeHtml(result.code)}</div>
    </div>
    
    <div class="mt-4">
      <div class="flex flex-wrap gap-2">
        <button id="validate-code-button" class="btn-secondary">Validate Code</button>
        <button id="improve-code-button" class="btn-secondary">Improve Code</button>
        <button id="save-to-project-button" class="btn-primary">Save to Project</button>
      </div>
    </div>
    
    <div class="mt-4">
      <h3 class="text-md font-medium mb-2">Generation Details:</h3>
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div>
          <span class="text-gray-500">Generation Time:</span>
          <span>${result.generation_time.toFixed(2)}s</span>
        </div>
        <div>
          <span class="text-gray-500">Model Used:</span>
          <span>${result.metadata?.model || 'Unknown'}</span>
        </div>
      </div>
    </div>
  `;
  
  // Re-initialize copy buttons
  setupCopyCodeButtons();
  
  // Add event listeners for the new buttons
  const validateButton = document.getElementById('validate-code-button');
  if (validateButton) {
    validateButton.addEventListener('click', validateCode);
  }
  
  const improveButton = document.getElementById('improve-code-button');
  if (improveButton) {
    improveButton.addEventListener('click', improveCode);
  }
  
  const saveButton = document.getElementById('save-to-project-button');
  if (saveButton) {
    saveButton.addEventListener('click', saveToProject);
  }
  
  // Initialize syntax highlighting
  const codeElement = document.getElementById('generated-code');
  if (codeElement) {
    // Apply line numbers and basic formatting
    const codeText = codeElement.textContent;
    const lines = codeText.split('\n');
    let formattedCode = '';
    
    lines.forEach((line, index) => {
      formattedCode += `<div class="code-line"><span class="line-number">${index + 1}</span><span class="line-content">${line || ' '}</span></div>`;
    });
    
    codeElement.innerHTML = formattedCode;
  }
  
  // Scroll to result
  resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Escape HTML characters
 * @param {string} html - String to escape
 * @returns {string} - Escaped string
 */
function escapeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Setup copy code buttons
 */
function setupCopyCodeButtons() {
  const copyButtons = document.querySelectorAll('.copy-code-button');
  
  copyButtons.forEach(button => {
    button.addEventListener('click', () => {
      const codeId = button.getAttribute('data-code-id');
      const codeElement = document.getElementById(codeId);
      
      if (codeElement) {
        const code = codeElement.innerText || codeElement.textContent;
        
        navigator.clipboard.writeText(code).then(() => {
          const originalText = button.innerHTML;
          button.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
            </svg>
            Copied!
          `;
          
          setTimeout(() => {
            button.innerHTML = originalText;
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy code:', err);
          showNotification('Failed to copy code to clipboard', 'error');
        });
      }
    });
  });
}

/**
 * Load available AI models
 */
async function loadAvailableModels() {
  const modelSelect = document.getElementById('model-select');
  if (!modelSelect) return;
  
  try {
    const models = await apiRequest('/models');
    
    if (!models || !Array.isArray(models)) {
      throw new Error('Failed to load models');
    }
    
    // Clear existing options except the first one (if it's a placeholder)
    const firstOption = modelSelect.options[0];
    modelSelect.innerHTML = '';
    
    if (firstOption && firstOption.value === '') {
      modelSelect.appendChild(firstOption);
    }
    
    // Add model options
    models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.name;
      option.textContent = `${model.name.split('/').pop()} (${model.type})`;
      modelSelect.appendChild(option);
    });
    
  } catch (error) {
    console.error('Error loading models:', error);
    showNotification('Failed to load available models', 'warning');
  }
}

/**
 * Update language selection and related options
 */
async function updateLanguageSelection() {
  const languageSelect = document.getElementById('language-select');
  const templateSelect = document.getElementById('template-select');
  
  if (!languageSelect || !templateSelect) return;
  
  const language = languageSelect.value;
  
  try {
    // Clear existing template options
    templateSelect.innerHTML = '<option value="">Select Template (Optional)</option>';
    
    if (!language) return;
    
    // Load templates for selected language
    const templates = await apiRequest(`/generate/templates/${language}`);
    
    if (templates && Array.isArray(templates)) {
      templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.name;
        option.textContent = template.name;
        templateSelect.appendChild(option);
      });
    }
    
  } catch (error) {
    console.error('Error loading templates:', error);
    showNotification('Failed to load templates for the selected language', 'warning');
  }
}

/**
 * Load template preview
 */
async function loadTemplatePreview() {
  const templateSelect = document.getElementById('template-select');
  const languageSelect = document.getElementById('language-select');
  const templatePreviewContainer = document.getElementById('template-preview');
  
  if (!templateSelect || !templatePreviewContainer || !languageSelect) return;
  
  const templateName = templateSelect.value;
  const language = languageSelect.value;
  
  if (!templateName || !language) {
    templatePreviewContainer.classList.add('hidden');
    return;
  }
  
  templatePreviewContainer.innerHTML = `
    <div class="p-4 bg-gray-50 rounded-lg">
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-sm font-medium">Template Preview</h3>
        <div class="loading-spinner"></div>
      </div>
      <div class="h-32 skeleton-loader"></div>
    </div>
  `;
  templatePreviewContainer.classList.remove('hidden');
  
  try {
    const formData = new FormData();
    formData.append('language', language);
    formData.append('template_name', templateName);
    formData.append('parameters', '{}');
    
    const preview = await apiRequest('/generate/preview-template', {
      method: 'POST',
      headers: {
        'Content-Type': undefined // Let the browser set the correct Content-Type for FormData
      },
      body: formData
    });
    
    if (!preview || !preview.success) {
      throw new Error(preview?.error || 'Failed to load template preview');
    }
    
    templatePreviewContainer.innerHTML = `
      <div class="p-4 bg-gray-50 rounded-lg">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-sm font-medium">Template: ${templateName}</h3>
          <button class="btn-secondary btn-sm copy-code-button" data-code-id="template-code">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
            </svg>
            Copy
          </button>
        </div>
        <div class="code-editor-content" id="template-code">${escapeHtml(preview.preview_code)}</div>
      </div>
    `;
    
    // Initialize syntax highlighting for template code
    const codeElement = document.getElementById('template-code');
    if (codeElement) {
      const codeText = codeElement.textContent;
      const lines = codeText.split('\n');
      let formattedCode = '';
      
      lines.forEach((line, index) => {
        formattedCode += `<div class="code-line"><span class="line-number">${index + 1}</span><span class="line-content">${line || ' '}</span></div>`;
      });
      
      codeElement.innerHTML = formattedCode;
    }
    
    // Re-initialize copy buttons
    setupCopyCodeButtons();
    
  } catch (error) {
    console.error('Error loading template preview:', error);
    templatePreviewContainer.innerHTML = `
      <div class="p-4 bg-gray-50 rounded-lg">
        <p class="text-red-500">Failed to load template preview: ${error.message || 'Unknown error'}</p>
      </div>
    `;
  }
}

/**
 * Validate generated code
 */
async function validateCode() {
  const codeElement = document.getElementById('generated-code');
  const languageSelect = document.getElementById('language-select');
  
  if (!codeElement || !languageSelect) {
    showNotification('No code to validate', 'error');
    return;
  }
  
  const code = codeElement.innerText || codeElement.textContent;
  const language = languageSelect.value;
  
  const validationResultContainer = document.getElementById('validation-result');
  if (!validationResultContainer) return;
  
  validationResultContainer.innerHTML = `
    <div class="mt-4 p-4 border border-gray-200 rounded-lg">
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-md font-medium">Validation Result</h3>
        <div class="loading-spinner"></div>
      </div>
      <p>Validating code...</p>
    </div>
  `;
  validationResultContainer.classList.remove('hidden');
  
  try {
    const validationData = {
      code,
      language
    };
    
    const result = await apiRequest('/generate/validate', {
      method: 'POST',
      body: JSON.stringify(validationData)
    });
    
    if (!result) {
      throw new Error('Failed to validate code');
    }
    
    const validationClass = result.is_valid ? 'text-green-600' : 'text-red-600';
    const validationIcon = result.is_valid 
      ? '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>';
    
    validationResultContainer.innerHTML = `
      <div class="mt-4 p-4 border border-gray-200 rounded-lg">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-md font-medium">Validation Result</h3>
          <div class="flex items-center ${validationClass}">
            ${validationIcon}
            <span class="font-medium">${result.is_valid ? 'Valid Code' : 'Invalid Code'}</span>
          </div>
        </div>
        
        ${result.errors.length > 0 ? `
          <div class="mb-3">
            <h4 class="text-sm font-medium text-red-600 mb-1">Errors:</h4>
            <ul class="list-disc list-inside">
              ${result.errors.map(error => `<li class="text-sm text-red-600">${escapeHtml(error)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${result.warnings.length > 0 ? `
          <div class="mb-3">
            <h4 class="text-sm font-medium text-amber-600 mb-1">Warnings:</h4>
            <ul class="list-disc list-inside">
              ${result.warnings.map(warning => `<li class="text-sm text-amber-600">${escapeHtml(warning)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        ${result.suggestions.length > 0 ? `
          <div>
            <h4 class="text-sm font-medium text-blue-600 mb-1">Suggestions:</h4>
            <ul class="list-disc list-inside">
              ${result.suggestions.map(suggestion => `<li class="text-sm text-blue-600">${escapeHtml(suggestion)}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
    
  } catch (error) {
    console.error('Code validation error:', error);
    validationResultContainer.innerHTML = `
      <div class="mt-4 p-4 border border-red-200 bg-red-50 rounded-lg">
        <div class="flex items-center text-red-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
          </svg>
          <p>Failed to validate code: ${error.message || 'Unknown error'}</p>
        </div>
      </div>
    `;
  }
}

/**
 * Improve generated code
 */
async function improveCode() {
  const codeElement = document.getElementById('generated-code');
  const languageSelect = document.getElementById('language-select');
  
  if (!codeElement || !languageSelect) {
    showNotification('No code to improve', 'error');
    return;
  }
  
  const code = codeElement.innerText || codeElement.textContent;
  const language = languageSelect.value;
  
  const formData = new FormData();
  formData.append('code', code);
  formData.append('language', language);
  formData.append('improvement_type', 'optimize');
  
  const loadingIndicator = document.getElementById('improvement-loading');
  if (loadingIndicator) loadingIndicator.classList.remove('hidden');
  
  try {
    const result = await apiRequest('/generate/improve', {
      method: 'POST',
      headers: {
        'Content-Type': undefined // Let the browser set the correct Content-Type for FormData
      },
      body: formData
    });
    
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
    
    if (!result || !result.improved_code) {
      throw new Error('Failed to improve code');
    }
    
    // Update the code with improved version
    displayGeneratedCode({
      code: result.improved_code,
      language: language,
      generation_time: result.processing_time || 0,
      metadata: {
        model: result.model_used || 'Unknown',
        improvement_type: 'optimize'
      }
    });
    
    showNotification('Code improved successfully', 'success');
    
  } catch (error) {
    console.error('Code improvement error:', error);
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
    showNotification(error.message || 'Failed to improve code', 'error');
  }
}

/**
 * Save generated code to project
 */
async function saveToProject() {
  const codeElement = document.getElementById('generated-code');
  const languageSelect = document.getElementById('language-select');
  const projectSelect = document.getElementById('project-select');
  
  if (!codeElement) {
    showNotification('No code to save', 'error');
    return;
  }
  
  // If no project is selected, show project selection modal
  if (!projectSelect || projectSelect.value === 'none') {
    showProjectSelectionModal();
    return;
  }
  
  const projectId = projectSelect.value;
  const code = codeElement.innerText || codeElement.textContent;
  const language = languageSelect ? languageSelect.value : '';
  
  try {
    const result = await apiRequest(`/projects/${projectId}/generations`, {
      method: 'POST',
      body: JSON.stringify({
        code,
        language,
        name: 'Generated Code',
        description: 'Code generated with Aoede'
      })
    });
    
    if (!result) {
      throw new Error('Failed to save code to project');
    }
    
    showNotification('Code saved to project successfully', 'success');
    
    // Redirect to project page
    window.location.href = `/projects/${projectId}`;
    
  } catch (error) {
    console.error('Error saving to project:', error);
    showNotification(error.message || 'Failed to save code to project', 'error');
  }
}

/**
 * Show project selection modal
 */
function showProjectSelectionModal() {
  // Implementation of project selection modal
  // This would be added when developing the project functionality
  showNotification('Project selection not implemented yet', 'info');
}

/**
 * Show Github Models banner
 */
function showGithubModelsBanner() {
  // Check if banner already exists
  if (document.getElementById('github-models-banner')) return;
  
  const banner = document.createElement('div');
  banner.id = 'github-models-banner';
  banner.className = 'status-banner status-banner-warning';
  banner.innerHTML = `
    <div class="flex justify-between items-center max-w-7xl mx-auto">
      <div class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
        </svg>
        <span>GitHub Models are currently unavailable. AI generation features will not work.</span>
      </div>
      <button id="status-banner-close" class="text-white focus:outline-none">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
        </svg>
      </button>
    </div>
  `;
  
  document.body.prepend(banner);
  
  // Push content down to avoid overlap with fixed banner
  const mainContent = document.querySelector('main') || document.body.children[1];
  if (mainContent) {
    mainContent.style.marginTop = banner.offsetHeight + 'px';
  }
  
  // Add event listener to close button
  const closeButton = document.getElementById('status-banner-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      banner.remove();
      if (mainContent) {
        mainContent.style.marginTop = '0';
      }
      
      // Store in session storage so it doesn't show up again in this session
      sessionStorage.setItem('github-models-banner-dismissed', 'true');
    });
  }
  
  // Check if banner was previously dismissed
  if (sessionStorage.getItem('github-models-banner-dismissed') === 'true') {
    banner.remove();
    if (mainContent) {
      mainContent.style.marginTop = '0';
    }
  }
}
