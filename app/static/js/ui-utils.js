/**
 * Aoede - Enterprise AI No-Code Agent Platform
 * UI Utilities for enhanced user interface elements
 * 
 * @author Pradyumn Tandon (Gamecooler19)
 * @organization Kanopus
 * @website https://aoede.kanopus.org
 * @version 1.0.0
 */

const UiUtils = {
  /**
   * Initialize all UI utilities
   */
  init() {
    this.initTooltips();
    this.initDropdowns();
    this.initModals();
    this.initCodeBlocks();
    this.initTabs();
    this.initCollapsibles();
    this.initNotifications();
    this.initCopyButtons();
  },
  
  /**
   * Initialize tooltips
   */
  initTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(element => {
      element.addEventListener('mouseenter', () => {
        const tooltipText = element.getAttribute('data-tooltip');
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip absolute z-50 px-2 py-1 text-xs bg-gray-800 text-white rounded shadow-lg transition-opacity';
        tooltip.textContent = tooltipText;
        tooltip.style.opacity = '0';
        document.body.appendChild(tooltip);
        
        // Position the tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
        tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        
        // Show tooltip with animation
        setTimeout(() => {
          tooltip.style.opacity = '1';
        }, 10);
        
        // Store tooltip reference
        element._tooltip = tooltip;
      });
      
      element.addEventListener('mouseleave', () => {
        if (element._tooltip) {
          // Hide with animation
          element._tooltip.style.opacity = '0';
          
          // Remove after animation
          setTimeout(() => {
            if (element._tooltip.parentNode) {
              element._tooltip.parentNode.removeChild(element._tooltip);
            }
            element._tooltip = null;
          }, 200);
        }
      });
    });
  },
  
  /**
   * Initialize dropdown menus
   */
  initDropdowns() {
    document.querySelectorAll('.dropdown').forEach(dropdown => {
      const trigger = dropdown.querySelector('.dropdown-trigger');
      const menu = dropdown.querySelector('.dropdown-menu');
      
      if (!trigger || !menu) return;
      
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Close all other dropdowns
        document.querySelectorAll('.dropdown-menu.active').forEach(activeMenu => {
          if (activeMenu !== menu) {
            activeMenu.classList.remove('active');
          }
        });
        
        // Toggle this dropdown
        menu.classList.toggle('active');
      });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.dropdown-menu.active').forEach(menu => {
        menu.classList.remove('active');
      });
    });
  },
  
  /**
   * Initialize modal dialogs
   */
  initModals() {
    // Modal triggers
    document.querySelectorAll('[data-modal]').forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        
        const modalId = trigger.getAttribute('data-modal');
        this.openModal(modalId);
      });
    });
    
    // Close buttons
    document.querySelectorAll('.modal-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        const modal = closeBtn.closest('.modal');
        if (modal) {
          this.closeModal(modal.id);
        }
      });
    });
    
    // Close on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id);
        }
      });
    });
    
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal.open');
        if (openModal) {
          this.closeModal(openModal.id);
        }
      }
    });
  },
  
  /**
   * Open a modal by ID
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.add('open');
    document.body.classList.add('modal-open');
    
    // Trigger open event
    modal.dispatchEvent(new CustomEvent('modal:open'));
  },
  
  /**
   * Close a modal by ID
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('open');
    document.body.classList.remove('modal-open');
    
    // Trigger close event
    modal.dispatchEvent(new CustomEvent('modal:close'));
  },
  
  /**
   * Initialize code block enhancements
   */
  initCodeBlocks() {
    document.querySelectorAll('pre code').forEach(codeBlock => {
      // Create code block wrapper if not already wrapped
      let pre = codeBlock.parentElement;
      if (!pre.parentElement.classList.contains('code-block-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper relative';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
      }
      
      // Add copy button
      this.addCodeBlockCopyButton(pre);
      
      // Add language badge if available
      const language = this.getCodeBlockLanguage(codeBlock);
      if (language) {
        this.addCodeBlockLanguageBadge(pre, language);
      }
    });
  },
  
  /**
   * Get code block language from class
   */
  getCodeBlockLanguage(codeBlock) {
    let language = '';
    const classes = codeBlock.className.split(' ');
    
    classes.forEach(cls => {
      if (cls.startsWith('language-')) {
        language = cls.replace('language-', '');
      }
    });
    
    return language;
  },
  
  /**
   * Add copy button to code block
   */
  addCodeBlockCopyButton(preElement) {
    // Create copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn absolute top-2 right-2 p-2 rounded-md bg-gray-700 bg-opacity-50 hover:bg-opacity-100 text-gray-300 hover:text-white transition-all focus:outline-none';
    copyBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
    copyBtn.title = 'Copy to clipboard';
    
    // Add click handler
    copyBtn.addEventListener('click', () => {
      const codeText = preElement.querySelector('code').textContent;
      
      navigator.clipboard.writeText(codeText).then(() => {
        copyBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
        copyBtn.classList.add('bg-green-500');
        copyBtn.classList.remove('bg-gray-700');
        
        // Reset after 2 seconds
        setTimeout(() => {
          copyBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
          copyBtn.classList.remove('bg-green-500');
          copyBtn.classList.add('bg-gray-700');
        }, 2000);
      }).catch(err => {
        console.error('Copy failed:', err);
        copyBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
        copyBtn.classList.add('bg-red-500');
        copyBtn.classList.remove('bg-gray-700');
        
        // Reset after 2 seconds
        setTimeout(() => {
          copyBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';
          copyBtn.classList.remove('bg-red-500');
          copyBtn.classList.add('bg-gray-700');
        }, 2000);
      });
    });
    
    // Add button to code block
    preElement.parentNode.appendChild(copyBtn);
  },
  
  /**
   * Add language badge to code block
   */
  addCodeBlockLanguageBadge(preElement, language) {
    // Create language badge
    const badge = document.createElement('div');
    badge.className = 'code-language-badge absolute top-2 left-2 px-2 py-1 rounded text-xs bg-gray-700 bg-opacity-50 text-gray-300';
    badge.textContent = language;
    
    // Add badge to code block
    preElement.parentNode.appendChild(badge);
  },
  
  /**
   * Initialize tabs
   */
  initTabs() {
    document.querySelectorAll('.tabs').forEach(tabContainer => {
      const tabButtons = tabContainer.querySelectorAll('.tab-button');
      const tabPanels = tabContainer.querySelectorAll('.tab-panel');
      
      // Set initial active tab
      let activeIndex = 0;
      tabButtons.forEach((btn, index) => {
        if (btn.classList.contains('active')) {
          activeIndex = index;
        }
      });
      
      // Show initial active tab panel
      tabButtons[activeIndex].classList.add('active');
      tabPanels[activeIndex].classList.add('active');
      
      // Add click handlers
      tabButtons.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          
          // Deactivate all tabs
          tabButtons.forEach(b => b.classList.remove('active'));
          tabPanels.forEach(p => p.classList.remove('active'));
          
          // Activate clicked tab
          btn.classList.add('active');
          tabPanels[index].classList.add('active');
        });
      });
    });
  },
  
  /**
   * Initialize collapsible elements
   */
  initCollapsibles() {
    document.querySelectorAll('.collapsible').forEach(collapsible => {
      const trigger = collapsible.querySelector('.collapsible-trigger');
      const content = collapsible.querySelector('.collapsible-content');
      
      if (!trigger || !content) return;
      
      // Set initial state
      if (collapsible.classList.contains('open')) {
        content.style.maxHeight = content.scrollHeight + 'px';
      } else {
        content.style.maxHeight = '0';
      }
      
      // Add click handler
      trigger.addEventListener('click', () => {
        collapsible.classList.toggle('open');
        
        if (collapsible.classList.contains('open')) {
          content.style.maxHeight = content.scrollHeight + 'px';
        } else {
          content.style.maxHeight = '0';
        }
      });
    });
  },
  
  /**
   * Initialize notifications system
   */
  initNotifications() {
    // Create notifications container if not exists
    if (!document.getElementById('notifications-container')) {
      const container = document.createElement('div');
      container.id = 'notifications-container';
      container.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none';
      document.body.appendChild(container);
    }
  },
  
  /**
   * Show notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, warning, info)
   * @param {number} duration - Duration in milliseconds (default: 5000, 0 for persistent)
   */
  showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notifications-container');
    if (!container) return;
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification flex items-center p-4 rounded-lg shadow-lg transform translate-x-full opacity-0 transition-all duration-300 pointer-events-auto';
    
    // Set background color based on type
    switch (type) {
      case 'success':
        notification.classList.add('bg-green-500', 'text-white');
        break;
      case 'error':
        notification.classList.add('bg-red-500', 'text-white');
        break;
      case 'warning':
        notification.classList.add('bg-yellow-500', 'text-white');
        break;
      case 'info':
      default:
        notification.classList.add('bg-blue-500', 'text-white');
        break;
    }
    
    // Add icon based on type
    let icon = '';
    switch (type) {
      case 'success':
        icon = '<svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
        break;
      case 'error':
        icon = '<svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
        break;
      case 'warning':
        icon = '<svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
        break;
      case 'info':
      default:
        icon = '<svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';
        break;
    }
    
    // Set content
    notification.innerHTML = `
      ${icon}
      <div class="flex-1 mr-2">${message}</div>
      <button class="ml-2 focus:outline-none">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    `;
    
    // Add to container
    container.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.classList.remove('translate-x-full', 'opacity-0');
    }, 10);
    
    // Add close button functionality
    const closeBtn = notification.querySelector('button');
    closeBtn.addEventListener('click', () => {
      this.closeNotification(notification);
    });
    
    // Auto-close after duration (if not persistent)
    if (duration > 0) {
      setTimeout(() => {
        this.closeNotification(notification);
      }, duration);
    }
    
    return notification;
  },
  
  /**
   * Close notification
   */
  closeNotification(notification) {
    // Animate out
    notification.classList.add('translate-x-full', 'opacity-0');
    
    // Remove after animation
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  },
  
  /**
   * Initialize copy buttons
   */
  initCopyButtons() {
    document.querySelectorAll('.copy-button').forEach(button => {
      button.addEventListener('click', () => {
        const textToCopy = button.getAttribute('data-copy-text');
        if (!textToCopy) return;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
          // Store original text/HTML
          const originalContent = button.innerHTML;
          
          // Show success state
          button.innerHTML = '<svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Copied!';
          button.classList.add('bg-green-500', 'text-white');
          
          // Reset after 2 seconds
          setTimeout(() => {
            button.innerHTML = originalContent;
            button.classList.remove('bg-green-500', 'text-white');
          }, 2000);
        }).catch(err => {
          console.error('Copy failed:', err);
          
          // Store original text/HTML
          const originalContent = button.innerHTML;
          
          // Show error state
          button.innerHTML = '<svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg> Failed';
          button.classList.add('bg-red-500', 'text-white');
          
          // Reset after 2 seconds
          setTimeout(() => {
            button.innerHTML = originalContent;
            button.classList.remove('bg-red-500', 'text-white');
          }, 2000);
        });
      });
    });
  },
  
  /**
   * Format date
   * @param {string|Date} date - Date to format
   * @param {string} format - Format style (default 'medium')
   */
  formatDate(date, format = 'medium') {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(dateObj)) {
      return 'Invalid date';
    }
    
    switch(format) {
      case 'short':
        return dateObj.toLocaleDateString();
      case 'long':
        return dateObj.toLocaleDateString(undefined, { 
          weekday: 'long',
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        });
      case 'time':
        return dateObj.toLocaleTimeString();
      case 'datetime':
        return `${dateObj.toLocaleDateString()} ${dateObj.toLocaleTimeString()}`;
      case 'relative':
        return this.getRelativeTimeString(dateObj);
      case 'medium':
      default:
        return dateObj.toLocaleDateString(undefined, { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric'
        });
    }
  },
  
  /**
   * Get relative time string (e.g., "2 hours ago")
   */
  getRelativeTimeString(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    if (diffSecs < 60) {
      return diffSecs <= 1 ? 'just now' : `${diffSecs} seconds ago`;
    } else if (diffMins < 60) {
      return diffMins === 1 ? '1 minute ago' : `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;
    } else if (diffWeeks < 4) {
      return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
    } else if (diffMonths < 12) {
      return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
    } else {
      return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
    }
  }
};

// Export to window
window.UiUtils = UiUtils;
