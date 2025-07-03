/**
 * Aoede Platform
 * Main JavaScript file
 * 
 * @author Pradyumn Tandon (Gamecooler19)
 * @organization Kanopus
 * @website https://aoede.kanopus.org
 * @version 1.0.0
 * @license MIT
 */

// Configuration
const API_BASE_URL = '/api';
const API_VERSION = 'v1';
const API_ENDPOINT = `${API_BASE_URL}/${API_VERSION}`;

// Global state management
const AoedeApp = {
  user: null,
  isAuthenticated: false,
  darkMode: false,
  apiStatus: {
    operational: true,
    services: {},
    lastChecked: null
  },
  notifications: [],
  currentProject: null,
  projects: [],
  settings: {
    animationsEnabled: true,
    codeTheme: 'dark',
    githubModelsEnabled: false
  }
};

/**
 * Initializes the application when DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', function() {
  
  try {
    // Load saved settings from localStorage
    loadUserSettings();
    
    // Initialize UI components
    initializeUIComponents();
    
    // Mobile menu functionality
    initializeMobileMenu();

    // Theme toggle functionality
    initializeThemeToggle();

    // Initialize type effect for any elements with class 'type-effect'
    initTypeEffect();
    
    // Initialize scroll animations
    initScrollAnimation();
    
    // Initialize code syntax highlighting
    initCodeHighlighting();
    
    // Check API status and update banner
    checkApiStatus();
    
    // Initialize form validation
    initFormValidation();
    
    // Check authentication status
    checkAuthStatus();
    
    // Initialize any page-specific functionality
    initPageSpecific();
    
    // Log initialization success
  } catch (error) {
    // Handle initialization errors gracefully
    console.error('Error during application initialization:', error);
    
    // Show error notification to user if critical
    showNotification('Application initialization error. Please refresh the page.', 'error');
  }
});

/**
 * Loads user settings from localStorage
 */
function loadUserSettings() {
  try {
    const savedSettings = localStorage.getItem('aoede-settings');
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      AoedeApp.settings = { ...AoedeApp.settings, ...parsedSettings };
    }
  } catch (error) {
    console.error('Error loading user settings:', error);
  }
}

/**
 * Initialize all UI components
 */
function initializeUIComponents() {
  // Initialize tooltips
  const tooltips = document.querySelectorAll('[data-tooltip]');
  tooltips.forEach(tooltip => {
    tooltip.addEventListener('mouseenter', showTooltip);
    tooltip.addEventListener('mouseleave', hideTooltip);
  });
  
  // Initialize dropdown menus
  const dropdowns = document.querySelectorAll('.dropdown-toggle');
  dropdowns.forEach(dropdown => {
    dropdown.addEventListener('click', toggleDropdown);
  });
  
  // Initialize tabs
  const tabButtons = document.querySelectorAll('[data-tab-target]');
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      activateTab(button.dataset.tabTarget);
    });
  });
  
  // Initialize modals
  const modalTriggers = document.querySelectorAll('[data-modal-target]');
  modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = trigger.dataset.modalTarget;
      openModal(modalId);
    });
  });
  
  // Close buttons for modals, alerts, etc.
  const closeButtons = document.querySelectorAll('.close-btn');
  closeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const target = button.closest('.closable');
      if (target) {
        target.classList.add('hidden');
      }
    });
  });
}

/**
 * Initialize mobile menu functionality
 */
function initializeMobileMenu() {
  const mobileMenuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }
}

/**
 * Initialize theme toggle functionality
 */
function initializeThemeToggle() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
  const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

  // Set the initial theme based on system preference or saved preference
  if (localStorage.getItem('color-theme') === 'dark' || 
      (!localStorage.getItem('color-theme') && 
      window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    themeToggleLightIcon.classList.remove('hidden');
    AoedeApp.darkMode = true;
  } else {
    themeToggleDarkIcon.classList.remove('hidden');
    AoedeApp.darkMode = false;
  }

  // Toggle theme when button is clicked
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function() {
      // Toggle icons
      themeToggleDarkIcon.classList.toggle('hidden');
      themeToggleLightIcon.classList.toggle('hidden');
      
      // Toggle dark mode class
      document.documentElement.classList.toggle('dark');
      
      // Update application state
      AoedeApp.darkMode = document.documentElement.classList.contains('dark');
      
      // Update local storage
      localStorage.setItem('color-theme', AoedeApp.darkMode ? 'dark' : 'light');
      
      // Update code blocks if they exist
      updateCodeBlocksTheme();
      
    });
  }
}

/**
 * Creates typewriter effect for hero sections
 */
function initTypeEffect() {
  const typeElements = document.querySelectorAll('.type-effect');
  
  if (typeElements.length === 0) return;
  
  typeElements.forEach(element => {
    const text = element.getAttribute('data-text');
    if (!text) return;
    
    try {
      const textArray = JSON.parse(text);
      let currentTextIndex = 0;
      let currentCharIndex = 0;
      let isDeleting = false;
      let typingSpeed = 100;
      
      function type() {
        if (!AoedeApp.settings.animationsEnabled) {
          element.textContent = textArray[0];
          return;
        }
        
        const currentText = textArray[currentTextIndex];
        
        if (isDeleting) {
          element.textContent = currentText.substring(0, currentCharIndex - 1);
          currentCharIndex--;
          typingSpeed = 50;
        } else {
          element.textContent = currentText.substring(0, currentCharIndex + 1);
          currentCharIndex++;
          typingSpeed = 100;
        }
        
        if (!isDeleting && currentCharIndex === currentText.length) {
          isDeleting = true;
          typingSpeed = 1000; // Pause at end
        } else if (isDeleting && currentCharIndex === 0) {
          isDeleting = false;
          currentTextIndex = (currentTextIndex + 1) % textArray.length;
          typingSpeed = 500; // Pause before typing next
        }
        
        setTimeout(type, typingSpeed);
      }
      
      type();
    } catch (error) {
      console.error('Error in type effect:', error);
      element.textContent = text || 'Type effect error';
    }
  });
}

/**
 * Initializes animations for elements as they scroll into view
 */
function initScrollAnimation() {
  const animatedElements = document.querySelectorAll('.animate-on-scroll');
  
  if (animatedElements.length === 0) return;
  
  // If animations are disabled in settings, activate all elements immediately
  if (!AoedeApp.settings.animationsEnabled) {
    animatedElements.forEach(element => {
      element.classList.add('animate-active');
    });
    return;
  }
  
  // Check if IntersectionObserver is supported
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-active');
          
          // Get animation type from data attribute
          const animation = entry.target.dataset.animation || 'fade-in';
          entry.target.classList.add(animation);
          
          // Unobserve after animation is triggered once
          observer.unobserve(entry.target);
        }
      });
    }, { 
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    animatedElements.forEach(element => {
      observer.observe(element);
    });
  } else {
    // Fallback for browsers that don't support IntersectionObserver
    animatedElements.forEach(element => {
      element.classList.add('animate-active');
    });
  }
}

/**
 * Adds syntax highlighting to code blocks
 */
function initCodeHighlighting() {
  const codeBlocks = document.querySelectorAll('pre code');
  if (codeBlocks.length === 0) return;
  
  // Check if a highlighting library is available (like Prism or Highlight.js)
  if (typeof Prism !== 'undefined') {
    Prism.highlightAll();
    return;
  }
  
  // Simple syntax highlighting using regular expressions as fallback
  codeBlocks.forEach(block => {
    try {
      let html = block.innerHTML;
      
      // Get language from class (e.g., "language-python")
      let language = '';
      block.classList.forEach(cls => {
        if (cls.startsWith('language-')) {
          language = cls.replace('language-', '');
        }
      });
      
      // Apply language-specific highlighting
      switch(language) {
        case 'python':
          html = highlightPython(html);
          break;
        case 'javascript':
          html = highlightJavaScript(html);
          break;
        default:
          html = highlightGeneric(html);
      }
      
      block.innerHTML = html;
      
      // Add copy button
      addCodeCopyButton(block.parentElement);
    } catch (error) {
      console.error('Error highlighting code block:', error);
    }
  });
}

/**
 * Highlights Python code
 */
function highlightPython(code) {
  // Keywords
  const keywords = ['def', 'class', 'import', 'from', 'as', 'return', 'if', 'else', 'elif', 'for', 'while', 'try', 'except', 'finally', 'with', 'async', 'await', 'lambda', 'yield', 'break', 'continue', 'pass', 'raise', 'in', 'is', 'not', 'and', 'or', 'True', 'False', 'None'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    code = code.replace(regex, `<span class="text-purple-500">${keyword}</span>`);
  });
  
  // Strings
  code = code.replace(/(".*?"|'.*?')/g, '<span class="text-green-500">$1</span>');
  
  // Comments
  code = code.replace(/(#.*)/g, '<span class="text-gray-500">$1</span>');
  
  // Function calls
  code = code.replace(/(\w+)\(/g, '<span class="text-blue-500">$1</span>(');
  
  return code;
}

/**
 * Highlights JavaScript code
 */
function highlightJavaScript(code) {
  // Keywords
  const keywords = ['function', 'return', 'if', 'else', 'for', 'while', 'class', 'const', 'let', 'var', 'typeof', 'new', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield', 'import', 'export', 'default'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    code = code.replace(regex, `<span class="text-purple-500">${keyword}</span>`);
  });
  
  // Strings
  code = code.replace(/(["'`])(.*?)\1/g, '<span class="text-green-500">$&</span>');
  
  // Comments
  code = code.replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, '<span class="text-gray-500">$1</span>');
  
  // Function calls
  code = code.replace(/(\w+)\(/g, '<span class="text-blue-500">$1</span>(');
  
  return code;
}

/**
 * Generic code highlighting for other languages
 */
function highlightGeneric(code) {
  // Common keywords across languages
  const keywords = ['function', 'return', 'if', 'else', 'for', 'while', 'class', 'const', 'static', 'private', 'public', 'protected', 'void', 'int', 'string', 'bool', 'true', 'false', 'null', 'new', 'try', 'catch'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    code = code.replace(regex, `<span class="text-purple-500">${keyword}</span>`);
  });
  
  // Strings
  code = code.replace(/(["'])(.*?)\1/g, '<span class="text-green-500">$&</span>');
  
  // Comments (C-style)
  code = code.replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, '<span class="text-gray-500">$1</span>');
  
  return code;
}

/**
 * Adds a copy button to code blocks
 */
function addCodeCopyButton(codeBlock) {
  // Check if it's a proper code block container
  if (!codeBlock || codeBlock.tagName !== 'PRE') return;
  
  // Create copy button
  const copyButton = document.createElement('button');
  copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
  copyButton.className = 'absolute top-2 right-2 p-2 rounded-md bg-gray-800 bg-opacity-50 text-gray-300 hover:bg-opacity-80 hover:text-white transition-all';
  copyButton.title = 'Copy code';
  
  // Position the code block container relatively if it's not already
  if (getComputedStyle(codeBlock).position === 'static') {
    codeBlock.style.position = 'relative';
  }
  
  // Add click event to copy code
  copyButton.addEventListener('click', () => {
    const code = codeBlock.querySelector('code').innerText;
    
    // Copy to clipboard
    navigator.clipboard.writeText(code).then(() => {
      // Success feedback
      copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
      copyButton.classList.add('bg-green-500', 'bg-opacity-80');
      
      // Reset after 2 seconds
      setTimeout(() => {
        copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
        copyButton.classList.remove('bg-green-500', 'bg-opacity-80');
      }, 2000);
    }).catch(err => {
      console.error('Error copying code:', err);
      copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
      copyButton.classList.add('bg-red-500', 'bg-opacity-80');
      
      setTimeout(() => {
        copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
        copyButton.classList.remove('bg-red-500', 'bg-opacity-80');
      }, 2000);
    });
  });
  
  // Add the copy button to the code block
  codeBlock.appendChild(copyButton);
}

/**
 * Updates code blocks theme based on dark mode setting
 */
function updateCodeBlocksTheme() {
  const codeBlocks = document.querySelectorAll('pre');
  const darkMode = AoedeApp.darkMode;
  
  codeBlocks.forEach(block => {
    if (darkMode) {
      block.classList.add('dark-theme');
      block.classList.remove('light-theme');
    } else {
      block.classList.add('light-theme');
      block.classList.remove('dark-theme');
    }
  });
}

/**
 * Checks the API status and updates the notification banner
 */
function checkApiStatus() {
  const banner = document.getElementById('github-models-banner');
  const statusIndicator = document.getElementById('api-status-indicator');
  
  // Don't proceed if banner doesn't exist
  if (!banner) return;
  
  // Use ApiService to check health if available
  if (window.ApiService && typeof ApiService.checkHealth === 'function') {
    ApiService.checkHealth()
      .then(data => {
        // Update application state
        AoedeApp.apiStatus.operational = data.status === 'ok';
        AoedeApp.apiStatus.services = data.details || {};
        AoedeApp.apiStatus.lastChecked = new Date();
        
        // Update UI elements
        updateApiStatusUI(data);
        
        // Banner is already displayed by default due to GitHub models being down
        // Update banner with GitHub models status if available
        if (data.details && data.details.models && data.details.models.github) {
          const githubStatus = data.details.models.github;
          
          // Update banner message with GitHub models status
          const bannerMessage = banner.querySelector('.banner-message');
          if (bannerMessage) {
            bannerMessage.textContent = githubStatus.message || 
              'GitHub AI models integration available. Note: AI generation is disabled in this open source version.';
          }
        }
        
      })
      .catch(error => {
        console.error('Error checking API status:', error);
        
        // Update application state
        AoedeApp.apiStatus.operational = false;
        AoedeApp.apiStatus.lastChecked = new Date();
        
        // Update UI elements
        if (statusIndicator) {
          statusIndicator.className = 'h-3 w-3 rounded-full bg-red-500';
          statusIndicator.setAttribute('data-tooltip', 'API is down');
        }
        
        // Update banner to show API connection issue
        banner.innerHTML = `
          <div class="container mx-auto flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="font-medium banner-message">API Connection Error: Unable to reach the Aoede API. Please try again later.</span>
          </div>
        `;
        banner.classList.remove('bg-amber-500');
        banner.classList.add('bg-red-500');
      });
  } else {
    // Fallback to basic fetch if ApiService not available
    fetch('/api/v1/health')
      .then(response => response.json())
      .then(data => {
        // Banner is already displayed by default due to GitHub models being down
      })
      .catch(error => {
        console.error('Error checking API status:', error);
        // Update banner to show API connection issue
        banner.innerHTML = `
          <div class="container mx-auto flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="font-medium">API Connection Error: Unable to reach the Aoede API. Please try again later.</span>
          </div>
        `;
        banner.classList.remove('bg-amber-500');
        banner.classList.add('bg-red-500');
      });
  }
}

/**
 * Updates the API status UI elements
 * @param {Object} data - Health check response data
 */
function updateApiStatusUI(data) {
  const statusIndicator = document.getElementById('api-status-indicator');
  const statusPopover = document.getElementById('api-status-details');
  
  if (!statusIndicator) return;
  
  if (data.status === 'ok') {
    statusIndicator.className = 'h-3 w-3 rounded-full bg-green-500';
    statusIndicator.setAttribute('data-tooltip', 'API is operational');
  } else if (data.status === 'degraded') {
    statusIndicator.className = 'h-3 w-3 rounded-full bg-amber-500';
    statusIndicator.setAttribute('data-tooltip', 'API is experiencing issues');
  } else {
    statusIndicator.className = 'h-3 w-3 rounded-full bg-red-500';
    statusIndicator.setAttribute('data-tooltip', 'API is down');
  }
  
  // Update popover with detailed status if it exists
  if (statusPopover && data.details) {
    let popoverContent = '<div class="p-4">';
    popoverContent += '<h3 class="text-lg font-semibold mb-2">API Status</h3>';
    
    // Create status entries for each service
    for (const [service, status] of Object.entries(data.details)) {
      const serviceStatus = typeof status === 'object' ? status.status : status;
      const serviceMessage = typeof status === 'object' && status.message ? status.message : '';
      
      let statusColorClass = 'text-green-600 dark:text-green-400';
      let statusIconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>';
      
      if (serviceStatus === 'degraded') {
        statusColorClass = 'text-amber-600 dark:text-amber-400';
        statusIconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>';
      } else if (serviceStatus === 'down') {
        statusColorClass = 'text-red-600 dark:text-red-400';
        statusIconPath = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>';
      }
      
      popoverContent += `
        <div class="flex items-center mb-2">
          <svg class="h-5 w-5 ${statusColorClass} mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            ${statusIconPath}
          </svg>
          <div>
            <span class="font-medium capitalize">${service}</span>
            <span class="text-sm text-gray-500 dark:text-gray-400 ml-2 capitalize">${serviceStatus}</span>
            ${serviceMessage ? `<p class="text-sm text-gray-600 dark:text-gray-400">${serviceMessage}</p>` : ''}
          </div>
        </div>
      `;
    }
    
    popoverContent += `<div class="text-xs text-gray-500 dark:text-gray-400 mt-2">
      Last checked: ${new Date().toLocaleTimeString()}
    </div>`;
    popoverContent += '</div>';
    
    statusPopover.innerHTML = popoverContent;
  }
}

/**
 * Check authentication status
 * Uses ApiService to check user authentication and update UI accordingly
 */
async function checkAuthStatus() {
  try {
    // Check if ApiService is available
    if (window.ApiService && typeof ApiService.isAuthenticated === 'function') {
      if (ApiService.isAuthenticated()) {
        // Get current user details
        const user = await ApiService.getCurrentUser();
        
        // Update application state
        if (user) {
          AoedeApp.user = user;
          AoedeApp.isAuthenticated = true;
          
          // Update UI for authenticated user
          updateAuthenticatedUI(user);
        } else {
          // Token exists but is invalid or expired
          AoedeApp.isAuthenticated = false;
          ApiService.clearAuth();
          updateUnauthenticatedUI();
        }
      } else {
        // No authentication token
        AoedeApp.isAuthenticated = false;
        updateUnauthenticatedUI();
      }
    } else {
      // Fallback to basic token check
      const token = localStorage.getItem('auth_token');
      AoedeApp.isAuthenticated = !!token;
      
      // Update UI based on token presence
      if (token) {
        updateAuthenticatedUI();
      } else {
        updateUnauthenticatedUI();
      }
    }
  } catch (error) {
    console.error('Error checking authentication status:', error);
    AoedeApp.isAuthenticated = false;
    updateUnauthenticatedUI();
  }
}

/**
 * Update UI for authenticated users
 */
function updateAuthenticatedUI(user) {
  // Update navigation items
  const authButtons = document.querySelectorAll('.auth-buttons');
  const userMenus = document.querySelectorAll('.user-menu');
  const userNameElements = document.querySelectorAll('.user-name');
  
  // Hide auth buttons, show user menu
  authButtons.forEach(el => el.classList.add('hidden'));
  userMenus.forEach(el => el.classList.remove('hidden'));
  
  // Update user name if elements exist
  if (user && userNameElements.length > 0) {
    userNameElements.forEach(el => {
      el.textContent = user.full_name || user.username;
    });
  }
  
  // Update user avatar
  const userAvatarElements = document.querySelectorAll('.user-avatar');
  if (user && user.avatar_url && userAvatarElements.length > 0) {
    userAvatarElements.forEach(el => {
      el.setAttribute('src', user.avatar_url);
    });
  } else if (user && userAvatarElements.length > 0) {
    // Set default avatar with initials
    const initials = (user.full_name || user.username || 'U')
      .split(' ')
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    
    const avatarSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="%230ea5e9" rx="16" ry="16"/><text x="50%" y="50%" dy=".1em" font-family="Arial" font-size="16" fill="white" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
    
    userAvatarElements.forEach(el => {
      el.setAttribute('src', avatarSvg);
    });
  }
}

/**
 * Update UI for unauthenticated users
 */
function updateUnauthenticatedUI() {
  // Update navigation items
  const authButtons = document.querySelectorAll('.auth-buttons');
  const userMenus = document.querySelectorAll('.user-menu');
  
  // Show auth buttons, hide user menu
  authButtons.forEach(el => el.classList.remove('hidden'));
  userMenus.forEach(el => el.classList.add('hidden'));
  
  // Handle page-specific redirects if authentication is required
  const currentPath = window.location.pathname;
  if (currentPath.includes('/dashboard') || 
      currentPath.includes('/project/') || 
      currentPath.includes('/settings')) {
    // Redirect to login page
    window.location.href = '/login?redirect=' + encodeURIComponent(currentPath);
  }
}

/**
 * Initializes animations for elements as they scroll into view
 */
function initScrollAnimation() {
  const animatedElements = document.querySelectorAll('.animate-on-scroll');
  
  if (animatedElements.length === 0) return;
  
  // If animations are disabled in settings, activate all elements immediately
  if (!AoedeApp.settings.animationsEnabled) {
    animatedElements.forEach(element => {
      element.classList.add('animate-active');
    });
    return;
  }
  
  // Check if IntersectionObserver is supported
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-active');
          
          // Get animation type from data attribute
          const animation = entry.target.dataset.animation || 'fade-in';
          entry.target.classList.add(animation);
          
          // Unobserve after animation is triggered once
          observer.unobserve(entry.target);
        }
      });
    }, { 
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    animatedElements.forEach(element => {
      observer.observe(element);
    });
  } else {
    // Fallback for browsers that don't support IntersectionObserver
    animatedElements.forEach(element => {
      element.classList.add('animate-active');
    });
  }
}

/**
 * Adds syntax highlighting to code blocks
 */
function initCodeHighlighting() {
  const codeBlocks = document.querySelectorAll('pre code');
  if (codeBlocks.length === 0) return;
  
  // Check if a highlighting library is available (like Prism or Highlight.js)
  if (typeof Prism !== 'undefined') {
    Prism.highlightAll();
    return;
  }
  
  // Simple syntax highlighting using regular expressions as fallback
  codeBlocks.forEach(block => {
    try {
      let html = block.innerHTML;
      
      // Get language from class (e.g., "language-python")
      let language = '';
      block.classList.forEach(cls => {
        if (cls.startsWith('language-')) {
          language = cls.replace('language-', '');
        }
      });
      
      // Apply language-specific highlighting
      switch(language) {
        case 'python':
          html = highlightPython(html);
          break;
        case 'javascript':
          html = highlightJavaScript(html);
          break;
        default:
          html = highlightGeneric(html);
      }
      
      block.innerHTML = html;
      
      // Add copy button
      addCodeCopyButton(block.parentElement);
    } catch (error) {
      console.error('Error highlighting code block:', error);
    }
  });
}

/**
 * Highlights Python code
 */
function highlightPython(code) {
  // Keywords
  const keywords = ['def', 'class', 'import', 'from', 'as', 'return', 'if', 'else', 'elif', 'for', 'while', 'try', 'except', 'finally', 'with', 'async', 'await', 'lambda', 'yield', 'break', 'continue', 'pass', 'raise', 'in', 'is', 'not', 'and', 'or', 'True', 'False', 'None'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    code = code.replace(regex, `<span class="text-purple-500">${keyword}</span>`);
  });
  
  // Strings
  code = code.replace(/(".*?"|'.*?')/g, '<span class="text-green-500">$1</span>');
  
  // Comments
  code = code.replace(/(#.*)/g, '<span class="text-gray-500">$1</span>');
  
  // Function calls
  code = code.replace(/(\w+)\(/g, '<span class="text-blue-500">$1</span>(');
  
  return code;
}

/**
 * Highlights JavaScript code
 */
function highlightJavaScript(code) {
  // Keywords
  const keywords = ['function', 'return', 'if', 'else', 'for', 'while', 'class', 'const', 'let', 'var', 'typeof', 'new', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield', 'import', 'export', 'default'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    code = code.replace(regex, `<span class="text-purple-500">${keyword}</span>`);
  });
  
  // Strings
  code = code.replace(/(["'`])(.*?)\1/g, '<span class="text-green-500">$&</span>');
  
  // Comments
  code = code.replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, '<span class="text-gray-500">$1</span>');
  
  // Function calls
  code = code.replace(/(\w+)\(/g, '<span class="text-blue-500">$1</span>(');
  
  return code;
}

/**
 * Generic code highlighting for other languages
 */
function highlightGeneric(code) {
  // Common keywords across languages
  const keywords = ['function', 'return', 'if', 'else', 'for', 'while', 'class', 'const', 'static', 'private', 'public', 'protected', 'void', 'int', 'string', 'bool', 'true', 'false', 'null', 'new', 'try', 'catch'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    code = code.replace(regex, `<span class="text-purple-500">${keyword}</span>`);
  });
  
  // Strings
  code = code.replace(/(["'])(.*?)\1/g, '<span class="text-green-500">$&</span>');
  
  // Comments (C-style)
  code = code.replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, '<span class="text-gray-500">$1</span>');
  
  return code;
}

/**
 * Adds a copy button to code blocks
 */
function addCodeCopyButton(codeBlock) {
  // Check if it's a proper code block container
  if (!codeBlock || codeBlock.tagName !== 'PRE') return;
  
  // Create copy button
  const copyButton = document.createElement('button');
  copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
  copyButton.className = 'absolute top-2 right-2 p-2 rounded-md bg-gray-800 bg-opacity-50 text-gray-300 hover:bg-opacity-80 hover:text-white transition-all';
  copyButton.title = 'Copy code';
  
  // Position the code block container relatively if it's not already
  if (getComputedStyle(codeBlock).position === 'static') {
    codeBlock.style.position = 'relative';
  }
  
  // Add click event to copy code
  copyButton.addEventListener('click', () => {
    const code = codeBlock.querySelector('code').innerText;
    
    // Copy to clipboard
    navigator.clipboard.writeText(code).then(() => {
      // Success feedback
      copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
      copyButton.classList.add('bg-green-500', 'bg-opacity-80');
      
      // Reset after 2 seconds
      setTimeout(() => {
        copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
        copyButton.classList.remove('bg-green-500', 'bg-opacity-80');
      }, 2000);
    }).catch(err => {
      console.error('Error copying code:', err);
      copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
      copyButton.classList.add('bg-red-500', 'bg-opacity-80');
      
      setTimeout(() => {
        copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
        copyButton.classList.remove('bg-red-500', 'bg-opacity-80');
      }, 2000);
    });
  });
  
  // Add the copy button to the code block
  codeBlock.appendChild(copyButton);
}

/**
 * Refresh authentication token
 * @returns {Promise<boolean>} - Success status
 */
async function refreshToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  
  if (!refreshToken) {
    return false;
  }
  
  try {
    const response = await fetch(`${API_ENDPOINT}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

/**
 * Display notification message
 * @param {string} message - Notification message
 * @param {string} type - Notification type (success, error, warning, info)
 */
function showNotification(message, type = 'info') {
  const container = document.getElementById('notification-container');
  if (!container) return;
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span>${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;
  
  container.appendChild(notification);
  
  // Add animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 5000);
  
  // Close button
  const closeButton = notification.querySelector('.notification-close');
  closeButton.addEventListener('click', () => {
    notification.classList.remove('show');
    setTimeout(() => {
      notification.remove();
    }, 300);
  });
}

/**
 * Initialize code editors with syntax highlighting
 */
function initializeCodeEditors() {
  const codeEditors = document.querySelectorAll('[data-code-editor]');
  
  codeEditors.forEach(editor => {
    // You can add syntax highlighting or code editor initialization here
    // For simplicity, we're just adding some basic styling
    editor.classList.add('code-editor');
    
    // Add line numbers
    const codeText = editor.textContent;
    const lines = codeText.split('\n');
    let formattedCode = '';
    
    lines.forEach((line, index) => {
      formattedCode += `<div class="code-line"><span class="line-number">${index + 1}</span><span class="line-content">${line || ' '}</span></div>`;
    });
    
    editor.innerHTML = formattedCode;
  });
}

/**
 * Load user projects
 */
async function loadProjects() {
  const projectsContainer = document.getElementById('projects-container');
  const loadingEl = document.getElementById('projects-loading');
  
  if (!projectsContainer) return;
  
  try {
    if (loadingEl) loadingEl.classList.remove('hidden');
    
    const projects = await apiRequest('/projects');
    
    if (loadingEl) loadingEl.classList.add('hidden');
    
    if (!projects || projects.length === 0) {
      projectsContainer.innerHTML = `
        <div class="empty-state">
          <p>You don't have any projects yet.</p>
          <a href="/projects/new" class="btn-primary">Create Your First Project</a>
        </div>
      `;
      return;
    }
    
    projectsContainer.innerHTML = '';
    
    projects.forEach(project => {
      const projectCard = document.createElement('div');
      projectCard.className = 'project-card';
      projectCard.innerHTML = `
        <div class="project-header">
          <h3 class="project-title">${project.name}</h3>
          <div class="project-meta">
            <span>${formatDate(project.created_at)}</span>
            <span class="badge badge-${project.status}">${project.status}</span>
          </div>
        </div>
        <div class="project-body">
          <p class="project-description">${project.description || 'No description provided.'}</p>
          <div class="project-stats">
            <div class="project-stat">
              <span class="project-stat-value">${project.code_generations_count}</span>
              <span class="project-stat-label">Generations</span>
            </div>
          </div>
        </div>
        <div class="project-footer">
          <a href="/projects/${project.id}" class="btn-primary">View Project</a>
        </div>
      `;
      
      projectsContainer.appendChild(projectCard);
    });
    
  } catch (error) {
    console.error('Error loading projects:', error);
    if (loadingEl) loadingEl.classList.add('hidden');
    projectsContainer.innerHTML = `
      <div class="error-state">
        <p>Failed to load projects. Please try again.</p>
        <button class="btn-secondary" onclick="loadProjects()">Retry</button>
      </div>
    `;
  }
}

/**
 * Format date to human-readable format
 * @param {string} dateString - ISO date string
 * @returns {string} - Formatted date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  });
}

/**
 * Check API health status
 */
async function checkApiHealth() {
  try {
    const health = await fetch(`${API_ENDPOINT}/health`).then(res => res.json());
  } catch (error) {
    console.error('API health check failed:', error);
  }
}

/**
 * Update model status indicators
 */
async function updateModelStatus() {
  const statusElements = document.querySelectorAll('[data-model-status]');
  if (statusElements.length === 0) return;
  
  try {
    const response = await fetch(`${API_ENDPOINT}/models/status`);
    const statusData = await response.json();
    
    statusElements.forEach(element => {
      const modelName = element.getAttribute('data-model-status');
      const isOnline = statusData[modelName] === 'healthy';
      
      element.className = `model-status ${isOnline ? 'model-status-online' : 'model-status-offline'}`;
      element.innerHTML = `
        <span class="model-status-indicator"></span>
        ${isOnline ? 'Online' : 'Offline'}
      `;
    });
  } catch (error) {
    console.error('Failed to update model status:', error);
    statusElements.forEach(element => {
      element.className = 'model-status model-status-offline';
      element.innerHTML = `
        <span class="model-status-indicator"></span>
        Unknown
      `;
    });
  }
}

/**
 * Setup WebSocket connection for real-time updates
 * @param {string} endpoint - WebSocket endpoint
 * @param {Function} messageHandler - Function to handle messages
 */
function setupWebSocket(endpoint, messageHandler) {
  const token = localStorage.getItem('access_token');
  
  // Include token in WebSocket connection
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/${API_VERSION}${endpoint}`;
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    // Send authentication token
    if (token) {
      ws.send(JSON.stringify({ 
        type: 'authentication',
        token 
      }));
    }
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      messageHandler(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };
  
  ws.onclose = () => {
    // Attempt to reconnect after 3 seconds
    setTimeout(() => {
      setupWebSocket(endpoint, messageHandler);
    }, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
}

/**
 * Initializes the application when DOM is fully loaded
 */
document.addEventListener('DOMContentLoaded', function() {
  
  try {
    // Load saved settings from localStorage
    loadUserSettings();
    
    // Initialize UI components
    initializeUIComponents();
    
    // Mobile menu functionality
    initializeMobileMenu();

    // Theme toggle functionality
    initializeThemeToggle();

    // Initialize type effect for any elements with class 'type-effect'
    initTypeEffect();
    
    // Initialize scroll animations
    initScrollAnimation();
    
    // Initialize code syntax highlighting
    initCodeHighlighting();
    
    // Check API status and update banner
    checkApiStatus();
    
    // Initialize form validation
    initFormValidation();
    
    // Check authentication status
    checkAuthStatus();
    
    // Initialize any page-specific functionality
    initPageSpecific();
    
    // Log initialization success
  } catch (error) {
    // Handle initialization errors gracefully
    console.error('Error during application initialization:', error);
    
    // Show error notification to user if critical
    showNotification('Application initialization error. Please refresh the page.', 'error');
  }
});

/**
 * Loads user settings from localStorage
 */
function loadUserSettings() {
  try {
    const savedSettings = localStorage.getItem('aoede-settings');
    if (savedSettings) {
      const parsedSettings = JSON.parse(savedSettings);
      AoedeApp.settings = { ...AoedeApp.settings, ...parsedSettings };
    }
  } catch (error) {
    console.error('Error loading user settings:', error);
  }
}

/**
 * Initialize all UI components
 */
function initializeUIComponents() {
  // Initialize tooltips
  const tooltips = document.querySelectorAll('[data-tooltip]');
  tooltips.forEach(tooltip => {
    tooltip.addEventListener('mouseenter', showTooltip);
    tooltip.addEventListener('mouseleave', hideTooltip);
  });
  
  // Initialize dropdown menus
  const dropdowns = document.querySelectorAll('.dropdown-toggle');
  dropdowns.forEach(dropdown => {
    dropdown.addEventListener('click', toggleDropdown);
  });
  
  // Initialize tabs
  const tabButtons = document.querySelectorAll('[data-tab-target]');
  tabButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      activateTab(button.dataset.tabTarget);
    });
  });
  
  // Initialize modals
  const modalTriggers = document.querySelectorAll('[data-modal-target]');
  modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = trigger.dataset.modalTarget;
      openModal(modalId);
    });
  });
  
  // Close buttons for modals, alerts, etc.
  const closeButtons = document.querySelectorAll('.close-btn');
  closeButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const target = button.closest('.closable');
      if (target) {
        target.classList.add('hidden');
      }
    });
  });
}

/**
 * Initialize mobile menu functionality
 */
function initializeMobileMenu() {
  const mobileMenuButton = document.getElementById('mobile-menu-button');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }
}

/**
 * Initialize theme toggle functionality
 */
function initializeThemeToggle() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
  const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

  // Set the initial theme based on system preference or saved preference
  if (localStorage.getItem('color-theme') === 'dark' || 
      (!localStorage.getItem('color-theme') && 
      window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
    themeToggleLightIcon.classList.remove('hidden');
    AoedeApp.darkMode = true;
  } else {
    themeToggleDarkIcon.classList.remove('hidden');
    AoedeApp.darkMode = false;
  }

  // Toggle theme when button is clicked
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function() {
      // Toggle icons
      themeToggleDarkIcon.classList.toggle('hidden');
      themeToggleLightIcon.classList.toggle('hidden');
      
      // Toggle dark mode class
      document.documentElement.classList.toggle('dark');
      
      // Update application state
      AoedeApp.darkMode = document.documentElement.classList.contains('dark');
      
      // Update local storage
      localStorage.setItem('color-theme', AoedeApp.darkMode ? 'dark' : 'light');
      
      // Update code blocks if they exist
      updateCodeBlocksTheme();
      
    });
  }
}

/**
 * Creates typewriter effect for hero sections
 */
function initTypeEffect() {
  const typeElements = document.querySelectorAll('.type-effect');
  
  if (typeElements.length === 0) return;
  
  typeElements.forEach(element => {
    const text = element.getAttribute('data-text');
    if (!text) return;
    
    try {
      const textArray = JSON.parse(text);
      let currentTextIndex = 0;
      let currentCharIndex = 0;
      let isDeleting = false;
      let typingSpeed = 100;
      
      function type() {
        if (!AoedeApp.settings.animationsEnabled) {
          element.textContent = textArray[0];
          return;
        }
        
        const currentText = textArray[currentTextIndex];
        
        if (isDeleting) {
          element.textContent = currentText.substring(0, currentCharIndex - 1);
          currentCharIndex--;
          typingSpeed = 50;
        } else {
          element.textContent = currentText.substring(0, currentCharIndex + 1);
          currentCharIndex++;
          typingSpeed = 100;
        }
        
        if (!isDeleting && currentCharIndex === currentText.length) {
          isDeleting = true;
          typingSpeed = 1000; // Pause at end
        } else if (isDeleting && currentCharIndex === 0) {
          isDeleting = false;
          currentTextIndex = (currentTextIndex + 1) % textArray.length;
          typingSpeed = 500; // Pause before typing next
        }
        
        setTimeout(type, typingSpeed);
      }
      
      type();
    } catch (error) {
      console.error('Error in type effect:', error);
      element.textContent = text || 'Type effect error';
    }
  });
}

/**
 * Initializes animations for elements as they scroll into view
 */
function initScrollAnimation() {
  const animatedElements = document.querySelectorAll('.animate-on-scroll');
  
  if (animatedElements.length === 0) return;
  
  // If animations are disabled in settings, activate all elements immediately
  if (!AoedeApp.settings.animationsEnabled) {
    animatedElements.forEach(element => {
      element.classList.add('animate-active');
    });
    return;
  }
  
  // Check if IntersectionObserver is supported
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-active');
          
          // Get animation type from data attribute
          const animation = entry.target.dataset.animation || 'fade-in';
          entry.target.classList.add(animation);
          
          // Unobserve after animation is triggered once
          observer.unobserve(entry.target);
        }
      });
    }, { 
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    animatedElements.forEach(element => {
      observer.observe(element);
    });
  } else {
    // Fallback for browsers that don't support IntersectionObserver
    animatedElements.forEach(element => {
      element.classList.add('animate-active');
    });
  }
}

/**
 * Adds syntax highlighting to code blocks
 */
function initCodeHighlighting() {
  const codeBlocks = document.querySelectorAll('pre code');
  if (codeBlocks.length === 0) return;
  
  // Check if a highlighting library is available (like Prism or Highlight.js)
  if (typeof Prism !== 'undefined') {
    Prism.highlightAll();
    return;
  }
  
  // Simple syntax highlighting using regular expressions as fallback
  codeBlocks.forEach(block => {
    try {
      let html = block.innerHTML;
      
      // Get language from class (e.g., "language-python")
      let language = '';
      block.classList.forEach(cls => {
        if (cls.startsWith('language-')) {
          language = cls.replace('language-', '');
        }
      });
      
      // Apply language-specific highlighting
      switch(language) {
        case 'python':
          html = highlightPython(html);
          break;
        case 'javascript':
          html = highlightJavaScript(html);
          break;
        default:
          html = highlightGeneric(html);
      }
      
      block.innerHTML = html;
      
      // Add copy button
      addCodeCopyButton(block.parentElement);
    } catch (error) {
      console.error('Error highlighting code block:', error);
    }
  });
}

/**
 * Highlights Python code
 */
function highlightPython(code) {
  // Keywords
  const keywords = ['def', 'class', 'import', 'from', 'as', 'return', 'if', 'else', 'elif', 'for', 'while', 'try', 'except', 'finally', 'with', 'async', 'await', 'lambda', 'yield', 'break', 'continue', 'pass', 'raise', 'in', 'is', 'not', 'and', 'or', 'True', 'False', 'None'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    code = code.replace(regex, `<span class="text-purple-500">${keyword}</span>`);
  });
  
  // Strings
  code = code.replace(/(".*?"|'.*?')/g, '<span class="text-green-500">$1</span>');
  
  // Comments
  code = code.replace(/(#.*)/g, '<span class="text-gray-500">$1</span>');
  
  // Function calls
  code = code.replace(/(\w+)\(/g, '<span class="text-blue-500">$1</span>(');
  
  return code;
}

/**
 * Highlights JavaScript code
 */
function highlightJavaScript(code) {
  // Keywords
  const keywords = ['function', 'return', 'if', 'else', 'for', 'while', 'class', 'const', 'let', 'var', 'typeof', 'new', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'yield', 'import', 'export', 'default'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    code = code.replace(regex, `<span class="text-purple-500">${keyword}</span>`);
  });
  
  // Strings
  code = code.replace(/(["'`])(.*?)\1/g, '<span class="text-green-500">$&</span>');
  
  // Comments
  code = code.replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, '<span class="text-gray-500">$1</span>');
  
  // Function calls
  code = code.replace(/(\w+)\(/g, '<span class="text-blue-500">$1</span>(');
  
  return code;
}

/**
 * Generic code highlighting for other languages
 */
function highlightGeneric(code) {
  // Common keywords across languages
  const keywords = ['function', 'return', 'if', 'else', 'for', 'while', 'class', 'const', 'static', 'private', 'public', 'protected', 'void', 'int', 'string', 'bool', 'true', 'false', 'null', 'new', 'try', 'catch'];
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    code = code.replace(regex, `<span class="text-purple-500">${keyword}</span>`);
  });
  
  // Strings
  code = code.replace(/(["'])(.*?)\1/g, '<span class="text-green-500">$&</span>');
  
  // Comments (C-style)
  code = code.replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, '<span class="text-gray-500">$1</span>');
  
  return code;
}

/**
 * Adds a copy button to code blocks
 */
function addCodeCopyButton(codeBlock) {
  // Check if it's a proper code block container
  if (!codeBlock || codeBlock.tagName !== 'PRE') return;
  
  // Create copy button
  const copyButton = document.createElement('button');
  copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
  copyButton.className = 'absolute top-2 right-2 p-2 rounded-md bg-gray-800 bg-opacity-50 text-gray-300 hover:bg-opacity-80 hover:text-white transition-all';
  copyButton.title = 'Copy code';
  
  // Position the code block container relatively if it's not already
  if (getComputedStyle(codeBlock).position === 'static') {
    codeBlock.style.position = 'relative';
  }
  
  // Add click event to copy code
  copyButton.addEventListener('click', () => {
    const code = codeBlock.querySelector('code').innerText;
    
    // Copy to clipboard
    navigator.clipboard.writeText(code).then(() => {
      // Success feedback
      copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
      copyButton.classList.add('bg-green-500', 'bg-opacity-80');
      
      // Reset after 2 seconds
      setTimeout(() => {
        copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
        copyButton.classList.remove('bg-green-500', 'bg-opacity-80');
      }, 2000);
    }).catch(err => {
      console.error('Error copying code:', err);
      copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
      copyButton.classList.add('bg-red-500', 'bg-opacity-80');
      
      setTimeout(() => {
        copyButton.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
        copyButton.classList.remove('bg-red-500', 'bg-opacity-80');
      }, 2000);
    });
  });
  
  // Add the copy button to the code block
  codeBlock.appendChild(copyButton);
}

/**
 * Initialize form validation for all forms with the class 'validated-form'
 */
function initFormValidation() {
  const forms = document.querySelectorAll('.validated-form');
  
  if (forms.length === 0) return;
  
  forms.forEach(form => {
    form.addEventListener('submit', function(event) {
      if (!validateForm(form)) {
        event.preventDefault();
        event.stopPropagation();
      }
    });
    
    // Add validation to inputs on blur
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('blur', function() {
        validateInput(input);
      });
    });
  });
  
}

/**
 * Validate a specific form
 * @param {HTMLFormElement} form - The form to validate
 * @returns {boolean} True if form is valid, false otherwise
 */
function validateForm(form) {
  const inputs = form.querySelectorAll('input, select, textarea');
  let isValid = true;
  
  inputs.forEach(input => {
    if (!validateInput(input)) {
      isValid = false;
    }
  });
  
  return isValid;
}

/**
 * Validate a specific input
 * @param {HTMLInputElement} input - The input to validate
 * @returns {boolean} True if input is valid, false otherwise
 */
function validateInput(input) {
  // Skip disabled inputs or those without validation
  if (input.disabled || !input.hasAttribute('required')) {
    return true;
  }
  
  const value = input.value.trim();
  const type = input.getAttribute('type');
  const errorContainer = input.parentElement.querySelector('.error-message');
  let isValid = true;
  let errorMessage = '';
  
  // Clear previous validation state
  input.classList.remove('border-red-500', 'border-green-500');
  if (errorContainer) {
    errorContainer.textContent = '';
  }
  
  // Check for empty required fields
  if (input.hasAttribute('required') && value === '') {
    isValid = false;
    errorMessage = 'This field is required';
  }
  // Email validation
  else if (type === 'email' && value !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      isValid = false;
      errorMessage = 'Please enter a valid email address';
    }
  }
  // Password validation
  else if (type === 'password' && value !== '') {
    const minLength = input.getAttribute('data-min-length') || 8;
    if (value.length < minLength) {
      isValid = false;
      errorMessage = `Password must be at least ${minLength} characters long`;
    }
  }
  // URL validation
  else if (type === 'url' && value !== '') {
    try {
      new URL(value);
    } catch (e) {
      isValid = false;
      errorMessage = 'Please enter a valid URL';
    }
  }
  // Check matching fields (like password confirmation)
  else if (input.hasAttribute('data-match')) {
    const matchSelector = input.getAttribute('data-match');
    const matchInput = document.querySelector(matchSelector);
    if (matchInput && value !== matchInput.value) {
      isValid = false;
      errorMessage = 'Fields do not match';
    }
  }
  
  // Update UI based on validation result
  if (!isValid) {
    input.classList.add('border-red-500');
    if (errorContainer) {
      errorContainer.textContent = errorMessage;
    } else {
      // Create error container if it doesn't exist
      const newErrorContainer = document.createElement('p');
      newErrorContainer.className = 'error-message text-red-500 text-xs mt-1';
      newErrorContainer.textContent = errorMessage;
      input.parentElement.appendChild(newErrorContainer);
    }
  } else if (value !== '') {
    input.classList.add('border-green-500');
  }
  
  return isValid;
}

/**
 * Initialize page-specific features based on current page
 */
function initPageSpecific() {
  const path = window.location.pathname;
  
  // Home page
  if (path === '/' || path === '/index.html') {
    initHomePage();
  }
  // Dashboard page
  else if (path === '/dashboard') {
    initDashboardPage();
  }
  // Login page
  else if (path === '/login') {
    initLoginPage();
  }
  // Register page
  else if (path === '/register') {
    initRegisterPage();
  }
  // About page
  else if (path === '/about') {
    initAboutPage();
  }
  // Features page
  else if (path === '/features') {
    initFeaturesPage();
  }
  // Contact page
  else if (path === '/contact') {
    initContactPage();
  }
  // Settings page
  else if (path === '/settings') {
    initSettingsPage();
  }
}

/**
 * Initialize home page features
 */
function initHomePage() {
  
  // Demo code typing effect (enhanced version of the one already in the page)
  const demoCode = document.querySelector('.code-block pre code');
  if (demoCode) {
    setTimeout(() => {
      demoCode.classList.add('highlight-animate');
    }, 1000);
  }
  
  // Add click handlers for CTA buttons
  const ctaButtons = document.querySelectorAll('.hero-cta-btn');
  ctaButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.currentTarget.getAttribute('href') === '#demo') {
        e.preventDefault();
               const demoSection = document.querySelector('#demo-section');
        if (demoSection) {
          demoSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
}

/**
 * Initialize dashboard page
 */
function initDashboardPage() {
  // Check if ApiService and initializeDashboard are available
  if (typeof ApiService !== 'undefined' && typeof initializeDashboard === 'function') {
    initializeDashboard();
  } else {
    console.error('Dashboard initialization failed: required modules not loaded');
  }
}

/**
 * Initialize login page features
 */
function initLoginPage() {
  const loginForm = document.getElementById('login-form');
  
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!validateForm(loginForm)) {
        return;
      }
      
      const email = loginForm.querySelector('#email').value;
      const password = loginForm.querySelector('#password').value;
      const rememberMe = loginForm.querySelector('#remember-me')?.checked || false;
      
      try {
        if (typeof ApiService !== 'undefined') {
          await ApiService.login(email, password, rememberMe);
          window.location.href = '/dashboard';
        } else {
          console.error('ApiService not found');
        }
      } catch (error) {
        showNotification(error.message || 'Login failed', 'error');
      }
    });
  }
}

/**
 * Initialize register page features
 */
function initRegisterPage() {
  const registerForm = document.getElementById('register-form');
  
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!validateForm(registerForm)) {
        return;
      }
      
      const fullName = registerForm.querySelector('#full_name').value;
      const email = registerForm.querySelector('#email').value;
      const password = registerForm.querySelector('#password').value;
      const confirmPassword = registerForm.querySelector('#confirm_password').value;
      
      if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
      }
      
      try {
        if (typeof ApiService !== 'undefined') {
          await ApiService.register({
            full_name: fullName,
            email: email,
            password: password
          });
          window.location.href = '/login?registered=true';
        } else {
          console.error('ApiService not found');
        }
      } catch (error) {
        showNotification(error.message || 'Registration failed', 'error');
      }
    });
  }
}

/**
 * Initialize features page
 */
function initFeaturesPage() {
  // Initialize feature tabs if they exist
  const tabButtons = document.querySelectorAll('.feature-tab-button');
  const tabContents = document.querySelectorAll('.feature-tab-content');
  
  if (tabButtons.length > 0 && tabContents.length > 0) {
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const target = button.getAttribute('data-tab');
        
        // Hide all tab contents and show the selected one
        tabContents.forEach(content => {
          content.classList.add('hidden');
          if (content.getAttribute('id') === target) {
            content.classList.remove('hidden');
          }
        });
        
        // Update active state of tab buttons
        tabButtons.forEach(btn => {
          btn.classList.remove('active', 'border-primary-500');
          btn.classList.add('border-transparent');
        });
        button.classList.add('active', 'border-primary-500');
        button.classList.remove('border-transparent');
      });
    });
    
    // Activate first tab by default
    tabButtons[0].click();
  }
}

/**
 * Initialize about page
 */
function initAboutPage() {
  // Timeline animation if applicable
  const timelineItems = document.querySelectorAll('.timeline-item');
  
  if (timelineItems.length > 0) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('timeline-visible');
        }
      });
    }, { threshold: 0.2 });
    
    timelineItems.forEach(item => {
      observer.observe(item);
    });
  }
}

/**
 * Initialize contact page
 */
function initContactPage() {
  const contactForm = document.getElementById('contact-form');
  
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (!validateForm(contactForm)) {
        return;
      }
      
      const name = contactForm.querySelector('#name').value;
      const email = contactForm.querySelector('#email').value;
      const message = contactForm.querySelector('#message').value;
      const submitButton = contactForm.querySelector('button[type="submit"]');
      
      try {
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
        
        if (typeof ApiService !== 'undefined') {
          await ApiService.sendContactMessage({
            name: name,
            email: email,
            message: message
          });
          
          // Reset form and show success message
          contactForm.reset();
          showNotification('Your message has been sent. We will contact you soon.', 'success');
        } else {
          console.error('ApiService not found');
        }
      } catch (error) {
        showNotification(error.message || 'Failed to send message', 'error');
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Send Message';
      }
    });
  }
}

/**
 * Initialize settings page
 */
function initSettingsPage() {
  if (typeof initializeSettings === 'function') {
    initializeSettings();
  } else {
    console.error('Settings initialization failed: required module not loaded');
  }
}
