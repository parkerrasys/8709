document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const isLoggedIn = sessionStorage.getItem('memberLoggedIn');
    const memberName = sessionStorage.getItem('memberName');
    
    // If not logged in, redirect to login page
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'member-login.html';
        return;
    }
    
    // Display member name
    const memberNameDisplay = document.getElementById('memberNameDisplay');
    if (memberNameDisplay) {
        // Use the stored display name directly
        const displayName = sessionStorage.getItem('memberDisplayName');

        if (displayName) {
            memberNameDisplay.textContent = displayName;
        } else {
            // Fallback to converting username if no display name is stored
            const memberName = sessionStorage.getItem('memberName');
            if (memberName) {
                const generatedDisplayName = memberName
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                memberNameDisplay.textContent = generatedDisplayName;
            }
        }
    }
    
    // GitHub repository details for fetching user data
    const githubUser = 'parkerrasys';
    const githubRepo = '8709-Storage';
    const passwordFilePath = 'users.txt';
    let githubToken = '';
    
    const API_KEY = 'AIzaSyC-CRiUBM4ZNQXU_nTjRNjX_YcbRG95TsE';
    const SPREADSHEET_ID = '1MZ6T17q-IcUI2AnZ1nVXtlfyMOHxLl_kTUb5YEI_uLg';
    const CELL_RANGE = 'A1:A1';
    
    // Fetch GitHub token and then user data
    async function refreshUserData() {
        try {
            // Fetch GitHub token
            const tokenUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${CELL_RANGE}?key=${API_KEY}`;
            const tokenResponse = await fetch(tokenUrl);
            
            if (!tokenResponse.ok) {
                throw new Error('Failed to fetch GitHub token');
            }
            
            const tokenData = await tokenResponse.json();
            
            if (tokenData.values && tokenData.values.length > 0 && tokenData.values[0].length > 0) {
                githubToken = tokenData.values[0][0];
                
                // Now fetch user data
                await fetchUserData();
            } else {
                throw new Error('No GitHub token found');
            }
        } catch (error) {
            console.error('Error refreshing user data:', error);
        }
    }
    
    // Fetch user data from GitHub
    async function fetchUserData() {
        try {
            const repoContentsUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${passwordFilePath}`;
            
            const response = await fetch(repoContentsUrl, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                cache: 'no-store' // Prevent caching
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }
            
            const data = await response.json();
            const userData = atob(data.content);
            
            // Get current username
            const currentUsername = sessionStorage.getItem('memberName');
            
            // Update user roles if the username exists in the data
            updateUserRoles(userData, currentUsername);
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }
    
    // Update user roles based on fetched data
    function updateUserRoles(userData, username) {
        if (!username) return;
        
        const entries = userData.split(/,|\n/).filter(entry => entry.trim() !== '');
        
        // Find the current user's entry
        for (const entry of entries) {
            const parts = entry.trim().split('|');
            
            if (parts.length >= 2 && parts[0].trim() === username) {
                // Found the user, update roles
                if (parts.length >= 4) {
                    // Format: username|displayName|password|role1-role2-role3
                    const rolesString = parts[3].trim();
                    const roles = rolesString.split('-').map(role => role.trim());
                    
                    // Update roles in session storage
                    sessionStorage.setItem('memberRoles', JSON.stringify(roles));
                    
                    // Also update display name if it's changed
                    if (parts.length >= 2) {
                        const displayName = parts[1].trim();
                        sessionStorage.setItem('memberDisplayName', displayName);
                        
                        // Update display name on the page if element exists
                        const memberNameDisplay = document.getElementById('memberNameDisplay');
                        if (memberNameDisplay) {
                            memberNameDisplay.textContent = displayName;
                        }
                    }
                    
                    // Apply updated roles to the UI
                    applyRolesToUI();
                    break;
                }
            }
        }
    }
    
    // Get user roles from session storage
    function getUserRoles() {
        let memberRoles = [];
        try {
            const rolesString = sessionStorage.getItem('memberRoles');
            if (rolesString) {
                memberRoles = JSON.parse(rolesString);
            } else {
                memberRoles = ['member']; // Default role
            }
        } catch (error) {
            console.error('Error parsing roles:', error);
            memberRoles = ['member']; // Default to member if there's an error
        }
        return memberRoles;
    }
    
    // Helper function to check if user has a specific role
    function hasRole(role) {
        const memberRoles = getUserRoles();
        return memberRoles.includes(role);
    }
    
    // Apply roles to the UI elements
    function applyRolesToUI() {
        const memberRoles = getUserRoles();
        
        // Conditionally show/hide elements based on roles
        const adminElements = document.querySelectorAll('[data-role="admin"]');
        const moderatorElements = document.querySelectorAll('[data-role="moderator"]');
        
        // Show/hide admin elements
        if (adminElements.length > 0) {
            const isAdmin = hasRole('admin');
            adminElements.forEach(element => {
                element.style.display = isAdmin ? 'block' : 'none';
            });
        }
        
        // Show/hide moderator elements
        if (moderatorElements.length > 0) {
            const isModerator = hasRole('moderator') || hasRole('admin'); // Admins can see moderator content
            moderatorElements.forEach(element => {
                element.style.display = isModerator ? 'block' : 'none';
            });
        }
        
        // Display roles if there's a roles display element
        const rolesDisplay = document.getElementById('memberRolesDisplay');
        if (rolesDisplay) {
            rolesDisplay.textContent = memberRoles.join(', ');
        }
    }
    
    // Initial application of roles to UI
    applyRolesToUI();
    
    // Refresh user data from GitHub when page loads
    refreshUserData();
    
    // Handle logout
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            // Clear session storage
            sessionStorage.removeItem('memberLoggedIn');
            sessionStorage.removeItem('memberName');
            sessionStorage.removeItem('memberDisplayName');
            sessionStorage.removeItem('memberRoles');
            // Redirect to login page
            window.location.href = 'index.html';
        });
    }
    
    // Task filtering functionality
    const taskFilters = document.querySelectorAll('.task-filter');
    const taskItems = document.querySelectorAll('.task-item');
    
    taskFilters.forEach(filter => {
        filter.addEventListener('click', function() {
            // Remove active class from all filters
            taskFilters.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked filter
            this.classList.add('active');
            
            const filterValue = this.getAttribute('data-filter');
            
            // Show/hide tasks based on filter
            taskItems.forEach(item => {
                if (filterValue === 'all' || item.getAttribute('data-category') === filterValue) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
    
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('nav a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                // Scroll to section with smooth behavior
                targetSection.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Footer navigation links smooth scrolling
    const footerLinks = document.querySelectorAll('.footer-links a[href^="#"]');
    
    footerLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                // Scroll to section with smooth behavior
                targetSection.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Resource card hover animation
    const resourceCards = document.querySelectorAll('.resource-card');
    
    resourceCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px)';
            this.style.transition = 'transform 0.3s ease';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
    
    // Task priority visualization
    const taskPriorities = document.querySelectorAll('.task-priority');
    
    taskPriorities.forEach(priority => {
        const priorityText = priority.textContent.toLowerCase();
        
        if (priorityText.includes('high')) {
            priority.classList.add('high');
        } else if (priorityText.includes('medium')) {
            priority.classList.add('medium');
        } else if (priorityText.includes('low')) {
            priority.classList.add('low');
        }
    });
    
    // Add team specific alerts if needed
    const showTeamAlerts = sessionStorage.getItem('showTeamAlerts');
    
    if (!showTeamAlerts || showTeamAlerts !== 'false') {
        // Create and show a notification for the upcoming meeting
        const meetingNotification = document.createElement('div');
        meetingNotification.style.position = 'fixed';
        meetingNotification.style.bottom = '20px';
        meetingNotification.style.right = '20px';
        meetingNotification.style.backgroundColor = '#e6c060';
        meetingNotification.style.color = '#0a2638';
        meetingNotification.style.padding = '15px 20px';
        meetingNotification.style.borderRadius = '5px';
        meetingNotification.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
        meetingNotification.style.zIndex = '1000';
        meetingNotification.innerHTML = `
            <p><strong>Reminder:</strong> Next team meeting on April 12, 2025 at 3:30 PM</p>
            <button id="closeNotification" style="background: #0d314e; color: #f0f5f9; border: none; padding: 5px 10px; margin-top: 10px; cursor: pointer; border-radius: 3px;">Dismiss</button>
        `;
        
        document.body.appendChild(meetingNotification);
        
        // Close notification functionality
        document.getElementById('closeNotification').addEventListener('click', function() {
            meetingNotification.style.display = 'none';
            sessionStorage.setItem('showTeamAlerts', 'false');
        });
        
        // Auto hide after 10 seconds
        setTimeout(() => {
            if (meetingNotification.parentNode) {
                meetingNotification.style.display = 'none';
            }
        }, 10000);
    }
    
    // Highlight current day in schedule
    const highlightCurrentDay = () => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = days[new Date().getDay()];
        
        const scheduleItems = document.querySelectorAll('.schedule-item');
        
        scheduleItems.forEach((item, index) => {
            if (index % 4 === 0 && item.textContent === today) {
                // Highlight the row (4 cells for this day)
                for (let i = 0; i < 4; i++) {
                    scheduleItems[index + i].style.backgroundColor = '#1a4b6d';
                    scheduleItems[index + i].style.fontWeight = 'bold';
                }
            }
        });
    };
    
    highlightCurrentDay();
});