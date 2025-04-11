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
    
    // Handle logout
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', function(e) {
            e.preventDefault();
            // Clear session storage
            sessionStorage.removeItem('memberLoggedIn');
            sessionStorage.removeItem('memberName');
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