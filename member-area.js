document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    const isLoggedIn = sessionStorage.getItem('memberLoggedIn');
    const memberName = sessionStorage.getItem('memberName');
    const scheduleFilePath = 'schedule.txt';
    
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
                
                // Also fetch schedule data
                await fetchScheduleData();
            } else {
                throw new Error('No GitHub token found');
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }

    async function fetchScheduleData() {
        try {
            const scheduleUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${scheduleFilePath}`;
            
            const response = await fetch(scheduleUrl, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                cache: 'no-store' // Prevent caching
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch schedule data');
            }
            
            const data = await response.json();
            const scheduleData = atob(data.content);
            
            // Parse and display the schedule
            parseAndDisplaySchedule(scheduleData);
        } catch (error) {
            console.error('Error fetching schedule data:', error);
        }
    }

    function parseAndDisplaySchedule(scheduleData) {
        try {
            // Parse the schedule entries
            // Format: day|time|location|description,
            const entries = scheduleData.split(',').map(entry => entry.trim()).filter(entry => entry !== '');
            const scheduleEntries = [];
            
            entries.forEach(entry => {
                const parts = entry.split('|');
                if (parts.length >= 4) {
                    scheduleEntries.push({
                        day: parts[0].trim(),
                        time: parts[1].trim(),
                        location: parts[2].trim(),
                        description: parts[3].trim()
                    });
                }
            });
            
            console.log('Parsed schedule entries:', scheduleEntries);
            
            // Display the schedule
            displaySchedule(scheduleEntries);
        } catch (error) {
            console.error('Error parsing schedule data:', error);
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
                    // Format: username|displayName|password|role1-role2-role3 or role1,role2,role3
                    const rolesString = parts[3].trim();
                    // Support both hyphen and comma as separators
                    const roles = rolesString.split(/[-,]/).map(role => role.trim()).filter(role => role);
                    
                    console.log('Loaded roles for user:', roles);
                    
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
                memberRoles = []; // No default role
            }
        } catch (error) {
            console.error('Error parsing roles:', error);
            memberRoles = []; // Empty array if there's an error
        }
        return memberRoles;
    }
    
    // Helper function to check if user has a specific role
    function hasRole(role) {
        if (!role) return false;
        
        const memberRoles = getUserRoles();
        // Case-insensitive role checking
        return memberRoles.some(userRole => 
            userRole.toLowerCase() === role.toLowerCase());
    }
    
    // Apply roles to the UI elements
    function applyRolesToUI() {
        const memberRoles = getUserRoles();
        
        console.log('Current user roles:', memberRoles);
        
        // Get all elements with data-role attributes
        const roleElements = document.querySelectorAll('[data-role]');
        
        // Process each element with a data-role attribute
        roleElements.forEach(element => {
            const requiredRole = element.getAttribute('data-role');
            const defaultDisplay = getDefaultDisplay(element);
            
            // Only show element if user has the exact required role
            const hasRequiredRole = hasRole(requiredRole);
            
            // Log for debugging
            console.log(`Element with data-role="${requiredRole}": User ${hasRequiredRole ? 'has' : 'does not have'} this role`);
            
            element.style.display = hasRequiredRole ? defaultDisplay : 'none';
        });
        
        // Display roles if there's a roles display element
        const rolesDisplay = document.getElementById('memberRolesDisplay');
        if (rolesDisplay) {
            rolesDisplay.textContent = memberRoles.join(', ');
        }
    }
    
    // Helper function to determine the default display type of an element
    function getDefaultDisplay(element) {
        // Get the tag name to determine the default display type
        const tagName = element.tagName.toLowerCase();
        
        // Default display types for common elements
        if (['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'section', 'article', 'header', 'footer', 'nav'].includes(tagName)) {
            return 'block';
        } else if (['span', 'a', 'strong', 'em', 'b', 'i', 'button', 'input', 'label'].includes(tagName)) {
            return 'inline-block';
        } else if (['li'].includes(tagName)) {
            return 'list-item';
        } else if (['table'].includes(tagName)) {
            return 'table';
        } else if (['tr'].includes(tagName)) {
            return 'table-row';
        } else if (['td', 'th'].includes(tagName)) {
            return 'table-cell';
        } else {
            // Default to block for unknown elements
            return 'block';
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
    
    // Enhanced schedule display with horizontal layout and current day in the middle
    function displaySchedule(scheduleEntries) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date();
        const currentDayIndex = today.getDay();
        
        // Get the schedule container
        const scheduleContainer = document.querySelector('.schedule-container');
        if (!scheduleContainer) return;
        
        // Clear existing content
        scheduleContainer.innerHTML = '';
        
        // Create a new horizontal schedule layout
        const horizontalLayout = document.createElement('div');
        horizontalLayout.className = 'schedule-horizontal-layout';
        
        // Create day elements with a loop, 3 days before and 3 days after current day
        for (let offset = -3; offset <= 3; offset++) {
            // Calculate the day index with wraparound
            let dayIndex = (currentDayIndex + offset) % 7;
            if (dayIndex < 0) dayIndex += 7;
            
            const dayName = days[dayIndex];
            
            // Calculate date for this day
            const dayDate = new Date(today);
            dayDate.setDate(today.getDate() + offset);
            const dayMonth = dayDate.getMonth() + 1;
            const dayDateNum = dayDate.getDate();
            const dayFormatted = `${dayMonth}/${dayDateNum}`;
            
            // Find schedule entry for this day - check both numeric date and day name
            const scheduleForDay = scheduleEntries.filter(entry => 
                entry.day === dayFormatted || // Matches exact date (e.g., "4/12")
                entry.day === dayName         // Matches day name (e.g., "Saturday")
            );
            
            // Create the day element
            const dayElement = document.createElement('div');
            dayElement.className = 'schedule-day';
            
            // Add additional class for current day
            if (offset === 0) {
                dayElement.classList.add('current-day');
            }
            
            // Default values - explicitly saying "No Meeting on this day"
            let scheduleTime = 'No Meeting Today';
            let scheduleLocation = 'N/A';
            let scheduleDescription = 'N/A';
            
            // Override with actual schedule if found
            if (scheduleForDay.length > 0) {
                scheduleTime = scheduleForDay[0].time;
                scheduleLocation = scheduleForDay[0].location;
                scheduleDescription = scheduleForDay[0].description;
            }
            
            // Create the content for this day
            dayElement.innerHTML = `
                <div class="day-header">
                    <span class="day-name">${dayName}</span>
                    <span class="day-date">${dayFormatted}</span>
                </div>
                <div class="day-details">
                    <div class="schedule-detail">
                        <span class="detail-label">Time:</span>
                        <span class="detail-value">${scheduleTime}</span>
                    </div>
                    <div class="schedule-detail">
                        <span class="detail-label">Location:</span>
                        <span class="detail-value">${scheduleLocation}</span>
                    </div>
                    <div class="schedule-detail">
                        <span class="detail-label">Plan:</span>
                        <span class="detail-value">${scheduleDescription}</span>
                    </div>
                </div>
            `;
            
            horizontalLayout.appendChild(dayElement);
        }
        
        scheduleContainer.appendChild(horizontalLayout);
    }
    
    // Call this instead of highlightCurrentDay()
    enhanceScheduleDisplay();

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
});