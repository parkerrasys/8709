
document.addEventListener('DOMContentLoaded', function() {
    const config = {
        github: {
            user: 'parkerrasys',
            repo: '8709-Storage',
            files: {
                tools: 'tools.txt',
                users: 'users.txt'
            }
        }
    };

    let githubToken = '';

    async function fetchUserData() {
        const url = `https://api.github.com/repos/${config.github.user}/${config.github.repo}/contents/${config.github.files.users}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch user data');

        const data = await response.json();
        return atob(data.content);
    }

    async function fetchToolData() {
        const url = `https://api.github.com/repos/${config.github.user}/${config.github.repo}/contents/${config.github.files.tools}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch tool data');

        const data = await response.json();
        return atob(data.content);
    }

    function parseUserData(data) {
        return data.split('\n')
            .filter(line => line.trim())
            .map(line => line.split('|')[0].trim());
    }

    function parseToolData(data) {
        return data.split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [name, total, checkedOut, users] = line.split('|').map(item => item.trim());
                return {
                    name,
                    total: parseInt(total),
                    checkedOut: parseInt(checkedOut),
                    users: users ? users.split(',').map(u => u.trim()) : []
                };
            });
    }

    function displayTools(tools) {
        const toolList = document.getElementById('toolList');
        if (!toolList) return;

        toolList.innerHTML = '';
        tools.forEach(tool => {
            const available = tool.total - tool.checkedOut;
            const toolElement = createToolElement(tool, available);
            toolList.appendChild(toolElement);
        });
    }

    function createToolElement(tool, available) {
        const div = document.createElement('div');
        div.className = 'tool-item';

        const name = document.createElement('div');
        name.className = 'tool-name';
        name.textContent = tool.name;

        const details = document.createElement('div');
        details.className = 'tool-details';
        details.textContent = `Available: ${available}/${tool.total}`;

        const users = document.createElement('div');
        users.className = 'tool-details';
        users.textContent = `Checked out by: ${tool.users.join(', ') || 'None'}`;

        const checkoutButton = document.createElement('button');
        checkoutButton.className = 'checkout-button';
        checkoutButton.textContent = 'Check Out';
        checkoutButton.disabled = available === 0;
        checkoutButton.onclick = () => handleToolCheckout(tool.name);

        div.appendChild(name);
        div.appendChild(details);
        div.appendChild(users);
        div.appendChild(checkoutButton);

        return div;
    }

    function validateUsername(username, users) {
        return users.includes(username);
    }

    async function handleToolCheckout(toolName) {
        const username = prompt('Enter your username:');
        if (!username) return;

        try {
            const userData = await fetchUserData();
            const users = parseUserData(userData);

            if (!validateUsername(username, users)) {
                showStatusMessage('Invalid username', true);
                return;
            }

            // Implement checkout logic here
            showStatusMessage(`Tool "${toolName}" checked out to ${username}`);
            await loadTools();
        } catch (error) {
            console.error('Error during checkout:', error);
            showStatusMessage('Error during checkout', true);
        }
    }

    function showStatusMessage(message, isError = false) {
        const statusDiv = document.getElementById('statusMessage');
        if (!statusDiv) return;

        statusDiv.className = `status-message ${isError ? 'error' : 'success'}`;
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';

        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }

    async function loadTools() {
        try {
            const toolData = await fetchToolData();
            const tools = parseToolData(toolData);
            displayTools(tools);
        } catch (error) {
            console.error('Error loading tools:', error);
            showStatusMessage('Error loading tools', true);
        }
    }

    // Initialize
    loadTools();
});
