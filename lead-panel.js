// Configuration and Constants
const CONFIG = {
    github: {
        user: 'parkerrasys',
        repo: '8709-Storage',
        files: {
            leadPassword: 'lead-password.txt',
            toolCheckout: 'tool-logout.txt',
            users: 'users.txt'
        }
    },
    googleSheets: {
        apiKey: 'AIzaSyC-CRiUBM4ZNQXU_nTjRNjX_YcbRG95TsE',
        spreadsheetId: '1MZ6T17q-IcUI2AnZ1nVXtlfyMOHxLl_kTUb5YEI_uLg',
        cellRange: 'A2:A2'
    }
};

// State Management
const state = {
    githubToken: '',
    leadPassword: '',
    usersData: [],
    toolCheckoutData: [],
    toolCheckoutFileSha: '',
    isSaving: false,
    isEditorFocused: false,
    currentSearchTerm: '',
    userMap: {} // Maps usernames to their display names and roles
};

// DOM Elements
const elements = {};

// Initialize Application
document.addEventListener('DOMContentLoaded', function() {
    initializeDOMElements();
    setupEventListeners();
    initializeStyles();
    initializePage();
});

// DOM Element Initialization
function initializeDOMElements() {
    const elementIds = [
        'leadLoginForm', 'toolManagement', 'leadPassword', 'leadLoginButton',
        'leadLoginError', 'loadingIndicator', 'toolContent', 'toolTableBody',
        'logoutButton', 'toolSearchInput', 'searchStats', 'notificationContainer'
    ];

    elementIds.forEach(id => {
        elements[id] = document.getElementById(id);
    });
}

// Event Listeners Setup
function setupEventListeners() {
    // Lead Authentication
    elements.leadLoginButton.addEventListener('click', handleLeadLogin);
    elements.leadPassword.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleLeadLogin();
    });

    // Search Functionality
    elements.toolSearchInput.addEventListener('input', e => {
        state.currentSearchTerm = e.target.value.toLowerCase().trim();
        renderToolTable();
    });

    // Logout button
    elements.logoutButton.addEventListener('click', handleLogout);

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', handleKeyboardShortcut);
}

// GitHub API Functions
const GitHubAPI = {
    async fetchToken() {
        try {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.googleSheets.spreadsheetId}/values/${CONFIG.googleSheets.cellRange}?key=${CONFIG.googleSheets.apiKey}`;
            const response = await fetch(url);

            if (!response.ok) throw new Error('Failed to fetch GitHub token');

            const data = await response.json();
            if (data.values?.[0]?.[0]) {
                state.githubToken = data.values[0][0];
                elements.leadLoginButton.disabled = false;
                return true;
            }
            throw new Error('No GitHub token found');
        } catch (error) {
            console.error('Token fetch error:', error);
            showNotification(error.message, true);
            return false;
        }
    },

    async fetchLeadPassword() {
        const url = `https://api.github.com/repos/${CONFIG.github.user}/${CONFIG.github.repo}/contents/${CONFIG.github.files.leadPassword}`;
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${state.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch lead password');

            const data = await response.json();
            state.leadPassword = atob(data.content).trim();
            elements.leadLoginButton.disabled = false;
        } catch (error) {
            console.error('Lead password fetch error:', error);
            showNotification(error.message, true);
        }
    },

    async fetchUsersData() {
        const url = `https://api.github.com/repos/${CONFIG.github.user}/${CONFIG.github.repo}/contents/${CONFIG.github.files.users}`;
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${state.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch users data');

            const data = await response.json();
            UserManager.parseUserData(atob(data.content));
        } catch (error) {
            console.error('Users file fetch error:', error);
            showNotification(error.message, true);
        }
    },

    async fetchToolCheckoutData() {
        const url = `https://api.github.com/repos/${CONFIG.github.user}/${CONFIG.github.repo}/contents/${CONFIG.github.files.toolCheckout}`;
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${state.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch tool checkout data');

            const data = await response.json();
            state.toolCheckoutFileSha = data.sha;
            ToolManager.parseToolCheckoutData(atob(data.content));
            
            elements.loadingIndicator.style.display = 'none';
            elements.toolContent.style.display = 'block';
        } catch (error) {
            console.error('Tool checkout file fetch error:', error);
            showNotification(error.message, true);
            elements.loadingIndicator.style.display = 'none';
        }
    },

    async saveToolCheckoutFile() {
        if (state.isSaving) return;
        state.isSaving = true;
        showSavingIndicator();
        
        const url = `https://api.github.com/repos/${CONFIG.github.user}/${CONFIG.github.repo}/contents/${CONFIG.github.files.toolCheckout}`;
        try {
            const content = ToolManager.generateToolCheckoutFileContent();
            const base64Content = btoa(content);
            
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${state.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Update tool checkout file',
                    content: base64Content,
                    sha: state.toolCheckoutFileSha
                })
            });
            
            if (!response.ok) throw new Error('Failed to save tool checkout file');
            
            const data = await response.json();
            state.toolCheckoutFileSha = data.content.sha;
            showNotification('Tool return processed successfully!');
        } catch (error) {
            console.error('Tool checkout file save error:', error);
            showNotification(error.message, true);
        } finally {
            state.isSaving = false;
            hideSavingIndicator();
        }
    }
};

// User Management Functions
const UserManager = {
    parseUserData(content) {
        state.usersData = content.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.trim().split('|');
                if (parts.length === 4) {
                    return {
                        username: parts[0].trim(),
                        displayName: parts[1].trim(),
                        password: parts[2].trim(),
                        roles: parts[3].trim().split('-'),
                        baseRole: this.getUserRole(parts[3].trim().split('-'))
                    };
                } else if (parts.length === 3) {
                    return {
                        username: parts[0].trim(),
                        displayName: parts[1].trim(),
                        password: parts[2].trim(),
                        roles: [this.getUserRole([parts[0].trim()])],
                        baseRole: this.getUserRole([parts[0].trim()])
                    };
                } else if (parts.length === 2) {
                    const username = parts[0].trim();
                    const password = parts[1].trim();
                    const displayName = username
                        .split('_')
                        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                        .join(' ');
                    return {
                        username,
                        displayName,
                        password,
                        roles: [this.getUserRole([username])],
                        baseRole: this.getUserRole([username])
                    };
                }
                return null;
            })
            .filter(user => user !== null);
        
        // Create a map of usernames to display names for easy lookup
        state.userMap = {};
        state.usersData.forEach(user => {
            state.userMap[user.username] = {
                displayName: user.displayName,
                roles: user.roles,
                baseRole: user.baseRole
            };
        });
    },

    getUserRole(roles) {
        if (Array.isArray(roles) && roles.includes('Mentor')) return 'mentor';
        if (Array.isArray(roles) && roles.includes('Admin')) return 'admin';
        if (Array.isArray(roles) && roles.includes('Guest')) return 'guest';
        if (Array.isArray(roles) && roles.includes('Team Lead')) return 'teamlead';
        return 'member';
    }
};

// Tool Management Functions
const ToolManager = {
    parseToolCheckoutData(content) {
        state.toolCheckoutData = content.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.trim().split('|');
                if (parts.length >= 2) {
                    return {
                        username: parts[0].trim(),
                        tools: parts[1].trim().split('-').map(tool => tool.trim()).filter(tool => tool)
                    };
                }
                return null;
            })
            .filter(checkout => checkout !== null && checkout.tools.length > 0);
        
        renderToolTable();
    },

    generateToolCheckoutFileContent() {
        return state.toolCheckoutData
            .filter(checkout => checkout.tools.length > 0)
            .map(checkout => `${checkout.username}|${checkout.tools.join('-')}`)
            .join(',\n');
    },

    returnTool(username, toolIndex) {
        const userCheckoutIndex = state.toolCheckoutData.findIndex(
            checkout => checkout.username === username
        );
        
        if (userCheckoutIndex !== -1) {
            // Remove the tool at the specified index
            state.toolCheckoutData[userCheckoutIndex].tools.splice(toolIndex, 1);
            
            // If no tools left, remove the user from the checkout list
            if (state.toolCheckoutData[userCheckoutIndex].tools.length === 0) {
                state.toolCheckoutData.splice(userCheckoutIndex, 1);
            }
            
            // Save changes to GitHub
            GitHubAPI.saveToolCheckoutFile().then(() => {
                renderToolTable();
            });
        }
    }
};

// UI Rendering Functions
function renderToolTable() {
    const filteredCheckouts = state.toolCheckoutData.filter(checkout => {
        // Get user display name from the map
        const userInfo = state.userMap[checkout.username] || {
            displayName: checkout.username, // fallback if not found
            roles: ['Member'],
            baseRole: 'member'
        };
        
        const displayName = userInfo.displayName;
        const searchFields = [
            checkout.username.toLowerCase(),
            displayName.toLowerCase(),
            checkout.tools.join(' ').toLowerCase()
        ];
        
        return !state.currentSearchTerm ||
               searchFields.some(field => field.includes(state.currentSearchTerm));
    });

    elements.toolTableBody.innerHTML = '';
    filteredCheckouts.forEach(checkout => {
        const row = createToolCheckoutRow(checkout);
        elements.toolTableBody.appendChild(row);
    });

    updateSearchStats(filteredCheckouts.length);
}

function createToolCheckoutRow(checkout) {
    const row = document.createElement('tr');
    row.className = 'tool-checkout-row';
    
    // Get user display name from the map
    const userInfo = state.userMap[checkout.username] || {
        displayName: checkout.username, // fallback if not found
        roles: ['Member'],
        baseRole: 'member'
    };
    
    // Username/Member cell
    const usernameCell = document.createElement('td');
    usernameCell.className = `username-cell ${userInfo.baseRole}`;
    usernameCell.textContent = userInfo.displayName;
    row.appendChild(usernameCell);
    
    // Tools cell
    const toolsCell = document.createElement('td');
    checkout.tools.forEach((tool, index) => {
        const toolChip = document.createElement('div');
        toolChip.className = 'tool-chip';
        toolChip.textContent = tool;
        toolsCell.appendChild(toolChip);
    });
    row.appendChild(toolsCell);
    
    // Actions cell
    const actionsCell = document.createElement('td');
    actionsCell.className = 'actions-cell';
    
    checkout.tools.forEach((tool, index) => {
        const returnButton = document.createElement('button');
        returnButton.className = 'btn btn-small btn-return';
        returnButton.textContent = `Return ${tool}`;
        returnButton.addEventListener('click', () => {
            ToolManager.returnTool(checkout.username, index);
        });
        actionsCell.appendChild(returnButton);
        
        // Add a space between buttons
        if (index < checkout.tools.length - 1) {
            actionsCell.appendChild(document.createTextNode(' '));
        }
    });
    
    row.appendChild(actionsCell);
    
    return row;
}

function updateSearchStats(filteredCount) {
    const total = state.toolCheckoutData.length;
    elements.searchStats.textContent = state.currentSearchTerm
        ? `Showing ${filteredCount} of ${total} members with checked out tools`
        : total > 0 
            ? `Showing all ${total} members with checked out tools`
            : 'No tools currently checked out';
}

// Notification System
const NotificationSystem = {
    show(message, isError = false) {
        const notification = document.createElement('div');
        notification.className = `notification ${isError ? 'error' : 'success'}`;
        notification.textContent = message;

        const progress = document.createElement('div');
        progress.className = 'notification-progress';
        notification.appendChild(progress);

        elements.notificationContainer.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
};

// Style Management
function initializeStyles() {
    if (!document.getElementById('notification-styles')) {
        addNotificationStyles();
    }
}

// Initialize the application
function initializePage() {
    elements.leadLoginForm.style.display = 'block';
    elements.toolManagement.style.display = 'none';
    sessionStorage.removeItem('leadLoggedIn');
    elements.leadLoginButton.disabled = true;

    GitHubAPI.fetchToken().then(() => {
        if (state.githubToken) {
            GitHubAPI.fetchLeadPassword();
        }
    });
}

// Helper Functions
function showSavingIndicator() {
    const indicator = document.getElementById('savingIndicator');
    if (!indicator) {
        const savingIndicator = document.createElement('div');
        savingIndicator.className = 'saving-indicator';
        savingIndicator.id = 'savingIndicator';
        savingIndicator.textContent = 'Processing return...';
        document.body.appendChild(savingIndicator);
    } else {
        indicator.style.display = 'block';
    }
}

function hideSavingIndicator() {
    const indicator = document.getElementById('savingIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

function showNotification(message, isError = false) {
    NotificationSystem.show(message, isError);
}

function handleLeadLogin() {
    const enteredPassword = elements.leadPassword.value;
    if (enteredPassword === state.leadPassword) {
        showToolManagement();
        GitHubAPI.fetchUsersData().then(() => {
            GitHubAPI.fetchToolCheckoutData();
        });
    } else {
        elements.leadLoginError.textContent = 'Incorrect team lead password.';
    }
}

function showToolManagement() {
    elements.leadLoginForm.style.display = 'none';
    elements.toolManagement.style.display = 'block';
}

function handleLogout() {
    sessionStorage.removeItem('leadLoggedIn');
    elements.leadLoginForm.style.display = 'block';
    elements.toolManagement.style.display = 'none';
    elements.leadPassword.value = '';
}

function handleKeyboardShortcut(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault();
        if (elements.toolManagement.style.display === 'block') {
            GitHubAPI.fetchToolCheckoutData();
            showNotification('Tool checkout data refreshed');
        }
    }
}

function addNotificationStyles() {
    if (document.getElementById('notification-styles')) return;

    const styleTag = document.createElement('style');
    styleTag.id = 'notification-styles';
    styleTag.textContent = `
        #notificationContainer {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 350px;
        }

        .notification {
            margin-bottom: 15px;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            animation: slideIn 0.3s ease-out forwards;
            position: relative;
            overflow: hidden;
        }

        .notification.success {
            background-color: #103a5a;
            color: #81c784;
            border-left: 5px solid #81c784;
        }

        .notification.error {
            background-color: #103a5a;
            color: #ff8a80;
            border-left: 5px solid #ff8a80;
        }

        .notification-progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            background-color: rgba(255,255,255,0.3);
            width: 100%;
            transform-origin: left;
            animation: progress 5s linear forwards;
        }

        .saving-indicator {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #103a5a;
            color: #5c9bd6;
            padding: 8px 15px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            display: none;
            z-index: 9999;
            animation: fadeIn 0.3s ease-out;
        }

        @keyframes slideIn {
            from { transform: translateX(120%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(120%); opacity: 0; }
        }

        @keyframes progress {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(styleTag);
}

// Export functionality if needed
const LeadPanel = {
    init: initializePage,
    UserManager,
    ToolManager
};