document.addEventListener('DOMContentLoaded', function() {
    const config = {
        githubUser: 'parkerrasys',
        githubRepo: '8709-Storage',
        passwordFilePath: 'users.txt',
        adminPasswordFilePath: 'admin-password.txt',
        defaultPassword: '1234'
    };

    const API_KEY = 'AIzaSyC-CRiUBM4ZNQXU_nTjRNjX_YcbRG95TsE';
    const SPREADSHEET_ID = '1MZ6T17q-IcUI2AnZ1nVXtlfyMOHxLl_kTUb5YEI_uLg';
    const CELL_RANGE = 'A2:A2';
    
    const adminLoginForm = document.getElementById('adminLoginForm');
    const passwordManagement = document.getElementById('passwordManagement');
    const adminPassword = document.getElementById('adminPassword');
    const adminLoginButton = document.getElementById('adminLoginButton');
    const adminLoginError = document.getElementById('adminLoginError');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const passwordContent = document.getElementById('passwordContent');
    const userTableBody = document.getElementById('userTableBody');
    const newUsername = document.getElementById('newUsername');
    const newPassword = document.getElementById('newPassword');
    const addUserButton = document.getElementById('addUserButton');
    const logoutButton = document.getElementById('logoutButton') || createLogoutButton();
    
    const saveChangesButton = document.getElementById('saveChangesButton');
    if (saveChangesButton) {
        saveChangesButton.remove();
    }
    
    const notificationContainer = document.createElement('div');
    notificationContainer.id = 'notificationContainer';
    document.body.appendChild(notificationContainer);
    
    addNotificationStyles();
    
    addUserRowStyles();
    
    if (newPassword) {
        newPassword.placeholder = `Default: ${config.defaultPassword}`;
    }
    
    const githubApiBase = 'https://api.github.com';
    const repoContentsUrl = `${githubApiBase}/repos/${config.githubUser}/${config.githubRepo}/contents/${config.passwordFilePath}`;
    const adminPasswordUrl = `${githubApiBase}/repos/${config.githubUser}/${config.githubRepo}/contents/${config.adminPasswordFilePath}`;
    
    let currentFileSha = '';
    
    let usersData = [];
    
    let adminPasswordFromRepo = '';
    
    let isSaving = false;
    
    let isEditorFocused = false;

    let githubToken = '';

    async function fetchGithubToken() {
        try {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${CELL_RANGE}?key=${API_KEY}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch GitHub token from Google Sheets');
            }

            const data = await response.json();

            if (data.values && data.values.length > 0 && data.values[0].length > 0) {
                githubToken = data.values[0][0];
                console.log('GitHub token fetched successfully');

                // Now that we have the token, we can proceed with initialization
                adminLoginButton.disabled = false;
                fetchAdminPassword();
            } else {
                throw new Error('No GitHub token found in Google Sheets cell A1');
            }
        } catch (error) {
            console.error('Error fetching GitHub token:', error);
            adminLoginError.textContent = 'Unable to connect to authentication service. Please try again later.';
            adminLoginButton.disabled = true;
        }
    }
    
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
            passwordContent.appendChild(container);
        }
        
        return button;
    }

    // Add modal for roles editor
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

            .role-delete:hover {
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
        newRoleInput.addEventListener('keypress', (e) => {
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
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeRolesEditor();
            }
        });
    }

    // Current user index for the roles editor
    let currentEditingUserIndex = -1;
    let currentRoles = [];

    // Open the roles editor for a specific user
    function openRolesEditor(userIndex) {
        currentEditingUserIndex = userIndex;
        currentRoles = [...usersData[userIndex].roles];

        const modal = document.getElementById('rolesEditorModal');
        if (!modal) {
            addRolesEditorModal();
        }

        // Update modal title to include user's name
        const userName = usersData[userIndex].displayName;
        const modalTitle = modal.querySelector('h3');
        modalTitle.innerHTML = `Edit User Roles - <span style="color: #FFD700;">${userName}</span>`;

        // Update current roles list
        renderCurrentRoles();

        // Show the modal
        document.getElementById('rolesEditorModal').style.display = 'block';
    }

    // Close the roles editor without saving
    function closeRolesEditor() {
        document.getElementById('rolesEditorModal').style.display = 'none';
        currentEditingUserIndex = -1;
        currentRoles = [];
    }

    // Render the current roles in the editor
    function renderCurrentRoles() {
        const rolesList = document.getElementById('currentRolesList');
        rolesList.innerHTML = '';

        if (currentRoles.length === 0) {
            rolesList.innerHTML = '<em>No roles assigned</em>';
            return;
        }

        currentRoles.forEach((role, index) => {
            const roleTag = document.createElement('div');
            roleTag.className = 'role-tag';

            const roleText = document.createTextNode(role);
            roleTag.appendChild(roleText);

            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'role-delete';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', () => {
                deleteRole(index);
            });

            roleTag.appendChild(deleteBtn);
            rolesList.appendChild(roleTag);
        });
    }

    // Delete a role from the current roles
    function deleteRole(index) {
        currentRoles.splice(index, 1);
        renderCurrentRoles();
        
        // Save changes automatically
        saveRoleChangesToUser();
    }
    
    // Add a new role to the current roles
    function addNewRole() {
        const input = document.getElementById('newRoleInput');
        const role = input.value.trim();
        
        if (role) {
            addRoleToEditor(role);
            input.value = '';
        }
    }
    
    // Add a role to the editor (used by both manual add and presets)
    function addRoleToEditor(role) {
        if (role && !currentRoles.includes(role)) {
            currentRoles.push(role);
            renderCurrentRoles();
            
            // Save changes automatically
            saveRoleChangesToUser();
        }
    }
    
    // Save the roles changes to the user data
    function saveRoleChangesToUser() {
        if (currentEditingUserIndex >= 0) {
            usersData[currentEditingUserIndex].roles = currentRoles;
            
            // Save to file
            savePasswordFile().then(() => {
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
                border-left: 3px solid #FFD700;
                font-weight: bold;
            }
            
            .user-row td input.mentor {
                border-left: 3px solid #81c784;
                font-weight: bold;
            }
            
            .user-row td input.student {
                border-left: 3px solid #5c9bd6;
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
    
    function showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.className = `notification ${isError ? 'error' : 'success'}`;
        notification.textContent = message;
        
        const progress = document.createElement('div');
        progress.className = 'notification-progress';
        notification.appendChild(progress);
        
        notificationContainer.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }
    
    function showSavingIndicator() {
        const indicator = document.getElementById('savingIndicator');
        indicator.style.display = 'block';
    }
    
    function hideSavingIndicator() {
        const indicator = document.getElementById('savingIndicator');
        indicator.style.display = 'none';
    }
    
    function getUserRole(username) {
        if (username.startsWith('admin_')) {
            return 'admin';
        } else if (username.startsWith('mentor_')) {
            return 'mentor';
        } else if (username.startsWith('guest_')) {
            return 'guest';
        } else {
            return 'student';
        }
    }
    
    function initializePage() {
        adminLoginForm.style.display = 'block';
        passwordManagement.style.display = 'none';

        sessionStorage.removeItem('adminLoggedIn');

        adminLoginButton.disabled = true;
        fetchGithubToken();
        addRolesEditorModal();
    }
    
    async function fetchAdminPassword() {
        try {
            const response = await fetch(adminPasswordUrl, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('GitHub API Error:', response.status, errorData);
                throw new Error(`Failed to fetch admin password file: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            adminPasswordFromRepo = atob(data.content).trim();
            
            adminLoginButton.disabled = false;
            
        } catch (error) {
            console.error('Error fetching admin password:', error);
            adminLoginError.textContent = `Unable to connect to authentication service: ${error.message}`;
            adminLoginButton.disabled = true;
        }
    }
    
    function showPasswordManagement() {
        adminLoginForm.style.display = 'none';
        passwordManagement.style.display = 'block';
    }
    
    async function fetchPasswordFile() {
        loadingIndicator.style.display = 'block';
        passwordContent.style.display = 'none';
        
        try {
            console.log('Fetching password file from:', repoContentsUrl);
            const response = await fetch(repoContentsUrl, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('GitHub API Error:', response.status, errorData);
                throw new Error(`Failed to fetch password file: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            currentFileSha = data.sha;
            
            const content = atob(data.content);
            parseUserData(content);
            
            loadingIndicator.style.display = 'none';
            passwordContent.style.display = 'block';
            
        } catch (error) {
            console.error('Error fetching file:', error);
            showNotification('Failed to load user data: ' + error.message, true);
            loadingIndicator.style.display = 'none';
        }
    }
    
    // Parse user data from file content with the updated format: username|displayname|password|roles
    function parseUserData(content) {
        usersData = [];

        // Split by lines first, then process each line
        const lines = content.split('\n').filter(line => line.trim() !== '');

        lines.forEach(line => {
            // Remove trailing comma if exists
            const cleanLine = line.trim().endsWith(',') 
                ? line.trim().substring(0, line.trim().length - 1) 
                : line.trim();

            // Extract user parts from each line
            const parts = cleanLine.split('|');

            if (parts.length === 4) {
                // New format with roles: username|displayname|password|roles
                const username = parts[0].trim();
                const displayName = parts[1].trim();
                const password = parts[2].trim();
                const roles = parts[3].trim().split('-');

                usersData.push({
                    username,
                    displayName,
                    password,
                    roles: roles,
                    baseRole: getUserRole(username)
                });
            } else if (parts.length === 3) {
                // Previous format: username|displayname|password
                const username = parts[0].trim();
                const displayName = parts[1].trim();
                const password = parts[2].trim();

                usersData.push({
                    username,
                    displayName,
                    password,
                    roles: [getUserRole(username)],
                    baseRole: getUserRole(username)
                });
            } else if (parts.length === 2) {
                // Handle old format for backwards compatibility: username|password
                const username = parts[0].trim();
                const password = parts[1].trim();

                // Convert username format to display name
                const displayName = username
                    .split('_')
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ');

                usersData.push({
                    username,
                    displayName,
                    password,
                    roles: [getUserRole(username)],
                    baseRole: getUserRole(username)
                });
            }
        });

        renderUserTable();
    }
    
    // Convert input value to valid username format (replace spaces with underscores)
    function formatUsername(input) {
        return input.replace(/\s+/g, '_').toLowerCase();
    }
    
    // Generate display name from username
    function generateDisplayName(username) {
        return username
            .split('_')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
    
    // Function to prevent multiple rapid saves
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    }
    
    // Render the user table with current data
    function renderUserTable() {
        userTableBody.innerHTML = '';

        usersData.forEach((user, index) => {
            const row = document.createElement('tr');
            row.className = 'user-row';
            row.setAttribute('data-index', index);

            // Username cell
            const usernameCell = document.createElement('td');
            const usernameInput = document.createElement('input');
            usernameInput.type = 'text';
            usernameInput.value = user.username;
            usernameInput.className = user.baseRole;
            usernameInput.addEventListener('change', (e) => {
                const formattedUsername = formatUsername(e.target.value);
                usernameInput.value = formattedUsername;
                usersData[index].username = formattedUsername;

                const oldAutoDisplay = generateDisplayName(user.username);
                if (user.displayName === oldAutoDisplay) {
                    usersData[index].displayName = generateDisplayName(formattedUsername);
                }

                const newBaseRole = getUserRole(formattedUsername);
                usersData[index].baseRole = newBaseRole;

                // Update roles if it only had the base role before
                if (user.roles.length === 1 && user.roles[0] === user.baseRole) {
                    usersData[index].roles = [newBaseRole];
                }

                savePasswordFile().then(() => {
                    renderUserTable();
                });
            });

            // Add focus/blur event listeners to track editor state
            usernameInput.addEventListener('focus', () => {
                isEditorFocused = true;
            });
            usernameInput.addEventListener('blur', () => {
                isEditorFocused = false;
            });

            usernameCell.appendChild(usernameInput);
            row.appendChild(usernameCell);

            // Display name cell - now editable
            const displayNameCell = document.createElement('td');
            const displayNameInput = document.createElement('input');
            displayNameInput.type = 'text';
            displayNameInput.value = user.displayName;
            displayNameInput.className = user.baseRole;
            displayNameInput.addEventListener('change', (e) => {
                usersData[index].displayName = e.target.value;
                savePasswordFile();
            });

            // Add focus/blur event listeners to track editor state
            displayNameInput.addEventListener('focus', () => {
                isEditorFocused = true;
            });
            displayNameInput.addEventListener('blur', () => {
                isEditorFocused = false;
            });

            displayNameCell.appendChild(displayNameInput);
            row.appendChild(displayNameCell);

            // Password cell
            const passwordCell = document.createElement('td');
            const passwordInput = document.createElement('input');
            passwordInput.type = 'text';
            passwordInput.value = user.password;
            passwordInput.className = user.baseRole;
            passwordInput.addEventListener('change', (e) => {
                usersData[index].password = e.target.value;
                savePasswordFile();
            });

            // Add focus/blur event listeners to track editor state
            passwordInput.addEventListener('focus', () => {
                isEditorFocused = true;
            });
            passwordInput.addEventListener('blur', () => {
                isEditorFocused = false;
            });

            passwordCell.appendChild(passwordInput);
            row.appendChild(passwordCell);

            // Roles cell
            const rolesCell = document.createElement('td');
            const rolesDisplay = document.createElement('div');
            rolesDisplay.className = 'roles-display';
            rolesDisplay.textContent = user.roles.join(', ');
            rolesCell.appendChild(rolesDisplay);

            // Edit roles button
            const editRolesButton = document.createElement('button');
            editRolesButton.className = 'btn btn-small';
            editRolesButton.textContent = 'Edit Roles';
            editRolesButton.addEventListener('click', () => {
                openRolesEditor(index);
            });
            rolesCell.appendChild(editRolesButton);
            row.appendChild(rolesCell);

            const actionsCell = document.createElement('td');
            actionsCell.className = 'actions-cell';

            const moveUpButton = document.createElement('button');
            moveUpButton.className = 'btn btn-small';
            moveUpButton.innerHTML = '&uarr;';
            moveUpButton.title = 'Move Up';
            moveUpButton.addEventListener('click', () => {
                if (index > 0) {
                    [usersData[index], usersData[index-1]] = [usersData[index-1], usersData[index]];

                    // Save changes and re-render
                    savePasswordFile().then(() => {
                        renderUserTable();
                        showNotification('User moved up and saved.');
                    });
                }
            });

            const moveDownButton = document.createElement('button');
            moveDownButton.className = 'btn btn-small';
            moveDownButton.innerHTML = '&darr;';
            moveDownButton.title = 'Move Down';
            moveDownButton.addEventListener('click', () => {
                if (index < usersData.length - 1) {
                    [usersData[index], usersData[index+1]] = [usersData[index+1], usersData[index]];

                    // Save changes and re-render
                    savePasswordFile().then(() => {
                        renderUserTable();
                        showNotification('User moved down and saved.');
                    });
                }
            });

            // Delete button
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn btn-small btn-delete';
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', () => {
                usersData.splice(index, 1);

                // Save changes and re-render
                savePasswordFile().then(() => {
                    renderUserTable();
                    showNotification('User deleted and saved.');
                });
            });

            // Add buttons to actions cell
            actionsCell.appendChild(moveUpButton);
            actionsCell.appendChild(moveDownButton);
            actionsCell.appendChild(deleteButton);
            row.appendChild(actionsCell);

            userTableBody.appendChild(row);
        });
    }
    
    // Generate file content from users data with the updated format: username|displayname|password|roles
    function generateFileContent() {
        let content = '';

        if (usersData.length > 0) {
            usersData.forEach((user, index) => {
                const rolesString = user.roles.join('-');
                content += `${user.username}|${user.displayName}|${user.password}|${rolesString}`;
                if (index < usersData.length - 1) {
                    content += ',\n';
                }
            });
        }

        return content;
    }
    
    // Save the password file to GitHub
    async function savePasswordFile() {
        if (isSaving) return Promise.resolve();
        
        isSaving = true;
        showSavingIndicator();
        
        try {
            const content = generateFileContent();
            
            // Encode content to Base64
            const base64Content = btoa(content);
            
            const response = await fetch(repoContentsUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: 'Update passwords file',
                    content: base64Content,
                    sha: currentFileSha
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('GitHub API Error:', response.status, errorData);
                throw new Error(`Failed to save password file: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            currentFileSha = data.content.sha;
            
            showNotification('Changes saved successfully!');
            return Promise.resolve();
            
        } catch (error) {
            console.error('Error saving file:', error);
            showNotification('Failed to save user data: ' + error.message, true);
            return Promise.reject(error);
        } finally {
            isSaving = false;
            hideSavingIndicator();
        }
    }
    
    // Add a new user
    function addNewUser() {
        const username = formatUsername(newUsername.value.trim());
        // Use entered password or default if empty
        const password = newPassword.value.trim() || config.defaultPassword;

        if (!username) {
            showNotification('Username is required', true);
            return;
        }

        // Check if username already exists
        if (usersData.some(user => user.username === username)) {
            showNotification('This username already exists', true);
            return;
        }

        // Generate display name from username
        const displayName = generateDisplayName(username);
        const baseRole = getUserRole(username);

        // Add the new user with the new format
        usersData.push({
            username,
            displayName,
            password,
            roles: [baseRole],
            baseRole
        });

        // Save the new user data
        savePasswordFile().then(() => {
            newUsername.value = '';
            newPassword.value = '';
            renderUserTable();

            showNotification(`User added with ${password === config.defaultPassword ? 'default' : 'custom'} password and saved successfully!`);
        });
    }
    
    // Admin login
    function adminLogin() {
        const enteredPassword = adminPassword.value;
        
        if (enteredPassword === adminPasswordFromRepo) {
            showPasswordManagement();
            fetchPasswordFile();
        } else {
            adminLoginError.textContent = 'Incorrect admin password.';
        }
    }
    
    // Admin logout
    function adminLogout() {
        sessionStorage.removeItem('adminLoggedIn');
        adminLoginForm.style.display = 'block';
        passwordManagement.style.display = 'none';
        adminPassword.value = '';
    }
    
    // Handle Ctrl+S keyboard shortcut
    function handleKeyboardShortcut(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            
            if (passwordManagement.style.display === 'block') {
                savePasswordFile();
            }
        }
    }
    
    adminLoginButton.addEventListener('click', adminLogin);
    
    adminPassword.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            adminLogin();
        }
    });
    
    addUserButton.addEventListener('click', addNewUser);
    
    newUsername.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            addNewUser();
        }
    });
    
    newPassword.addEventListener('keypress', function(event) {
        if (event.key === 'Enter' && newUsername.value.trim()) {
            addNewUser();
        }
    });
    
    logoutButton.addEventListener('click', adminLogout);
    
    document.addEventListener('keydown', handleKeyboardShortcut);
    newUsername.addEventListener('focus', () => { isEditorFocused = true; });
    newUsername.addEventListener('blur', () => { isEditorFocused = false; });
    newPassword.addEventListener('focus', () => { isEditorFocused = true; });
    newPassword.addEventListener('blur', () => { isEditorFocused = false; });
    
    initializePage();
    
    adminLoginButton.disabled = true;
});
