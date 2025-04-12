document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('loginButton');
    const memberUsername = document.getElementById('memberUsername');
    const memberPassword = document.getElementById('memberPassword');
    const loginError = document.getElementById('loginError');
    
    const githubUser = 'parkerrasys';
    const githubRepo = '8709-Storage';
    const passwordFilePath = 'users.txt';
    let githubToken = '';
    
    const API_KEY = 'AIzaSyC-CRiUBM4ZNQXU_nTjRNjX_YcbRG95TsE';
    const SPREADSHEET_ID = '1MZ6T17q-IcUI2AnZ1nVXtlfyMOHxLl_kTUb5YEI_uLg';
    const CELL_RANGE = 'A1:A1';
    
    const repoContentsUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${passwordFilePath}`;
    
    let validPasswords = {};
    
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
                
                await fetchPasswords();
            } else {
                throw new Error('No GitHub token found in Google Sheets cell A1');
            }
        } catch (error) {
            console.error('Error fetching GitHub token:', error);
            loginError.textContent = 'Unable to connect to authentication service. Please try again later.';
            loginButton.disabled = true;
        }
    }
    
    async function fetchPasswords() {
        try {
            if (!githubToken) {
                throw new Error('GitHub token not available');
            }
            
            const response = await fetch(repoContentsUrl, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                // Add cache-busting parameter to prevent caching
                cache: 'no-store'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch authentication data');
            }
            
            const data = await response.json();
            
            const passwordData = atob(data.content);
            parsePasswordData(passwordData);
            
            loginButton.disabled = false;
            
        } catch (error) {
            console.error('Error fetching passwords:', error);
            loginError.textContent = 'Unable to connect to authentication service. Please try again later.';
            loginButton.disabled = true;
        }
    }
    
    function parsePasswordData(data) {
        validPasswords = {};

        const entries = data.split(/,|\n/).filter(entry => entry.trim() !== '');

        // Process each entry
        entries.forEach(entry => {
            const parts = entry.trim().split('|');
            if (parts.length === 4) {
                // New format: username|displayName|password|role1-role2-role3
                const username = parts[0].trim();
                const displayName = parts[1].trim();
                const password = parts[2].trim();
                const rolesString = parts[3].trim();
                const roles = rolesString.split('-').map(role => role.trim());
                
                validPasswords[username] = {
                    displayName: displayName,
                    password: password,
                    roles: roles
                };
            } else if (parts.length === 3) {
                // Old format: username|displayName|password
                const username = parts[0].trim();
                const displayName = parts[1].trim();
                const password = parts[2].trim();
                
                validPasswords[username] = {
                    displayName: displayName,
                    password: password,
                    roles: ['member'] // Default role
                };
            } else if (parts.length === 2) {
                // Legacy format: username|password
                const username = parts[0].trim();
                const password = parts[1].trim();
                const displayName = username
                    .split('_')
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ');
                
                validPasswords[username] = {
                    displayName: displayName,
                    password: password,
                    roles: ['member'] // Default role
                };
            }
        });
    }
    
    function checkLoginStatus() {
        const isLoggedIn = sessionStorage.getItem('memberLoggedIn');
        const memberPage = 'member-area.html';
        
        if (isLoggedIn === 'true') {
            window.location.href = memberPage;
        }
    }
    
    // Ensure everything runs in the correct order
    function initialize() {
        // Disable login button until data is loaded
        loginButton.disabled = true;
        
        // Check login status first
        checkLoginStatus();
        
        // Then fetch data (which will enable the button when complete)
        fetchGithubToken();
    }
    
    // Initialize the page
    initialize();
    
    // Login function
    function attemptLogin() {
        const enteredUsername = memberUsername.value.trim();
        const enteredPassword = memberPassword.value;
        
        loginError.textContent = '';
        
        if (!enteredUsername) {
            loginError.textContent = 'Please enter your username.';
            return;
        }
        
        if (!enteredPassword) {
            loginError.textContent = 'Please enter your password.';
            return;
        }
        
        if (validPasswords[enteredUsername] && validPasswords[enteredUsername].password === enteredPassword) {
            sessionStorage.setItem('memberLoggedIn', 'true');
            sessionStorage.setItem('memberName', enteredUsername);
            sessionStorage.setItem('memberDisplayName', validPasswords[enteredUsername].displayName);
            
            // Store user roles in session storage
            if (validPasswords[enteredUsername].roles) {
                sessionStorage.setItem('memberRoles', JSON.stringify(validPasswords[enteredUsername].roles));
            } else {
                sessionStorage.setItem('memberRoles', JSON.stringify(['member']));
            }
            
            window.location.href = 'member-area.html';
        } else {
            loginError.textContent = 'Invalid username or password. Please try again.';
        }
    }
    
    loginButton.addEventListener('click', attemptLogin);
    
    // Allow pressing Enter in either the username or password field to submit
    memberUsername.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            attemptLogin();
        }
    });
    
    memberPassword.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            attemptLogin();
        }
    });
});