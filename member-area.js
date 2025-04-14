document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const config = {
        github: {
            user: 'parkerrasys',
            repo: '8709-Storage',
            scheduleFilePath: 'schedule.txt',
            passwordFilePath: 'users.txt'
        },
        googleSheets: {
            apiKey: 'AIzaSyC-CRiUBM4ZNQXU_nTjRNjX_YcbRG95TsE',
            spreadsheetId: '1MZ6T17q-IcUI2AnZ1nVXtlfyMOHxLl_kTUb5YEI_uLg',
            cellRange: 'A1:A1'
        }
    };

    // State management
    let githubToken = '';
    const state = {
        isLoggedIn: sessionStorage.getItem('memberLoggedIn'),
        memberName: sessionStorage.getItem('memberName')
    };

    // Authentication check
    function checkAuth() {
        if (!state.isLoggedIn || state.isLoggedIn !== 'true') {
            window.location.href = 'member-login.html';
            return false;
        }
        return true;
    }

    // Display member name with fallback logic
    function displayMemberName() {
        const memberNameDisplay = document.getElementById('memberNameDisplay');
        if (!memberNameDisplay) return;

        const displayName = sessionStorage.getItem('memberDisplayName');
        if (displayName) {
            memberNameDisplay.textContent = displayName;
            return;
        }

        const memberName = sessionStorage.getItem('memberName');
        if (memberName) {
            const generatedDisplayName = memberName
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            memberNameDisplay.textContent = generatedDisplayName;
        }
    }

    // GitHub API interactions
    async function fetchGithubToken() {
        try {
            const tokenUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.googleSheets.spreadsheetId}/values/${config.googleSheets.cellRange}?key=${config.googleSheets.apiKey}`;
            const response = await fetch(tokenUrl);

            if (!response.ok) throw new Error('Failed to fetch GitHub token');

            const data = await response.json();
            if (!data.values?.[0]?.[0]) throw new Error('No GitHub token found');

            githubToken = data.values[0][0];
            await Promise.all([fetchUserData(), fetchScheduleData()]);
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }

    // Schedule management
    async function fetchScheduleData() {
        try {
            const scheduleUrl = `https://api.github.com/repos/${config.github.user}/${config.github.repo}/contents/${config.github.scheduleFilePath}`;
            const response = await fetch(scheduleUrl, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                cache: 'no-store'
            });

            if (!response.ok) throw new Error('Failed to fetch schedule data');

            const data = await response.json();
            const scheduleData = atob(data.content);
            parseAndDisplaySchedule(scheduleData);
        } catch (error) {
            console.error('Error fetching schedule data:', error);
        }
    }

    function parseAndDisplaySchedule(scheduleData) {
        try {
            const entries = scheduleData.split(',')
                .map(entry => entry.trim())
                .filter(entry => entry !== '')
                .map(entry => {
                    const [day, time, location, description] = entry.split('|');
                    return {
                        day: day.trim(),
                        time: time.trim(),
                        location: location.trim(),
                        description: description.trim()
                    };
                });

            displaySchedule(entries);
        } catch (error) {
            console.error('Error parsing schedule data:', error);
        }
    }

    function displaySchedule(scheduleEntries) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = new Date();
        const currentDayIndex = today.getDay();

        const scheduleContainer = document.querySelector('.schedule-container');
        if (!scheduleContainer) return;

        scheduleContainer.innerHTML = '';

        const horizontalLayout = document.createElement('div');
        horizontalLayout.className = 'schedule-horizontal-layout';

        for (let offset = -3; offset <= 3; offset++) {
            let dayIndex = (currentDayIndex + offset) % 7;
            if (dayIndex < 0) dayIndex += 7;

            const dayName = days[dayIndex];
            const dayDate = new Date(today);
            dayDate.setDate(today.getDate() + offset);
            const dayFormatted = `${dayDate.getMonth() + 1}/${dayDate.getDate()}`;

            const scheduleForDay = scheduleEntries.filter(entry => 
                entry.day === dayFormatted || entry.day === dayName
            );

            const dayElement = createDayElement(dayName, dayFormatted, scheduleForDay[0], offset === 0);
            horizontalLayout.appendChild(dayElement);
        }

        scheduleContainer.appendChild(horizontalLayout);
    }

    function createDayElement(dayName, dayFormatted, schedule, isCurrentDay) {
        const dayElement = document.createElement('div');
        dayElement.className = `schedule-day${isCurrentDay ? ' current-day' : ''}`;

        dayElement.innerHTML = `
            <div class="day-header">
                <span class="day-name">${dayName}</span>
                <span class="day-date">${dayFormatted}</span>
            </div>
            <div class="day-details">
                <div class="schedule-detail">
                    <span class="detail-label">Time:</span>
                    <span class="detail-value">${schedule?.time || 'No Meeting Today'}</span>
                </div>
                <div class="schedule-detail">
                    <span class="detail-label">Location:</span>
                    <span class="detail-value">${schedule?.location || 'N/A'}</span>
                </div>
                <div class="schedule-detail">
                    <span class="detail-label">Plan:</span>
                    <span class="detail-value">${schedule?.description || 'N/A'}</span>
                </div>
            </div>
        `;

        return dayElement;
    }

    // User roles management
    function getUserRoles() {
        try {
            const rolesString = sessionStorage.getItem('memberRoles');
            return rolesString ? JSON.parse(rolesString) : [];
        } catch (error) {
            console.error('Error parsing roles:', error);
            return [];
        }
    }

    function hasRole(role) {
        if (!role) return false;
        const memberRoles = getUserRoles();
        return memberRoles.some(userRole => 
            userRole.toLowerCase() === role.toLowerCase());
    }

    function applyRolesToUI() {
        const memberRoles = getUserRoles();
        console.log('Current user roles:', memberRoles);

        document.querySelectorAll('[data-role]').forEach(element => {
            const requiredRole = element.getAttribute('data-role');
            const defaultDisplay = getDefaultDisplay(element);
            const hasRequiredRole = hasRole(requiredRole);

            console.log(`Element with data-role="${requiredRole}": User ${hasRequiredRole ? 'has' : 'does not have'} this role`);
            element.style.display = hasRequiredRole ? defaultDisplay : 'none';
        });

        const rolesDisplay = document.getElementById('memberRolesDisplay');
        if (rolesDisplay) {
            rolesDisplay.textContent = memberRoles.join(', ');
        }
    }

    // Event listeners
    function setupEventListeners() {
        const logoutButton = document.getElementById('logoutButton');
        if (logoutButton) {
            logoutButton.addEventListener('click', handleLogout);
        }

        setupTaskFilters();
        setupSmoothScrolling();
        setupResourceCardAnimations();
        setupTaskPriorityVisualization();
    }

    // Helper function to determine the default display type of an element
    function getDefaultDisplay(element) {
        const tagName = element.tagName.toLowerCase();
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
            return 'block';
        }
    }


    // Fetch user data from GitHub
    async function fetchUserData() {
        try {
            const repoContentsUrl = `https://api.github.com/repos/${config.github.user}/${config.github.repo}/contents/${config.github.passwordFilePath}`;

            const response = await fetch(repoContentsUrl, {
                headers: {
                    'Authorization': `token ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                },
                cache: 'no-store'
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

        // Handle logout
    function handleLogout(e) {
        e.preventDefault();
        // Clear session storage
        sessionStorage.removeItem('memberLoggedIn');
        sessionStorage.removeItem('memberName');
        sessionStorage.removeItem('memberDisplayName');
        sessionStorage.removeItem('memberRoles');
        // Redirect to login page
        window.location.href = 'index.html';
    }

    // Task filtering functionality
    function setupTaskFilters() {
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
    }

    // Smooth scrolling for navigation links
    function setupSmoothScrolling() {
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
    }


    // Resource card hover animation
    function setupResourceCardAnimations() {
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
    }

    // Task priority visualization
    function setupTaskPriorityVisualization() {
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
    }


    // Initialize
    function init() {
        if (!checkAuth()) return;
        displayMemberName();
        applyRolesToUI();
        fetchGithubToken();
        setupEventListeners();
    }

    // Start the application
    init();

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