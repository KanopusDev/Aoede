/**
 * Enterprise UI Manager
 * Handles all UI interactions and state management
 */
class UIManager {
    constructor() {
        this.currentView = 'dashboard';
        this.modals = {};
        this.forms = {};
        this.components = {};
        this.isProduction = true;
        
        this.init();
    }

    init() {
        this.initializeModals();
        this.initializeForms();
        this.initializeNavigation();
        this.initializeComponents();
        this.initializeEnhancedFeatures();
        
        // Set initial view
        this.navigateToView('dashboard');
    }

    /**
     * Initialize all modals with enhanced styling
     */
    initializeModals() {
        const modalElements = document.querySelectorAll('.modal-overlay, [data-modal]');
        const self = this;
        
        modalElements.forEach(function(modal) {
            const modalId = modal.id || modal.getAttribute('data-modal');
            if (modalId) {
                self.modals[modalId] = {
                    element: modal,
                    isOpen: false
                };
                
                // Add click outside to close
                modal.addEventListener('click', function(e) {
                    if (e.target === modal) {
                        self.closeModal(modalId);
                    }
                });
                
                // Add escape key to close
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape' && self.modals[modalId].isOpen) {
                        self.closeModal(modalId);
                    }
                });
            }
        });
    }

    /**
     * Initialize all forms with enhanced validation
     */
    initializeForms() {
        const formElements = document.querySelectorAll('form[data-form], form[id]');
        const self = this;
        
        formElements.forEach(function(form) {
            const formId = form.getAttribute('data-form') || form.id;
            if (formId) {
                self.forms[formId] = {
                    element: form,
                    isValid: false
                };
                
                // Add form validation and submission
                form.addEventListener('submit', function(e) {
                    e.preventDefault();
                    self.handleFormSubmit(formId, form);
                });
                
                // Add real-time validation
                self.setupFormValidation(form);
            }
        });
    }    /**
     * Initialize navigation with enhanced animations
     */
    initializeNavigation() {
        const navItems = document.querySelectorAll('[data-section], .nav-link, .mobile-nav-link');
        const self = this;
        
        navItems.forEach(function(item) {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const section = item.getAttribute('data-section');
                if (section) {
                    self.navigateToView(section);
                }
            });
        });

        // Initialize mobile navigation
        this.initializeMobileNavigation();
    }

    /**
     * Initialize mobile navigation
     */
    initializeMobileNavigation() {
        const mobileToggle = document.querySelector('.mobile-nav-toggle');
        const mobileMenu = document.querySelector('.mobile-nav-menu');
        
        if (mobileToggle && mobileMenu) {
            mobileToggle.addEventListener('click', function(e) {
                e.preventDefault();
                mobileMenu.classList.toggle('show');
                mobileToggle.classList.toggle('active');
            });

            // Close mobile menu on link click
            const mobileLinks = mobileMenu.querySelectorAll('.mobile-nav-link');
            mobileLinks.forEach(function(link) {
                link.addEventListener('click', function() {
                    mobileMenu.classList.remove('show');
                    mobileToggle.classList.remove('active');
                });
            });
        }
    }

    /**
     * Initialize UI components with enhanced features
     */
    initializeComponents() {
        this.initializeDropdowns();
        this.initializeTabs();
        this.initializeTooltips();
        this.initializeProgressBars();
        this.initializeCodeBlocks();
    }

    /**
     * Initialize enhanced features
     */
    initializeEnhancedFeatures() {
        this.initializeAnimations();
        this.initializeAccessibility();
        this.initializePerformanceOptimizations();
    }    /**
     * Navigate to a specific view with enhanced animations
     */
    navigateToView(viewName) {
        // Hide all sections with fade out
        const sections = document.querySelectorAll('.section');
        const activeSection = document.querySelector('.section.active');
        
        if (activeSection) {
            activeSection.style.opacity = '0';
            activeSection.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                sections.forEach(function(section) {
                    section.classList.add('hidden');
                    section.classList.remove('active');
                    section.style.opacity = '';
                    section.style.transform = '';
                });
                
                // Show target section with animation
                const targetSection = document.getElementById(viewName);
                if (targetSection) {
                    targetSection.classList.remove('hidden');
                    targetSection.classList.add('active');
                    targetSection.style.opacity = '0';
                    targetSection.style.transform = 'translateY(20px)';
                    
                    // Trigger animation
                    setTimeout(() => {
                        targetSection.style.transition = 'all 0.5s ease-out';
                        targetSection.style.opacity = '1';
                        targetSection.style.transform = 'translateY(0)';
                    }, 50);
                    
                    this.currentView = viewName;
                }
                
                // Update navigation
                this.updateNavigation(viewName);
            }, 200);
        } else {
            // Direct switch for initial load
            sections.forEach(function(section) {
                section.classList.add('hidden');
                section.classList.remove('active');
            });
            
            const targetSection = document.getElementById(viewName);
            if (targetSection) {
                targetSection.classList.remove('hidden');
                targetSection.classList.add('active');
                this.currentView = viewName;
            }
            
            this.updateNavigation(viewName);
        }
    }/**
     * Update navigation state
     */
    updateNavigation(activeView) {
        const navItems = document.querySelectorAll('[data-section]');
        
        navItems.forEach(function(item) {
            const section = item.getAttribute('data-section');
            if (section === activeView) {
                item.classList.add('nav-active');
                item.classList.add('active');
            } else {
                item.classList.remove('nav-active');
                item.classList.remove('active');
            }
        });
    }    /**
     * Open modal with enhanced animations
     */
    openModal(modalId) {
        const modal = this.modals[modalId];
        if (modal) {
            modal.element.classList.remove('hidden');
            modal.element.classList.add('show');
            modal.isOpen = true;
            document.body.style.overflow = 'hidden';
            
            // Focus management for accessibility
            const firstInput = modal.element.querySelector('input, button, textarea, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    /**
     * Close modal with enhanced animations
     */
    closeModal(modalId) {
        const modal = this.modals[modalId];
        if (modal) {
            modal.element.classList.remove('show');
            modal.isOpen = false;
            
            setTimeout(() => {
                modal.element.classList.add('hidden');
                document.body.style.overflow = '';
            }, 300);
        }
    }

    /**
     * Show enhanced toast notification
     */
    showToast(message, type) {
        type = type || 'info';
        
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toastContainer';
            toastContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `alert alert-${type} animate-slide-down`;
        toast.innerHTML = `
            <div class="alert-icon">
                <i class="fas ${this.getToastIcon(type)}"></i>
            </div>
            <div class="alert-content">
                <span>${message}</span>
            </div>
            <button class="alert-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toastContainer.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(function() {
            if (toast.parentNode) {
                toast.style.animation = 'slideUp 0.3s ease-out';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }    /**
     * Handle form submission with enhanced validation
     */
    handleFormSubmit(formId, formElement) {
        if (!this.validateForm(formElement)) {
            this.showToast('Please correct the errors in the form', 'error');
            return;
        }

        const formData = new FormData(formElement);
        const data = {};
        
        for (var pair of formData.entries()) {
            data[pair[0]] = pair[1];
        }

        // Show loading state
        const submitButton = formElement.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.classList.add('loading');
            const originalText = submitButton.textContent;
            submitButton.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Processing...';
            
            // Reset after 30 seconds as failsafe
            setTimeout(() => {
                submitButton.disabled = false;
                submitButton.classList.remove('loading');
                submitButton.textContent = originalText;
            }, 30000);
        }

        // Emit custom event
        window.dispatchEvent(new CustomEvent('form:submit', {
            detail: { formId: formId, data: data }
        }));
    }

    /**
     * Setup form validation
     */
    setupFormValidation(form) {
        const inputs = form.querySelectorAll('input, textarea, select');
        const self = this;
        
        inputs.forEach(function(input) {
            input.addEventListener('blur', function() {
                self.validateField(input);
            });
            
            input.addEventListener('input', function() {
                if (input.classList.contains('is-invalid')) {
                    self.validateField(input);
                }
            });
        });
    }

    /**
     * Validate individual field
     */
    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        // Required field validation
        if (field.hasAttribute('required') && !value) {
            isValid = false;
            errorMessage = 'This field is required';
        }

        // Email validation
        if (field.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
        }

        // Password validation
        if (field.type === 'password' && value && value.length < 8) {
            isValid = false;
            errorMessage = 'Password must be at least 8 characters';
        }

        // Update field state
        this.updateFieldState(field, isValid, errorMessage);
        return isValid;
    }

    /**
     * Update field validation state
     */
    updateFieldState(field, isValid, errorMessage) {
        const feedbackElement = field.parentNode.querySelector('.form-validation-feedback');
        
        if (isValid) {
            field.classList.remove('is-invalid');
            field.classList.add('is-valid');
            if (feedbackElement) {
                feedbackElement.textContent = '';
                feedbackElement.classList.remove('invalid');
                feedbackElement.classList.add('valid');
            }
        } else {
            field.classList.remove('is-valid');
            field.classList.add('is-invalid');
            if (feedbackElement) {
                feedbackElement.textContent = errorMessage;
                feedbackElement.classList.remove('valid');
                feedbackElement.classList.add('invalid');
            }
        }
    }

    /**
     * Validate entire form
     */
    validateForm(form) {
        const inputs = form.querySelectorAll('input, textarea, select');
        let isFormValid = true;
        
        inputs.forEach((input) => {
            if (!this.validateField(input)) {
                isFormValid = false;
            }
        });
        
        return isFormValid;
    }

    /**
     * Initialize dropdowns
     */
    initializeDropdowns() {
        const dropdowns = document.querySelectorAll('[data-dropdown]');
        
        dropdowns.forEach(function(dropdown) {
            const trigger = dropdown.querySelector('[data-dropdown-trigger]');
            const menu = dropdown.querySelector('[data-dropdown-menu]');
            
            if (trigger && menu) {
                trigger.addEventListener('click', function(e) {
                    e.preventDefault();
                    menu.classList.toggle('hidden');
                });

                // Close on outside click
                document.addEventListener('click', function(e) {
                    if (!dropdown.contains(e.target)) {
                        menu.classList.add('hidden');
                    }
                });
            }
        });
    }

    /**
     * Initialize tabs
     */
    initializeTabs() {
        const tabGroups = document.querySelectorAll('[data-tabs]');
        
        tabGroups.forEach(function(tabGroup) {
            const tabs = tabGroup.querySelectorAll('[data-tab]');
            const panels = tabGroup.querySelectorAll('[data-tab-panel]');
            
            tabs.forEach(function(tab) {
                tab.addEventListener('click', function(e) {
                    e.preventDefault();
                    const targetId = tab.getAttribute('data-tab');
                    
                    // Update tabs
                    tabs.forEach(function(t) {
                        t.classList.remove('tab-active');
                    });
                    tab.classList.add('tab-active');
                    
                    // Update panels
                    panels.forEach(function(panel) {
                        if (panel.id === targetId) {
                            panel.classList.remove('hidden');
                        } else {
                            panel.classList.add('hidden');
                        }
                    });
                });
            });
        });
    }    /**
     * Initialize enhanced tooltips
     */
    initializeTooltips() {
        const tooltips = document.querySelectorAll('[data-tooltip], .tooltip');
        
        tooltips.forEach(function(element) {
            const tooltipText = element.getAttribute('data-tooltip') || element.getAttribute('title');
            
            if (tooltipText) {
                element.addEventListener('mouseenter', function() {
                    const tooltip = document.createElement('div');
                    tooltip.className = 'tooltip-text';
                    tooltip.textContent = tooltipText;
                    document.body.appendChild(tooltip);
                    
                    // Position tooltip
                    const rect = element.getBoundingClientRect();
                    const tooltipRect = tooltip.getBoundingClientRect();
                    
                    tooltip.style.position = 'fixed';
                    tooltip.style.left = Math.max(10, rect.left + (rect.width / 2) - (tooltipRect.width / 2)) + 'px';
                    tooltip.style.top = rect.top - tooltipRect.height - 10 + 'px';
                    tooltip.style.zIndex = '1000';
                    
                    element._tooltip = tooltip;
                });
                
                element.addEventListener('mouseleave', function() {
                    if (element._tooltip) {
                        document.body.removeChild(element._tooltip);
                        element._tooltip = null;
                    }
                });
            }
        });
    }

    /**
     * Initialize progress bars
     */
    initializeProgressBars() {
        const progressBars = document.querySelectorAll('.progress-bar');
        
        progressBars.forEach(function(bar) {
            const progress = bar.getAttribute('data-progress') || 0;
            bar.style.width = '0%';
            
            setTimeout(() => {
                bar.style.width = progress + '%';
            }, 100);
        });
    }

    /**
     * Initialize code blocks
     */
    initializeCodeBlocks() {
        const codeBlocks = document.querySelectorAll('.code-block-container');
        
        codeBlocks.forEach(function(container) {
            // Add copy button if not exists
            if (!container.querySelector('.code-copy-btn')) {
                const copyBtn = document.createElement('button');
                copyBtn.className = 'code-copy-btn';
                copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                copyBtn.addEventListener('click', function() {
                    const codeElement = container.querySelector('pre, code');
                    if (codeElement) {
                        navigator.clipboard.writeText(codeElement.textContent).then(() => {
                            copyBtn.innerHTML = '<i class="fas fa-check"></i>';
                            copyBtn.classList.add('btn-success');
                            setTimeout(() => {
                                copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
                                copyBtn.classList.remove('btn-success');
                            }, 2000);
                        });
                    }
                });
                container.appendChild(copyBtn);
            }
        });
    }

    /**
     * Initialize animations
     */
    initializeAnimations() {
        // Intersection observer for scroll animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-scale');
                }
            });
        }, { threshold: 0.1 });

        const animatedElements = document.querySelectorAll('.feature-card, .project-card, .model-card');
        animatedElements.forEach(el => observer.observe(el));
    }

    /**
     * Initialize accessibility features
     */
    initializeAccessibility() {
        // Add skip link
        const skipLink = document.createElement('a');
        skipLink.href = '#main-content';
        skipLink.textContent = 'Skip to main content';
        skipLink.className = 'visually-hidden focus-visible:not-sr-only';
        document.body.insertBefore(skipLink, document.body.firstChild);

        // Add aria-labels to buttons without text
        const iconButtons = document.querySelectorAll('button:not([aria-label]) i.fas');
        iconButtons.forEach(icon => {
            const button = icon.closest('button');
            if (button && !button.textContent.trim()) {
                const iconClass = icon.className.match(/fa-([a-z-]+)/);
                if (iconClass) {
                    button.setAttribute('aria-label', iconClass[1].replace('-', ' '));
                }
            }
        });
    }

    /**
     * Initialize performance optimizations
     */
    initializePerformanceOptimizations() {
        // Debounce search inputs
        const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="search" i]');
        searchInputs.forEach(input => {
            let timeout;
            input.addEventListener('input', function() {
                clearTimeout(timeout);
                timeout = setTimeout(() => {
                    // Trigger search
                    const event = new CustomEvent('search:input', {
                        detail: { query: input.value, element: input }
                    });
                    window.dispatchEvent(event);
                }, 300);
            });
        });

        // Lazy load images
        const images = document.querySelectorAll('img[data-src]');
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }    /**
     * Update loading state with enhanced visuals
     */
    setLoading(isLoading, element) {
        if (element) {
            // Set loading for specific element
            if (isLoading) {
                element.classList.add('loading');
                element.disabled = true;
            } else {
                element.classList.remove('loading');
                element.disabled = false;
            }
        } else {
            // Global loading state
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                if (isLoading) {
                    loadingScreen.classList.remove('hidden');
                    loadingScreen.style.opacity = '1';
                } else {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => {
                        loadingScreen.classList.add('hidden');
                    }, 300);
                }
            }
        }
    }

    /**
     * Create loading skeleton
     */
    createLoadingSkeleton(container, type = 'card') {
        const skeletonHTML = {
            card: `
                <div class="loading-skeleton">
                    <div class="skeleton-avatar"></div>
                    <div class="skeleton-text large"></div>
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text small"></div>
                    <div class="skeleton-button"></div>
                </div>
            `,
            list: `
                <div class="loading-skeleton">
                    <div class="skeleton-text large"></div>
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text small"></div>
                </div>
            `
        };

        if (container) {
            container.innerHTML = skeletonHTML[type] || skeletonHTML.card;
        }
    }

    /**
     * Handle responsive behavior
     */
    handleResize() {
        const mobileBreakpoint = 768;
        const isMobile = window.innerWidth < mobileBreakpoint;
        
        // Update mobile navigation
        const mobileMenu = document.querySelector('.mobile-nav-menu');
        const desktopNav = document.querySelector('.desktop-nav');
        
        if (isMobile) {
            if (desktopNav) desktopNav.style.display = 'none';
        } else {
            if (mobileMenu) mobileMenu.classList.remove('show');
            if (desktopNav) desktopNav.style.display = '';
        }
    }

    /**
     * Handle errors gracefully
     */
    handleError(message, error) {
        if (this.isProduction) {
            // Log error for monitoring
            this.logError(message, error);
        }
    }

    logError(message, error) {
        // Send to error logging service
        if (window.api && typeof window.api.logError === 'function') {
            window.api.logError({
                message: message,
                error: error ? error.toString() : null,
                timestamp: new Date().toISOString(),
                url: window.location.href,
                userAgent: navigator.userAgent
            }).catch(() => {
                // Silently fail if logging service unavailable
            });
        }
    }
}

// Create global instance
window.UIManager = UIManager;
window.ui = new UIManager();

// Enhanced global utility functions
window.dismissAlert = function(alertId) {
    const alert = document.getElementById(alertId);
    const main = document.querySelector('main');
    
    if (alert) {
        alert.style.opacity = '0';
        alert.style.transform = 'translateY(-20px)';
        
        if (main && main.classList.contains('github-alert-spacing')) {
            main.classList.remove('github-alert-spacing');
        }
        
        setTimeout(function() {
            if (alert.parentNode) {
                alert.parentNode.removeChild(alert);
            }
        }, 300);
    }
};

window.showSection = function(sectionName) {
    if (window.ui) {
        window.ui.navigateToView(sectionName);
    }
};

window.showAuthModal = function(type) {
    if (window.ui) {
        const modalId = type === 'register' ? 'authModal' : 'authModal';
        window.ui.openModal(modalId);
        
        // Switch to appropriate form
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const modalTitle = document.querySelector('#authModal .modal-title');
        
        if (type === 'register') {
            if (loginForm) loginForm.classList.add('hidden');
            if (registerForm) registerForm.classList.remove('hidden');
            if (modalTitle) modalTitle.textContent = 'Create Account';
        } else {
            if (registerForm) registerForm.classList.add('hidden');
            if (loginForm) loginForm.classList.remove('hidden');
            if (modalTitle) modalTitle.textContent = 'Sign In';
        }
    }
};

window.toggleUserMenu = function() {
    const dropdown = document.getElementById('userMenuDropdown');
    if (dropdown) {
        dropdown.classList.toggle('hidden');
    }
};

window.toggleMobileMenu = function() {
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileToggle = document.querySelector('.mobile-nav-toggle');
    
    if (mobileMenu) {
        mobileMenu.classList.toggle('show');
    }
    
    if (mobileToggle) {
        mobileToggle.classList.toggle('active');
    }
};

// Initialize character counting for textareas
document.addEventListener('DOMContentLoaded', function() {
    const textareas = document.querySelectorAll('textarea[data-max-length]');
    textareas.forEach(textarea => {
        const maxLength = parseInt(textarea.getAttribute('data-max-length'));
        const charCountId = textarea.getAttribute('data-char-count');
        const charCountElement = charCountId ? document.getElementById(charCountId) : null;
        
        if (charCountElement) {
            textarea.addEventListener('input', function() {
                const currentLength = this.value.length;
                charCountElement.textContent = currentLength;
                
                if (currentLength > maxLength * 0.9) {
                    charCountElement.style.color = 'var(--warning)';
                } else {
                    charCountElement.style.color = '';
                }
            });
        }
    });
});

// Handle window resize for responsive behavior
window.addEventListener('resize', function() {
    if (window.ui && typeof window.ui.handleResize === 'function') {
        window.ui.handleResize();
    }
});

// Initialize enhanced features on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize ripple effects for buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            ripple.style.position = 'absolute';
            ripple.style.borderRadius = '50%';
            ripple.style.background = 'rgba(255, 255, 255, 0.6)';
            ripple.style.transform = 'scale(0)';
            ripple.style.animation = 'ripple 0.6s linear';
            ripple.style.pointerEvents = 'none';
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            
            setTimeout(() => {
                if (ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600);
        });
    });
});
