document.addEventListener('DOMContentLoaded', function() {
    // Configuration - Replace with your actual GitHub details
    const config = {
        githubUser: 'parkerrasys',
        githubRepo: '8709-Storage',
        passwordFilePath: 'users.txt',
        adminPasswordFilePath: 'admin-password.txt',
        // Updated token with read/write permissions
        githubToken: process.env.GITHUB_TOKEN,
        // Default password for new users
        defaultPassword: '1234'
    };
    
    // DOM Elements
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
    
    // Remove the saveChangesButton from DOM if it exists
    const saveChangesButton = document.getElementById('saveChangesButton');
    if (saveChangesButton) {
        saveChangesButton.remove();
    }
    
    // Create notification container
    const notificationContainer = document.createElement('div');
    notificationContainer.id = 'notificationContainer';
    document.body.appendChild(notificationContainer);
    
    // Add notification styles
    addNotificationStyles();
    
    // Add user row styles
    addUserRowStyles();
    
    // Update password field placeholder to show default
    if (newPassword) {
        newPassword.placeholder = `Default: ${config.defaultPassword}`;
    }
    
    // GitHub API endpoints
    const githubApiBase = 'https://api.github.com';
    const repoContentsUrl = `${githubApiBase}/repos/${config.githubUser}/${config.githubRepo}/contents/${config.passwordFilePath}`;
    const adminPasswordUrl = `${githubApiBase}/repos/${config.githubUser}/${config.githubRepo}/contents/${config.adminPasswordFilePath}`;
    
    // Store current file SHA (needed for updates)
    let currentFileSha = '';
    
    // Store users data
    let usersData = [];
    
    // Store admin password
    let adminPasswordFromRepo = '';
    
    // Flag to prevent multiple simultaneous saves
    let isSaving = false;
    
    // Flag to track if editor is in focus
    let isEditorFocused = false;
    
    // Create logout button if it doesn't exist
    function createLogoutButton() {
        const button = document.createElement('button');
        button.id = 'logoutButton';
        button.className = 'btn btn-secondary';
        button.textContent = 'Logout';
        button.style.marginLeft = '10px';
        
        // Find a good place to insert the button
        const buttonContainer = document.querySelector('.button-container') || 
                               document.querySelector('.controls') || 
                               document.querySelector('.form-actions');
        
        if (buttonContainer) {
            buttonContainer.appendChild(button);
        } else {
            // If no container is found, create one
            const container = document.createElement('div');
            container.className = 'form-actions button-container';
            container.appendChild(button);
            passwordContent.appendChild(container);
        }
        
        return button;
    }
    
    // Add notification styling
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
    
    // Add user row styles
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
        
        // Create saving indicator element
        const savingIndicator = document.createElement('div');
        savingIndicator.className = 'saving-indicator';
        savingIndicator.id = 'savingIndicator';
        savingIndicator.textContent = 'Saving changes...';
        document.body.appendChild(savingIndicator);
        
        // Create keyboard shortcut indicator
        const shortcutIndicator = document.createElement('div');
        shortcutIndicator.className = 'keyboard-shortcut-indicator';
        shortcutIndicator.id = 'shortcutIndicator';
        shortcutIndicator.textContent = 'Press Ctrl+S to save changes';
        document.body.appendChild(shortcutIndicator);
    }
    
    // Show notification
    function showNotification(message, isError = false) {
        const notification = document.createElement('div');
        notification.className = `notification ${isError ? 'error' : 'success'}`;
        notification.textContent = message;
        
        // Add progress bar
        const progress = document.createElement('div');
        progress.className = 'notification-progress';
        notification.appendChild(progress);
        
        notificationContainer.appendChild(notification);
        
        // Remove the notification after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out forwards';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 5000);
    }
    
    // Display saving indicator
    function showSavingIndicator() {
        const indicator = document.getElementById('savingIndicator');
        indicator.style.display = 'block';
    }
    
    // Hide saving indicator
    function hideSavingIndicator() {
        const indicator = document.getElementById('savingIndicator');
        indicator.style.display = 'none';
    }
    
    // Determine user role based on username
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
    
    // Always require login - removed session persistence
    function initializePage() {
        // Always start with login screen
        adminLoginForm.style.display = 'block';
        passwordManagement.style.display = 'none';
        
        // Clear any previous session
        sessionStorage.removeItem('adminLoggedIn');
        
        // Fetch admin password from repository
        fetchAdminPassword();
    }
    
    // Fetch admin password from GitHub
    async function fetchAdminPassword() {
        try {
            const response = await fetch(adminPasswordUrl, {
                headers: {
                    'Authorization': `token ${config.githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('GitHub API Error:', response.status, errorData);
                throw new Error(`Failed to fetch admin password file: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Decode content from Base64
            adminPasswordFromRepo = atob(data.content).trim();
            
            // Enable login button now that admin password is loaded
            adminLoginButton.disabled = false;
            
        } catch (error) {
            console.error('Error fetching admin password:', error);
            adminLoginError.textContent = `Unable to connect to authentication service: ${error.message}`;
            adminLoginButton.disabled = true;
        }
    }
    
    // Show the password management interface
    function showPasswordManagement() {
        adminLoginForm.style.display = 'none';
        passwordManagement.style.display = 'block';
    }
    
    // Fetch the password file from GitHub
    async function fetchPasswordFile() {
        loadingIndicator.style.display = 'block';
        passwordContent.style.display = 'none';
        
        try {
            console.log('Fetching password file from:', repoContentsUrl);
            const response = await fetch(repoContentsUrl, {
                headers: {
                    'Authorization': `token ${config.githubToken}`,
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
            
            // Decode content from Base64
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
    
    // Parse user data from file content with the new format: username|displayname|password
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
            
            if (parts.length === 3) {
                // New format: username|displayname|password
                const username = parts[0].trim();
                const displayName = parts[1].trim();
                const password = parts[2].trim();
                
                usersData.push({
                    username,
                    displayName,
                    password,
                    role: getUserRole(username)
                });
            } else if (parts.length === 2) {
                // Handle old format for backwards compatibility: username|password
                const username = parts[0].trim();
                const password = parts[1].trim();
                
                // Convert username format to display name (e.g., "parker_rasys" to "Parker Rasys")
                const displayName = username
                    .split('_')
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ');
                
                usersData.push({
                    username,
                    displayName,
                    password,
                    role: getUserRole(username)
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
    
    // Debounce function to prevent multiple rapid saves
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
        // Clear existing rows
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
            usernameInput.className = user.role;
            usernameInput.addEventListener('change', (e) => {
                const formattedUsername = formatUsername(e.target.value);
                usernameInput.value = formattedUsername;
                usersData[index].username = formattedUsername;
                
                // Update display name if it matches the auto-generated format
                const oldAutoDisplay = generateDisplayName(user.username);
                if (user.displayName === oldAutoDisplay) {
                    usersData[index].displayName = generateDisplayName(formattedUsername);
                }
                
                usersData[index].role = getUserRole(formattedUsername);
                
                // Re-render the table to update the display name and role styling
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
            displayNameInput.className = user.role;
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
            passwordInput.className = user.role;
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
            
            // Actions cell
            const actionsCell = document.createElement('td');
            actionsCell.className = 'actions-cell';
            
            // Reorder buttons
            const moveUpButton = document.createElement('button');
            moveUpButton.className = 'btn btn-small';
            moveUpButton.innerHTML = '&uarr;';
            moveUpButton.title = 'Move Up';
            moveUpButton.addEventListener('click', () => {
                if (index > 0) {
                    // Swap with previous item
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
                    // Swap with next item
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
    
    // Generate file content from users data with the new format: username|displayname|password
    function generateFileContent() {
        let content = '';
        
        // Format with one entry per line, each ending with a comma except the last one
        if (usersData.length > 0) {
            usersData.forEach((user, index) => {
                content += `${user.username}|${user.displayName}|${user.password}`;
                if (index < usersData.length - 1) {
                    content += ',\n';
                }
            });
        }
        
        return content;
    }
    
    // Save the password file to GitHub
    async function savePasswordFile() {
        // Don't save if already saving
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
                    'Authorization': `token ${config.githubToken}`,
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
        const role = getUserRole(username);
        
        // Add the new user with the new format
        usersData.push({
            username,
            displayName,
            password,
            role
        });
        
        // Save the new user data
        savePasswordFile().then(() => {
            // Reset form fields
            newUsername.value = '';
            newPassword.value = '';
            
            // Update the table
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
        // Clear any login state
        sessionStorage.removeItem('adminLoggedIn');
        // Reset back to login screen
        adminLoginForm.style.display = 'block';
        passwordManagement.style.display = 'none';
        // Clear password field for security
        adminPassword.value = '';
    }
    
    // Handle Ctrl+S keyboard shortcut
    function handleKeyboardShortcut(event) {
        // Check if Ctrl+S was pressed (metaKey for Mac)
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            // Prevent the default browser save action
            event.preventDefault();
            
            // Only save if we're in the password management section
            if (passwordManagement.style.display === 'block') {
                savePasswordFile();
            }
        }
    }
    
    // Event Listeners
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
    
    // Add global keydown event listener for Ctrl+S
    document.addEventListener('keydown', handleKeyboardShortcut);
    
    // Track focus on new username and password fields
    newUsername.addEventListener('focus', () => { isEditorFocused = true; });
    newUsername.addEventListener('blur', () => { isEditorFocused = false; });
    newPassword.addEventListener('focus', () => { isEditorFocused = true; });
    newPassword.addEventListener('blur', () => { isEditorFocused = false; });
    
    // Initialize the page - always require login
    initializePage();
    
    // Initially disable login button until admin password is loaded
    adminLoginButton.disabled = true;
});