
document.addEventListener('DOMContentLoaded', function() {
    // Configuration object
    const config = {
        github: {
            user: 'parkerrasys',
            repo: '8709-Storage',
            passwordFile: 'users.txt'
        },
        googleSheets: {
            apiKey: 'AIzaSyC-CRiUBM4ZNQXU_nTjRNjX_YcbRG95TsE',
            spreadsheetId: '1MZ6T17q-IcUI2AnZ1nVXtlfyMOHxLl_kTUb5YEI_uLg',
            cellRange: 'A1:A1'
        }
    };

    // DOM Elements
    const elements = {
        loginButton: document.getElementById('loginButton'),
        username: document.getElementById('memberUsername'),
        password: document.getElementById('memberPassword'),
        loginError: document.getElementById('loginError')
    };

    // State management
    let githubToken = '';
    let validPasswords = {};

    // Initialize the page
    function initialize() {
        checkLoginStatus();
        elements.loginButton.disabled = true;
        fetchGithubToken();
        setupEventListeners();
    }

    // Event listeners setup
    function setupEventListeners() {
        elements.loginButton.addEventListener('click', attemptLogin);
        elements.username.addEventListener('keypress', handleEnterKey);
        elements.password.addEventListener('keypress', handleEnterKey);
    }

    // Handle enter key press
    function handleEnterKey(event) {
        if (event.key === 'Enter') {
            attemptLogin();
        }
    }

    // Check if user is already logged in
    function checkLoginStatus() {
        const isLoggedIn = sessionStorage.getItem('memberLoggedIn');
        if (isLoggedIn === 'true') {
            window.location.href = 'member-area.html';
        }
    }

    // Fetch GitHub token from Google Sheets
    async function fetchGithubToken() {
        try {
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.googleSheets.spreadsheetId}/values/${config.googleSheets.cellRange}?key=${config.googleSheets.apiKey}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Failed to fetch GitHub token from Google Sheets');
            }

            const data = await response.json();
            if (data.values?.[0]?.[0]) {
                githubToken = data.values[0][0];
                elements.loginButton.disabled = false;
                await fetchPasswords();
            } else {
                throw new Error('No GitHub token found');
            }
        } catch (error) {
            console.error('Error fetching GitHub token:', error);
            elements.loginError.textContent = 'Unable to connect to authentication service. Please try again later.';
            elements.loginButton.disabled = true;
        }
    }

    // Fetch passwords from GitHub
    async function fetchPasswords() {
        try {
            const repoContentsUrl = `https://api.github.com/repos/${config.github.user}/${config.github.repo}/contents/${config.github.passwordFile}`;
            const response = await fetch(repoContentsUrl, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch authentication data');
            }

            const data = await response.json();
            const passwordData = atob(data.content);
            parsePasswordData(passwordData);
            elements.loginButton.disabled = false;
        } catch (error) {
            console.error('Error fetching passwords:', error);
            elements.loginError.textContent = 'Unable to connect to authentication service. Please try again later.';
            elements.loginButton.disabled = true;
        }
    }

    // Parse password data
    function parsePasswordData(data) {
        validPasswords = {};
        const entries = data.split(/,|\n/).filter(entry => entry.trim() !== '');

        entries.forEach(entry => {
            const parts = entry.trim().split('|');
            const username = parts[0].trim();

            if (parts.length === 4) {
                // New format: username|displayName|password|roles
                validPasswords[username] = {
                    displayName: parts[1].trim(),
                    password: parts[2].trim(),
                    roles: parts[3].trim().split('-').map(role => role.trim())
                };
            } else if (parts.length === 3) {
                // Old format: username|displayName|password
                validPasswords[username] = {
                    displayName: parts[1].trim(),
                    password: parts[2].trim(),
                    roles: ['member']
                };
            } else if (parts.length === 2) {
                // Legacy format: username|password
                const displayName = username
                    .split('_')
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ');

                validPasswords[username] = {
                    displayName: displayName,
                    password: parts[1].trim(),
                    roles: ['member']
                };
            }
        });
    }

    // Login attempt handler
    function attemptLogin() {
        const enteredUsername = elements.username.value.trim();
        const enteredPassword = elements.password.value;
        elements.loginError.textContent = '';

        if (!validateInputs(enteredUsername, enteredPassword)) {
            return;
        }

        if (validateCredentials(enteredUsername, enteredPassword)) {
            handleSuccessfulLogin(enteredUsername);
        } else {
            elements.loginError.textContent = 'Invalid username or password. Please try again.';
        }
    }

    // Input validation
    function validateInputs(username, password) {
        if (!username) {
            elements.loginError.textContent = 'Please enter your username.';
            return false;
        }
        if (!password) {
            elements.loginError.textContent = 'Please enter your password.';
            return false;
        }
        return true;
    }

    // Credential validation
    function validateCredentials(username, password) {
        return validPasswords[username] && validPasswords[username].password === password;
    }

    // Handle successful login
    function handleSuccessfulLogin(username) {
        sessionStorage.setItem('memberLoggedIn', 'true');
        sessionStorage.setItem('memberName', username);
        sessionStorage.setItem('memberDisplayName', validPasswords[username].displayName);
        sessionStorage.setItem('memberRoles', JSON.stringify(validPasswords[username].roles));
        window.location.href = 'member-area.html';
    }

    // Initialize the page
    initialize();
});
