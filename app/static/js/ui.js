/**
 * UI Utilities Module
 * Provides common UI components and utilities
 */

class UIUtils {
    constructor() {
        this.toasts = [];
        this.modals = new Map();
        this.loadingOverlays = new Map();
        this.init();
    }

    init() {
        this.createToastContainer();
        this.createModalContainer();
        this.setupEventListeners();
    }

    // ============ TOAST NOTIFICATIONS ============

    createToastContainer() {
        if (!document.getElementById('toast-container')) {
            const container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(container);
        }
    }

    showToast(message, type = 'info', duration = 5000) {
        const toast = this.createToastElement(message, type);
        const container = document.getElementById('toast-container');
        
        container.appendChild(toast);
        this.toasts.push(toast);

        // Animate in
        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', 'translate-x-full');
            toast.classList.add('opacity-100', 'translate-x-0');
        });

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }

        return toast;
    }

    createToastElement(message, type) {
        const toast = document.createElement('div');
        toast.className = `toast transform transition-all duration-300 ease-in-out opacity-0 translate-x-full
            max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5`;

        const typeClasses = {
            success: 'border-l-4 border-green-400',
            error: 'border-l-4 border-red-400',
            warning: 'border-l-4 border-yellow-400',
            info: 'border-l-4 border-blue-400'
        };

        const typeIcons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const typeColors = {
            success: 'text-green-600',
            error: 'text-red-600',
            warning: 'text-yellow-600',
            info: 'text-blue-600'
        };

        toast.classList.add(typeClasses[type] || typeClasses.info);

        toast.innerHTML = `
            <div class="p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <span class="inline-flex items-center justify-center h-6 w-6 rounded-full text-sm font-medium ${typeColors[type] || typeColors.info}">
                            ${typeIcons[type] || typeIcons.info}
                        </span>
                    </div>
                    <div class="ml-3 flex-1">
                        <p class="text-sm font-medium text-gray-900">${message}</p>
                    </div>
                    <div class="ml-4 flex-shrink-0 flex">
                        <button class="toast-close bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            <span class="sr-only">Close</span>
                            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add close button event
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.removeToast(toast);
        });

        return toast;
    }

    removeToast(toast) {
        toast.classList.remove('opacity-100', 'translate-x-0');
        toast.classList.add('opacity-0', 'translate-x-full');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            const index = this.toasts.indexOf(toast);
            if (index > -1) {
                this.toasts.splice(index, 1);
            }
        }, 300);
    }

    // ============ MODAL DIALOGS ============

    createModalContainer() {
        if (!document.getElementById('modal-container')) {
            const container = document.createElement('div');
            container.id = 'modal-container';
            document.body.appendChild(container);
        }
    }

    showModal(title, content, options = {}) {
        const modalId = options.id || `modal-${Date.now()}`;
        const modal = this.createModalElement(modalId, title, content, options);
        
        const container = document.getElementById('modal-container');
        container.appendChild(modal);
        this.modals.set(modalId, modal);

        // Show modal
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            modal.classList.add('opacity-100');
            modal.querySelector('.modal-dialog').classList.remove('scale-95');
            modal.querySelector('.modal-dialog').classList.add('scale-100');
        });

        // Focus management
        const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }

        return modalId;
    }

    createModalElement(modalId, title, content, options) {
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = `modal fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 opacity-0 transition-opacity duration-300`;

        const size = options.size || 'md';
        const sizeClasses = {
            sm: 'max-w-md',
            md: 'max-w-lg',
            lg: 'max-w-2xl',
            xl: 'max-w-4xl',
            full: 'max-w-full mx-4'
        };

        modal.innerHTML = `
            <div class="modal-dialog relative top-20 mx-auto p-5 border w-11/12 ${sizeClasses[size]} shadow-lg rounded-md bg-white transform transition-transform duration-300 scale-95">
                <div class="modal-content">
                    <div class="modal-header flex justify-between items-center pb-3">
                        <h3 class="text-lg font-bold text-gray-900">${title}</h3>
                        <button class="modal-close text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    <div class="modal-body py-3">
                        ${content}
                    </div>
                    ${options.showFooter !== false ? `
                        <div class="modal-footer flex justify-end space-x-2 pt-3">
                            ${options.buttons || '<button class="modal-close bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Close</button>'}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Add event listeners
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideModal(modalId);
            }
        });

        modal.querySelectorAll('.modal-close').forEach(button => {
            button.addEventListener('click', () => {
                this.hideModal(modalId);
            });
        });

        // Escape key handling
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.hideModal(modalId);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);

        return modal;
    }

    hideModal(modalId) {
        const modal = this.modals.get(modalId);
        if (!modal) return;

        modal.classList.remove('opacity-100');
        modal.classList.add('opacity-0');
        modal.querySelector('.modal-dialog').classList.remove('scale-100');
        modal.querySelector('.modal-dialog').classList.add('scale-95');

        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
            this.modals.delete(modalId);
        }, 300);
    }

    // ============ LOADING OVERLAYS ============

    showLoading(element, message = 'Loading...') {
        const loadingId = `loading-${Date.now()}`;
        const overlay = this.createLoadingOverlay(message);
        
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        if (!element) {
            element = document.body;
        }

        // Make element relative if not already positioned
        const position = getComputedStyle(element).position;
        if (position === 'static') {
            element.style.position = 'relative';
        }

        element.appendChild(overlay);
        this.loadingOverlays.set(loadingId, { overlay, element });

        return loadingId;
    }

    createLoadingOverlay(message) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-40';
        
        overlay.innerHTML = `
            <div class="flex flex-col items-center">
                <div class="loader animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                <p class="mt-3 text-sm text-gray-600">${message}</p>
            </div>
        `;

        return overlay;
    }

    hideLoading(loadingId) {
        const loadingData = this.loadingOverlays.get(loadingId);
        if (!loadingData) return;

        const { overlay, element } = loadingData;
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }

        this.loadingOverlays.delete(loadingId);
    }

    // ============ FORM UTILITIES ============

    validateForm(form) {
        const errors = [];
        const requiredFields = form.querySelectorAll('[required]');

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                errors.push(`${this.getFieldLabel(field)} is required`);
                this.showFieldError(field, 'This field is required');
            } else {
                this.clearFieldError(field);
            }
        });

        // Email validation
        const emailFields = form.querySelectorAll('input[type="email"]');
        emailFields.forEach(field => {
            if (field.value && !this.isValidEmail(field.value)) {
                errors.push(`${this.getFieldLabel(field)} must be a valid email address`);
                this.showFieldError(field, 'Please enter a valid email address');
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    getFieldLabel(field) {
        const label = field.closest('.form-group, .field-group')?.querySelector('label');
        return label ? label.textContent.replace('*', '').trim() : field.name || 'Field';
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        field.classList.add('border-red-500');
        
        const errorElement = document.createElement('p');
        errorElement.className = 'field-error text-red-500 text-sm mt-1';
        errorElement.textContent = message;
        
        field.parentNode.appendChild(errorElement);
    }

    clearFieldError(field) {
        field.classList.remove('border-red-500');
        
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // ============ TABLE UTILITIES ============

    createDataTable(container, data, columns, options = {}) {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }

        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-gray-200';

        // Create header
        const thead = document.createElement('thead');
        thead.className = 'bg-gray-50';
        const headerRow = document.createElement('tr');

        columns.forEach(column => {
            const th = document.createElement('th');
            th.className = 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
            th.textContent = column.title;
            if (column.sortable) {
                th.classList.add('cursor-pointer', 'hover:bg-gray-100');
                th.addEventListener('click', () => {
                    this.sortTable(table, column.key, th);
                });
            }
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-gray-200';

        this.populateTableBody(tbody, data, columns);
        table.appendChild(tbody);

        // Clear container and add table
        container.innerHTML = '';
        container.appendChild(table);

        // Add pagination if needed
        if (options.pagination && data.length > options.pageSize) {
            this.addTablePagination(container, data, columns, options);
        }

        return table;
    }

    populateTableBody(tbody, data, columns) {
        tbody.innerHTML = '';
        
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50';

            columns.forEach(column => {
                const td = document.createElement('td');
                td.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-900';
                
                let value = row[column.key];
                if (column.render) {
                    value = column.render(value, row);
                } else if (column.type === 'date' && value) {
                    value = new Date(value).toLocaleDateString();
                } else if (column.type === 'datetime' && value) {
                    value = new Date(value).toLocaleString();
                }

                td.innerHTML = value || '';
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });
    }

    // ============ PROGRESS INDICATORS ============

    createProgressBar(container, progress = 0, options = {}) {
        if (typeof container === 'string') {
            container = document.querySelector(container);
        }

        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar w-full bg-gray-200 rounded-full h-2';

        const progressFill = document.createElement('div');
        progressFill.className = `progress-fill bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out`;
        progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;

        progressBar.appendChild(progressFill);

        if (options.showText) {
            const progressText = document.createElement('div');
            progressText.className = 'progress-text text-sm text-gray-600 mt-1';
            progressText.textContent = `${Math.round(progress)}%`;
            
            container.innerHTML = '';
            container.appendChild(progressBar);
            container.appendChild(progressText);
        } else {
            container.innerHTML = '';
            container.appendChild(progressBar);
        }

        return {
            update: (newProgress) => {
                progressFill.style.width = `${Math.min(100, Math.max(0, newProgress))}%`;
                if (options.showText) {
                    container.querySelector('.progress-text').textContent = `${Math.round(newProgress)}%`;
                }
            }
        };
    }

    // ============ UTILITY FUNCTIONS ============

    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    formatDate(date, options = {}) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...options
        }).format(new Date(date));
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // ============ SETUP EVENT LISTENERS ============

    setupEventListeners() {
        // Close modals on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close topmost modal
                const modals = Array.from(this.modals.values());
                if (modals.length > 0) {
                    const topModal = modals[modals.length - 1];
                    const modalId = topModal.id;
                    this.hideModal(modalId);
                }
            }
        });

        // Auto-hide success toasts after longer duration
        document.addEventListener('DOMContentLoaded', () => {
            // Any additional setup can go here
        });
    }
}

// Create global UI utilities instance
window.uiUtils = new UIUtils();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIUtils;
}
