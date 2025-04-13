// Configuration and Constants
const CONFIG = {
    github: {
        user: 'parkerrasys',
        repo: '8709-Storage',
        files: {
            passwords: 'users.txt',
            adminPassword: 'admin-password.txt',
            schedule: 'schedule.txt'
        }
    },
    googleSheets: {
        apiKey: 'AIzaSyC-CRiUBM4ZNQXU_nTjRNjX_YcbRG95TsE',
        spreadsheetId: '1MZ6T17q-IcUI2AnZ1nVXtlfyMOHxLl_kTUb5YEI_uLg',
        cellRange: 'A2:A2'
    },
    defaults: {
        password: '1234'
    }
};

// State Management
const state = {
    githubToken: '',
    adminPassword: '',
    usersData: [],
    scheduleData: [],
    currentFileSha: '',
    scheduleFileSha: '',
    isSaving: false,
    isEditorFocused: false,
    currentSearchTerm: '',
    currentEditingUserIndex: -1,
    currentRoles: []
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
        'adminLoginForm', 'passwordManagement', 'adminPassword', 'adminLoginButton',
        'adminLoginError', 'loadingIndicator', 'passwordContent', 'userTableBody',
        'newUsername', 'newPassword', 'addUserButton', 'logoutButton',
        'managementTabs', 'passwordTabButton', 'scheduleTabButton',
        'passwordTabContent', 'scheduleTabContent', 'addScheduleButton',
        'userSearchInput', 'searchStats', 'notificationContainer', 'scheduleTableBody',
        'newScheduleDate', 'newScheduleTime', 'newScheduleType', 'newScheduleDescription'
    ];

    elementIds.forEach(id => {
        elements[id] = document.getElementById(id);
    });

    // Create elements if they don't exist
    if (!elements.logoutButton) {
        elements.logoutButton = createLogoutButton();
    }
}

// Event Listeners Setup
function setupEventListeners() {
    // Admin Authentication
    elements.adminLoginButton.addEventListener('click', handleAdminLogin);
    elements.adminPassword.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleAdminLogin();
    });

    // User Management
    elements.addUserButton.addEventListener('click', handleAddUser);
    elements.newUsername.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleAddUser();
    });
    elements.newPassword.addEventListener('keypress', e => {
        if (e.key === 'Enter' && elements.newUsername.value.trim()) handleAddUser();
    });

    // Search Functionality
    elements.userSearchInput.addEventListener('input', e => {
        state.currentSearchTerm = e.target.value.toLowerCase().trim();
        renderUserTable();
    });

    // Tab Navigation
    if (elements.managementTabs) {
        elements.passwordTabButton.addEventListener('click', () => switchTab('users'));
        elements.scheduleTabButton.addEventListener('click', () => switchTab('schedule'));
    }

    // Schedule Management
    if (elements.addScheduleButton) {
        elements.addScheduleButton.addEventListener('click', handleAddScheduleItem);
        setupScheduleInputListeners();
    }

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
                elements.adminLoginButton.disabled = false;
                return true;
            }
            throw new Error('No GitHub token found');
        } catch (error) {
            console.error('Token fetch error:', error);
            showNotification(error.message, true);
            return false;
        }
    },

    async fetchAdminPassword() {
        const url = `https://api.github.com/repos/${CONFIG.github.user}/${CONFIG.github.repo}/contents/${CONFIG.github.files.adminPassword}`;
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `token ${state.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!response.ok) throw new Error('Failed to fetch admin password');

            const data = await response.json();
            state.adminPassword = atob(data.content).trim();
            elements.adminLoginButton.disabled = false;
        } catch (error) {
            console.error('Admin password fetch error:', error);
            showNotification(error.message, true);
        }
    },

    async fetchPasswordFile() {
        const url = `https://api.github.com/repos/${CONFIG.github.user}/${CONFIG.github.repo}/contents/${CONFIG.github.files.passwords}`;
        try {
            const response = await fetch(url, { headers: {
                'Authorization': `token ${state.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }});
            if (!response.ok) throw new Error(`Failed to fetch password file: ${response.status} ${response.statusText}`);
            const data = await response.json();
            state.currentFileSha = data.sha;
            UserManager.parseUserData(atob(data.content));
            elements.loadingIndicator.style.display = 'none';
            elements.passwordContent.style.display = 'block';
            switchTab('schedule');
            await this.fetchScheduleFile();
        } catch (error) {
            console.error('Password file fetch error:', error);
            showNotification(error.message, true);
            elements.loadingIndicator.style.display = 'none';
        }
    },

    async fetchScheduleFile() {
        const url = `https://api.github.com/repos/${CONFIG.github.user}/${CONFIG.github.repo}/contents/${CONFIG.github.files.schedule}`;
        try {
            const response = await fetch(url, { headers: {
                'Authorization': `token ${state.githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }});
            if (!response.ok) throw new Error(`Failed to fetch schedule file: ${response.status} ${response.statusText}`);
            const data = await response.json();
            state.scheduleFileSha = data.sha;
            ScheduleManager.parseScheduleData(atob(data.content));
        } catch (error) {
            console.error('Schedule file fetch error:', error);
            showNotification(error.message, true);
        }
    },

    async savePasswordFile() {
        if (state.isSaving) return;
        state.isSaving = true;
        showSavingIndicator();
        const url = `https://api.github.com/repos/${CONFIG.github.user}/${CONFIG.github.repo}/contents/${CONFIG.github.files.passwords}`;
        try {
            const content = UserManager.generateFileContent();
            const base64Content = btoa(content);
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${state.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Update passwords file',
                    content: base64Content,
                    sha: state.currentFileSha
                })
            });
            if (!response.ok) throw new Error(`Failed to save password file: ${response.status} ${response.statusText}`);
            const data = await response.json();
            state.currentFileSha = data.content.sha;
            showNotification('Changes saved successfully!');
        } catch (error) {
            console.error('Password file save error:', error);
            showNotification(error.message, true);
        } finally {
            state.isSaving = false;
            hideSavingIndicator();
        }
    },

    async saveScheduleFile() {
        if (state.isSaving) return;
        state.isSaving = true;
        showSavingIndicator();
        const url = `https://api.github.com/repos/${CONFIG.github.user}/${CONFIG.github.repo}/contents/${CONFIG.github.files.schedule}`;
        try {
            const content = ScheduleManager.generateScheduleFileContent();
            const base64Content = btoa(content);
            const response = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${state.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Update schedule file',
                    content: base64Content,
                    sha: state.scheduleFileSha
                })
            });
            if (!response.ok) throw new Error(`Failed to save schedule file: ${response.status} ${response.statusText}`);
            const data = await response.json();
            state.scheduleFileSha = data.sha;
            showNotification('Schedule changes saved successfully!');
        } catch (error) {
            console.error('Schedule file save error:', error);
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
                        baseRole: this.getUserRole(parts[0].trim())
                    };
                } else if (parts.length === 3) {
                    return {
                        username: parts[0].trim(),
                        displayName: parts[1].trim(),
                        password: parts[2].trim(),
                        roles: [this.getUserRole(parts[0].trim())],
                        baseRole: this.getUserRole(parts[0].trim())
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
                        roles: [this.getUserRole(username)],
                        baseRole: this.getUserRole(username)
                    };
                }
                return null;
            })
            .filter(user => user !== null);
        renderUserTable();
    },

    getUserRole(user) {
        if (Array.isArray(user.roles) && user.roles.includes('Mentor')) return 'mentor';
        if (Array.isArray(user.roles) && user.roles.includes('Admin')) return 'admin';
        if (Array.isArray(user.roles) && user.roles.includes('Guest')) return 'guest';
        if (Array.isArray(user.roles) && user.roles.includes('Team Lead')) return 'teamlead';
        return 'member';
    },

    formatUsername(input) {
        return input.replace(/\s+/g, '_').toLowerCase();
    },

    generateFileContent() {
        return state.usersData
            .map(user => `${user.username}|${user.displayName}|${user.password}|${user.roles.join('-')}`)
            .join(',\n');
    }
};

// Schedule Management Functions
const ScheduleManager = {
    parseScheduleData(content) {
        state.scheduleData = content.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const parts = line.trim().split('|');
                if (parts.length >= 4) {
                    return {
                        date: parts[0].trim(),
                        time: parts[1].trim(),
                        type: parts[2].trim(),
                        description: parts[3].trim()
                    };
                }
                return null;
            })
            .filter(item => item !== null);
        renderScheduleTable();
    },

    generateScheduleFileContent() {
        return state.scheduleData
            .map(item => `${item.date}|${item.time}|${item.type}|${item.description}`)
            .join(',\n');
    }
};


// UI Rendering Functions
const UIRenderer = {
    renderUserTable() {
        const filteredUsers = state.usersData.filter(user => {
            const searchFields = [
                user.username.toLowerCase(),
                user.displayName.toLowerCase(),
                user.roles.join(' ').toLowerCase()
            ];
            return !state.currentSearchTerm ||
                   searchFields.some(field => field.includes(state.currentSearchTerm));
        });

        elements.userTableBody.innerHTML = '';
        filteredUsers.forEach((user, index) => {
            const row = this.createUserRow(user, index);
            elements.userTableBody.appendChild(row);
        });

        this.updateSearchStats(filteredUsers.length);
    },

    createUserRow(user, originalIndex) {
        const row = document.createElement('tr');
        row.className = 'user-row';
        row.setAttribute('data-index', originalIndex);

        // Username cell
        const usernameCell = document.createElement('td');
        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.value = user.username;
        usernameInput.className = UserManager.getUserRole(user);
        usernameInput.addEventListener('change', e => {
            const formattedUsername = UserManager.formatUsername(e.target.value);
            usernameInput.value = formattedUsername;
            state.usersData[originalIndex].username = formattedUsername;
            const oldAutoDisplay = generateDisplayName(user.username);
            if (user.displayName === oldAutoDisplay) {
                state.usersData[originalIndex].displayName = generateDisplayName(formattedUsername);
            }
            state.usersData[originalIndex].baseRole = UserManager.getUserRole(formattedUsername);
            GitHubAPI.savePasswordFile();
        });
        usernameCell.appendChild(usernameInput);
        row.appendChild(usernameCell);

        // Display name cell
        const displayNameCell = document.createElement('td');
        const displayNameInput = document.createElement('input');
        displayNameInput.type = 'text';
        displayNameInput.value = user.displayName;
        displayNameInput.className = UserManager.getUserRole(user);
        displayNameInput.addEventListener('change', e => {
            state.usersData[originalIndex].displayName = e.target.value;
            GitHubAPI.savePasswordFile();
        });
        displayNameCell.appendChild(displayNameInput);
        row.appendChild(displayNameCell);

        // Password cell
        const passwordCell = document.createElement('td');
        const passwordInput = document.createElement('input');
        passwordInput.type = 'text';
        passwordInput.value = user.password;
        passwordInput.className = UserManager.getUserRole(user);
        passwordInput.addEventListener('change', e => {
            state.usersData[originalIndex].password = e.target.value;
            GitHubAPI.savePasswordFile();
        });
        passwordCell.appendChild(passwordInput);
        row.appendChild(passwordCell);

        // Roles cell
        const rolesCell = document.createElement('td');
        const rolesDisplay = document.createElement('div');
        rolesDisplay.className = 'roles-display';
        rolesDisplay.textContent = user.roles.join(', ');
        rolesCell.appendChild(rolesDisplay);

        const editRolesButton = document.createElement('button');
        editRolesButton.className = 'btn btn-small';
        editRolesButton.textContent = 'Edit Roles';
        editRolesButton.addEventListener('click', () => openRolesEditor(originalIndex));
        rolesCell.appendChild(editRolesButton);
        row.appendChild(rolesCell);

        // Actions cell
        const actionsCell = this.createActionsCell(originalIndex);
        row.appendChild(actionsCell);

        return row;
    },

    createActionsCell(index) {
        const actionsCell = document.createElement('td');
        actionsCell.className = 'actions-cell';

        const moveUpButton = this.createMoveButton('&uarr;', 'Move Up', () => {
            if (index > 0) {
                [state.usersData[index], state.usersData[index - 1]] = [state.usersData[index - 1], state.usersData[index]];
                GitHubAPI.savePasswordFile().then(() => {
                    renderUserTable();
                    showNotification('User moved up and saved.');
                });
            }
        });

        const moveDownButton = this.createMoveButton('&darr;', 'Move Down', () => {
            if (index < state.usersData.length - 1) {
                [state.usersData[index], state.usersData[index + 1]] = [state.usersData[index + 1], state.usersData[index]];
                GitHubAPI.savePasswordFile().then(() => {
                    renderUserTable();
                    showNotification('User moved down and saved.');
                });
            }
        });


        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-small btn-delete';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
            state.usersData.splice(index, 1);
            GitHubAPI.savePasswordFile().then(() => {
                renderUserTable();
                showNotification('User deleted and saved.');
            });
        });

        actionsCell.appendChild(moveUpButton);
        actionsCell.appendChild(moveDownButton);
        actionsCell.appendChild(deleteButton);
        return actionsCell;
    },


    createMoveButton(html, title, onClick) {
        const button = document.createElement('button');
        button.className = 'btn btn-small';
        button.innerHTML = html;
        button.title = title;
        button.addEventListener('click', onClick);
        return button;
    },

    updateSearchStats(filteredCount) {
        const total = state.usersData.length;
        elements.searchStats.textContent = state.currentSearchTerm
            ? `Showing ${filteredCount} of ${total} users`
            : `Showing all ${total} users`;
    },

    renderScheduleTable() {
        const scheduleTableBody = document.getElementById('scheduleTableBody');
        if (!scheduleTableBody) return;
        scheduleTableBody.innerHTML = '';
        state.scheduleData.forEach((item, index) => {
            const row = this.createScheduleRow(item, index);
            scheduleTableBody.appendChild(row);
        });
    },

    createScheduleRow(item, index) {
        const row = document.createElement('tr');
        row.className = 'schedule-row';
        row.setAttribute('data-index', index);

        const createInputCell = (value, onChange) => {
            const cell = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.value = value;
            input.addEventListener('change', onChange);
            input.addEventListener('focus', () => state.isEditorFocused = true);
            input.addEventListener('blur', () => state.isEditorFocused = false);
            cell.appendChild(input);
            return cell;
        };

        row.appendChild(createInputCell(item.date, e => {
            state.scheduleData[index].date = e.target.value;
            GitHubAPI.saveScheduleFile();
        }));
        row.appendChild(createInputCell(item.time, e => {
            state.scheduleData[index].time = e.target.value;
            GitHubAPI.saveScheduleFile();
        }));
        row.appendChild(createInputCell(item.type, e => {
            state.scheduleData[index].type = e.target.value;
            GitHubAPI.saveScheduleFile();
        }));
        row.appendChild(createInputCell(item.description, e => {
            state.scheduleData[index].description = e.target.value;
            GitHubAPI.saveScheduleFile();
        }));

        const actionsCell = this.createScheduleActionsCell(index);
        row.appendChild(actionsCell);
        return row;
    },

    createScheduleActionsCell(index) {
        const actionsCell = document.createElement('td');
        actionsCell.className = 'actions-cell';

        const moveUpButton = this.createMoveButton('&uarr;', 'Move Up', () => {
            if (index > 0) {
                [state.scheduleData[index], state.scheduleData[index - 1]] = [state.scheduleData[index - 1], state.scheduleData[index]];
                GitHubAPI.saveScheduleFile().then(() => {
                    this.renderScheduleTable();
                    showNotification('Schedule item moved up and saved.');
                });
            }
        });

        const moveDownButton = this.createMoveButton('&darr;', 'Move Down', () => {
            if (index < state.scheduleData.length - 1) {
                [state.scheduleData[index], state.scheduleData[index + 1]] = [state.scheduleData[index + 1], state.scheduleData[index]];
                GitHubAPI.saveScheduleFile().then(() => {
                    this.renderScheduleTable();
                    showNotification('Schedule item moved down and saved.');
                });
            }
        });

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-small btn-delete';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => {
            state.scheduleData.splice(index, 1);
            GitHubAPI.saveScheduleFile().then(() => {
                this.renderScheduleTable();
                showNotification('Schedule item deleted and saved.');
            });
        });

        actionsCell.appendChild(moveUpButton);
        actionsCell.appendChild(moveDownButton);
        actionsCell.appendChild(deleteButton);
        return actionsCell;
    }
};

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
    if (!document.getElementById('user-row-styles')) {
        addUserRowStyles();
    }
}

// Initialize the application
function initializePage() {
    elements.adminLoginForm.style.display = 'block';
    elements.passwordManagement.style.display = 'none';
    sessionStorage.removeItem('adminLoggedIn');
    elements.adminLoginButton.disabled = true;

    GitHubAPI.fetchToken().then(() => {
        if (state.githubToken) {
            GitHubAPI.fetchAdminPassword();
        }
    });

    // Set up tab functionality
    if (elements.managementTabs) {
        elements.passwordTabButton.addEventListener('click', () => {
            switchTab('users');
        });

        elements.scheduleTabButton.addEventListener('click', () => {
            switchTab('schedule');
        });
    }

    if (elements.addScheduleButton) {
        elements.addScheduleButton.addEventListener('click', handleAddScheduleItem);
    }
}

// Helper Functions
function createLogoutButton() {
    const button = document.createElement('button');
    button.id = 'logoutButton';
    button.className = 'btn btn-secondary';
    button.textContent = 'Logout';
    button.style.marginLeft = '10px';

    const buttonContainer = document.querySelector('.button-container') ||
                           document.querySelector('.controls') ||
                           document.querySelector('.form-actions');

    if (buttonContainer) {
        buttonContainer.appendChild(button);
    } else {
        const container = document.createElement('div');
        container.className = 'form-actions button-container';
        container.appendChild(button);
        elements.passwordContent.appendChild(container);
    }

    return button;
}

function switchTab(tabName) {
    if (tabName === 'users') {
        elements.passwordTabContent.style.display = 'block';
        elements.scheduleTabContent.style.display = 'none';
        elements.passwordTabButton.classList.add('active');
        elements.scheduleTabButton.classList.remove('active');
    } else if (tabName === 'schedule') {
        elements.passwordTabContent.style.display = 'none';
        elements.scheduleTabContent.style.display = 'block';
        elements.passwordTabButton.classList.remove('active');
        elements.scheduleTabButton.classList.add('active');
    }
}

function generateDisplayName(username) {
    return username
        .split('_')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function showSavingIndicator() {
    const indicator = document.getElementById('savingIndicator');
    indicator.style.display = 'block';
}

function hideSavingIndicator() {
    const indicator = document.getElementById('savingIndicator');
    indicator.style.display = 'none';
}

function showNotification(message, isError = false) {
    NotificationSystem.show(message, isError);
}

function handleAdminLogin() {
    const enteredPassword = elements.adminPassword.value;
    if (enteredPassword === state.adminPassword) {
        showPasswordManagement();
        GitHubAPI.fetchPasswordFile();
    } else {
        elements.adminLoginError.textContent = 'Incorrect admin password.';
    }
}

function showPasswordManagement() {
    elements.adminLoginForm.style.display = 'none';
    elements.passwordManagement.style.display = 'block';
}

function handleAddUser() {
    const username = UserManager.formatUsername(elements.newUsername.value.trim());
    const password = elements.newPassword.value.trim() || CONFIG.defaults.password;

    if (!username) {
        showNotification('Username is required', true);
        return;
    }

    if (state.usersData.some(user => user.username === username)) {
        showNotification('This username already exists', true);
        return;
    }

    const displayName = generateDisplayName(username);
    const baseRole = UserManager.getUserRole({ roles: [] }); // Get default role

    state.usersData.push({
        username,
        displayName,
        password,
        roles: [baseRole.charAt(0).toUpperCase() + baseRole.slice(1)],
        baseRole
    });

    GitHubAPI.savePasswordFile().then(() => {
        elements.newUsername.value = '';
        elements.newPassword.value = '';
        renderUserTable();
        showNotification(`User added with ${password === CONFIG.defaults.password ? 'default' : 'custom'} password and saved successfully!`);
    });
}

function handleAddScheduleItem() {
    const date = elements.newScheduleDate.value.trim();
    const time = elements.newScheduleTime.value.trim();
    const type = elements.newScheduleType.value.trim();
    const description = elements.newScheduleDescription.value.trim();

    if (!date || !time || !type || !description) {
        showNotification('All fields are required for schedule items', true);
        return;
    }

    state.scheduleData.push({ date, time, type, description });
    GitHubAPI.saveScheduleFile().then(() => {
        elements.newScheduleDate.value = '';
        elements.newScheduleTime.value = '';
        elements.newScheduleType.value = '';
        elements.newScheduleDescription.value = '';
        UIRenderer.renderScheduleTable();
        showNotification('Schedule item added and saved successfully!');
    });
}

function setupScheduleInputListeners() {
    const inputIds = ['newScheduleDate', 'newScheduleTime', 'newScheduleType', 'newScheduleDescription'];
    inputIds.forEach(id => {
        elements[id].addEventListener('keypress', e => {
            if (e.key === 'Enter') handleAddScheduleItem();
        });
    });
}

function handleKeyboardShortcut(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (elements.passwordManagement.style.display === 'block') {
            GitHubAPI.savePasswordFile();
        }
    }
}

function adminLogout() {
    sessionStorage.removeItem('adminLoggedIn');
    elements.adminLoginForm.style.display = 'block';
    elements.passwordManagement.style.display = 'none';
    elements.adminPassword.value = '';
}

function renderUserTable() {
    UIRenderer.renderUserTable();
}

function renderScheduleTable() {
    UIRenderer.renderScheduleTable();
}


// Roles Editor Functions
function addRolesEditorModal() {
    if (document.getElementById('rolesEditorModal')) return;

    const modal = document.createElement('div');
    modal.id = 'rolesEditorModal';
    modal.className = 'modal';
    modal.style.display = 'none';

    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-modal">&times;</span>
            <h3>Edit User Roles</h3>
            <div id="currentRolesList" class="current-roles-list"></div>
            <div class="add-role-form">
                <input type="text" id="newRoleInput" placeholder="Enter new role..." />
                <button id="addRoleButton" class="btn">Add Role</button>
            </div>
            <div class="preset-roles">
                <h4>Common Roles:</h4>
                <div class="preset-buttons">
                    <button class="preset-role" data-role="Member">Member</button>
                    <button class="preset-role" data-role="Mentor">Mentor</button>
                    <button class="preset-role" data-role="Team Lead">Team Lead</button>
                    <button class="preset-role" data-role="Admin">Admin</button>
                </div>
            </div>
            <div class="modal-footer">
                <button id="closeRolesButton" class="btn">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add modal styles
    const styleTag = document.createElement('style');
    styleTag.id = 'roles-modal-styles';
    styleTag.textContent = `
        .modal {
            display: none;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0,0,0,0.5);
        }

        .modal-content {
            background-color: #103a5a;
            margin: 10% auto;
            padding: 20px;
            border: 1px solid #1d5280;
            border-radius: 5px;
            width: 80%;
            max-width: 600px;
            color: #ffffff;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }

        .close-modal {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }

        .close-modal:hover,
        .close-modal:focus {
            color: #fff;
            text-decoration: none;
            cursor: pointer;
        }

        .current-roles-list {
            margin: 15px 0;
            padding: 10px;
            background-color: #0d314e;
            border-radius: 5px;
            min-height: 40px;
        }

        .role-tag {
            display: inline-block;
            background-color: #1d5280;
            color: white;
            padding: 5px 10px;
            margin: 5px;
            border-radius: 3px;
            position: relative;
        }

        .role-delete {
            margin-left: 8px;
            color: rgba(255,255,255,0.7);
            cursor: pointer;
        }

        .roledelete:hover {
            color: #ff8a80;
        }

        .add-role-form {
            display: flex;
            margin: 15px 0;
            gap: 10px;
        }

        .add-role-form input {
            flex: 1;
            padding: 8px;
            background-color: #0d314e;
            border: 1px solid #1d5280;
            color: white;
            border-radius: 3px;
        }

        .preset-roles {
            margin: 15px 0;
        }

        .preset-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            margin-top: 10px;
        }

        .preset-role {
            background-color: #1d5280;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
        }

        .preset-role:hover {
            background-color: #2d6290;
        }

        .modal-footer {
            margin-top: 20px;
            text-align: right;
        }

        /* Style for role in table */
        .roles-display {
            margin-bottom: 8px;
            font-size: 0.9em;
            color: #5c9bd6;
        }
    `;
    document.head.appendChild(styleTag);

    // Set up event listeners for modal
    const closeBtn = modal.querySelector('.close-modal');
    closeBtn.addEventListener('click', closeRolesEditor);

    const closeRolesBtn = document.getElementById('closeRolesButton');
    closeRolesBtn.addEventListener('click', closeRolesEditor);

    const addRoleBtn = document.getElementById('addRoleButton');
    addRoleBtn.addEventListener('click', addNewRole);

    const newRoleInput = document.getElementById('newRoleInput');
    newRoleInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            addNewRole();
        }
    });

    // Set up preset role buttons
    const presetButtons = modal.querySelectorAll('.preset-role');
    presetButtons.forEach(button => {
        button.addEventListener('click', () => {
            const role = button.getAttribute('data-role');
            addRoleToEditor(role);
        });
    });

    // Close modal when clicking outside
    window.addEventListener('click', e => {
        if (e.target === modal) {
            closeRolesEditor();
        }
    });
}

function openRolesEditor(userIndex) {
    state.currentEditingUserIndex = userIndex;
    state.currentRoles = [...state.usersData[userIndex].roles];

    const modal = document.getElementById('rolesEditorModal');
    if (!modal) {
        addRolesEditorModal();
    }

    const userName = state.usersData[userIndex].displayName;
    const modalTitle = modal.querySelector('h3');
    modalTitle.innerHTML = `Edit User Roles - <span style="color: #FFD700;">${userName}</span>`;

    renderCurrentRoles();
    document.getElementById('rolesEditorModal').style.display = 'block';
}

function closeRolesEditor() {
    document.getElementById('rolesEditorModal').style.display = 'none';
    state.currentEditingUserIndex = -1;
    state.currentRoles = [];
}

function renderCurrentRoles() {
    const rolesList = document.getElementById('currentRolesList');
    rolesList.innerHTML = '';

    if (state.currentRoles.length === 0) {
        rolesList.innerHTML = '<em>No roles assigned</em>';
        return;
    }

    state.currentRoles.forEach((role, index) => {
        const roleTag = document.createElement('div');
        roleTag.className = 'role-tag';

        const roleText = document.createTextNode(role);
        roleTag.appendChild(roleText);

        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'role-delete';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.addEventListener('click', () => deleteRole(index));

        roleTag.appendChild(deleteBtn);
        rolesList.appendChild(roleTag);
    });
}

function deleteRole(index) {
    state.currentRoles.splice(index, 1);
    renderCurrentRoles();
    saveRoleChangesToUser();
}

function addNewRole() {
    const input = document.getElementById('newRoleInput');
    const role = input.value.trim();

    if (role) {
        addRoleToEditor(role);
        input.value = '';
    }
}

function addRoleToEditor(role) {
    if (role && !state.currentRoles.includes(role)) {
        state.currentRoles.push(role);
        renderCurrentRoles();
        saveRoleChangesToUser();
    }
}

function saveRoleChangesToUser() {
    if (state.currentEditingUserIndex >= 0) {
        state.usersData[state.currentEditingUserIndex].roles = state.currentRoles;
        GitHubAPI.savePasswordFile().then(() => {
            renderUserTable();
            showNotification('User roles updated and saved successfully!');
        });
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
    `;
    document.head.appendChild(styleTag);
}

function addUserRowStyles() {
    if (document.getElementById('user-row-styles')) return;

    const styleTag = document.createElement('style');
    styleTag.id = 'user-row-styles';
    styleTag.textContent = `
        .user-row {
            transition: background-color 0.3s ease;
        }

        .user-row:hover {
            background-color: #0d314e;
        }

        .user-row td input {
            width: 100%;
            background-color: #103a5a;
            color: #ffffff;
            border: 1px solid #1d5280;
            padding: 5px 8px;
            border-radius: 3px;
            transition: all 0.3s ease;
        }

        .user-row td input:focus {
            background-color: #0d314e;
            border-color: #5c9bd6;
            outline: none;
            box-shadow: 0 0 0 2px rgba(92, 155, 214, 0.25);
        }

        .user-row td input.admin {
            border-left: 3px solid rgb(170, 145, 0);
            font-weight: bold;
        }

        .user-row td input.mentor {
            border-left: 3px solid #81c784;
            font-weight: bold;
        }

        .user-row td input.member {
            border-left: 3px solid rgb(148, 203, 255);
        }

        .user-row td input.teamlead {
            border-left: 3px solid rgb(37, 119, 156);
        }

        .user-row td input.guest {
            border-left: 3px solid #c0c0c0;
            font-style: italic;
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

        .keyboard-shortcut-indicator {
            position: fixed;
            bottom: 20px;
            left: 20px;
            background-color: rgba(16, 58, 90, 0.8);
            color: #ffffff;
            padding: 8px 15px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 9998;
            font-size: 12px;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(styleTag);

    const savingIndicator = document.createElement('div');
    savingIndicator.className = 'saving-indicator';
    savingIndicator.id = 'savingIndicator';
    savingIndicator.textContent = 'Saving changes...';
    document.body.appendChild(savingIndicator);

    const shortcutIndicator = document.createElement('div');
    shortcutIndicator.className = 'keyboard-shortcut-indicator';
    shortcutIndicator.id = 'shortcutIndicator';
    shortcutIndicator.textContent = 'Press Ctrl+S to save changes';
    document.body.appendChild(shortcutIndicator);
}

// Export functionality if needed
const AdminPanel = {
    init: initializePage,
    UserManager,
    ScheduleManager,
    UIRenderer,
    NotificationSystem
};