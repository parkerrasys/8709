document.addEventListener('DOMContentLoaded', function() {
    const loginButton = document.getElementById('loginButton');
    const memberSelect = document.getElementById('memberSelect');
    const memberPassword = document.getElementById('memberPassword');
    const loginError = document.getElementById('loginError');
    
    // GitHub repository details - same repo as admin page but now private
    const githubUser = 'parkerrasys';
    const githubRepo = '8709-Storage';
    const passwordFilePath = 'users.txt';
    const githubToken = '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';
    
    // GitHub API endpoints
    const repoContentsUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${passwordFilePath}`;
    
    // Object to store passwords after fetching from GitHub
    let validPasswords = {};
    
    // Fetch passwords from private GitHub repository
    async function fetchPasswords() {
        try {
            const response = await fetch(repoContentsUrl, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch authentication data');
            }
            
            const data = await response.json();
            
            // Decode content from Base64
            const passwordData = atob(data.content);
            parsePasswordData(passwordData);
            
            // Enable login button after passwords are loaded
            loginButton.disabled = false;
            
        } catch (error) {
            console.error('Error fetching passwords:', error);
            loginError.textContent = 'Unable to connect to authentication service. Please try again later.';
            loginButton.disabled = true;
        }
    }
    
    // Parse password data from file
    function parsePasswordData(data) {
        // Reset passwords object
        validPasswords = {};

        // Split the data by commas and/or newlines
        const entries = data.split(/,|\n/).filter(entry => entry.trim() !== '');

        // Process each entry
        entries.forEach(entry => {
            const parts = entry.trim().split('|');
            if (parts.length === 3) {
                // New format: username|displayName|password
                const username = parts[0].trim();
                const displayName = parts[1].trim();
                const password = parts[2].trim();
                validPasswords[username] = {
                    displayName: displayName,
                    password: password
                };
            } else if (parts.length === 2) {
                // Old format for backward compatibility
                const username = parts[0].trim();
                const password = parts[1].trim();
                // Generate display name from username
                const displayName = username
                    .split('_')
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ');
                validPasswords[username] = {
                    displayName: displayName,
                    password: password
                };
            }
        });
    
        // Populate the member select dropdown with usernames from the file
        populateMemberSelect();
    }
    
    // Populate member select dropdown with usernames
    function populateMemberSelect() {
        // Clear existing options except the first one
        while (memberSelect.options.length > 1) {
            memberSelect.remove(1);
        }

        // Add options from validPasswords
        Object.keys(validPasswords).forEach(username => {
            const option = document.createElement('option');
            option.value = username;
            option.textContent = validPasswords[username].displayName;
            memberSelect.appendChild(option);
        });
    }
    
    // Check if user is already logged in
    function checkLoginStatus() {
        const isLoggedIn = sessionStorage.getItem('memberLoggedIn');
        const memberPage = 'member-area.html';
        
        if (isLoggedIn === 'true') {
            window.location.href = memberPage;
        }
    }
    
    // Run login status check when the page loads
    checkLoginStatus();
    
    // Run password fetch when the page loads
    fetchPasswords();
    
    // Initially disable the login button until passwords are loaded
    loginButton.disabled = true;
    
    // Login function
    function attemptLogin() {
        const selectedMember = memberSelect.value;
        const enteredPassword = memberPassword.value;
        
        // Clear previous error messages
        loginError.textContent = '';
        
        // Check if a member was selected
        if (!selectedMember) {
            loginError.textContent = 'Please select your name.';
            return;
        }
        
        // Check if password was entered
        if (!enteredPassword) {
            loginError.textContent = 'Please enter your password.';
            return;
        }
        
        // Check if the password is correct for the selected member
        if (validPasswords[selectedMember].password === enteredPassword) {
            // Store login status in session storage
            sessionStorage.setItem('memberLoggedIn', 'true');
            sessionStorage.setItem('memberName', selectedMember);
            sessionStorage.setItem('memberDisplayName', validPasswords[selectedMember].displayName);
            
            // Redirect to member area
            window.location.href = 'member-area.html';
        } else {
            loginError.textContent = 'Incorrect password. Please try again.';
        }
    }
    
    // Add click event listener to login button
    loginButton.addEventListener('click', attemptLogin);
    
    // Allow form submission with Enter key
    memberPassword.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            attemptLogin();
        }
    });
});