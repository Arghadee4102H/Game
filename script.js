document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    const authContainer = document.getElementById('authContainer');
    const mainAppContent = document.getElementById('mainAppContent');
    
    const loginPage = document.getElementById('loginPage');
    const registerPage = document.getElementById('registerPage');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const logoutButton = document.getElementById('logoutButton');

    const pages = document.querySelectorAll('.page');
    const navButtons = document.querySelectorAll('nav button');

    const loadingIndicator = document.getElementById('loadingIndicator');
    const messageArea = document.getElementById('messageArea');

    const API_URL = 'api.php'; // Your backend API endpoint

    // --- Navigation ---
    function showPage(pageId) {
        pages.forEach(page => {
            page.style.display = page.id === pageId ? 'block' : 'none';
        });
        navButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.page === pageId);
        });
        // Load data for the active page
        loadPageData(pageId);
    }

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            showPage(button.dataset.page);
        });
    });

    // --- Utility Functions ---
    function showLoading() { loadingIndicator.style.display = 'block'; }
    function hideLoading() { loadingIndicator.style.display = 'none'; }

    function showMessage(message, type = 'info', duration = 3000) {
        messageArea.textContent = message;
        messageArea.className = 'show'; // Reset classes then add specific
        if (type === 'success') messageArea.classList.add('success');
        if (type === 'error') messageArea.classList.add('error');
        
        messageArea.style.opacity = 1;
        setTimeout(() => {
            messageArea.style.opacity = 0;
            setTimeout(() => messageArea.className = '', 500); // clear classes after fade
        }, duration);
    }

    async function apiRequest(action, data = {}, method = 'POST') {
        showLoading();
        try {
            const formData = new FormData();
            formData.append('action', action);
            for (const key in data) {
                formData.append(key, data[key]);
            }

            const response = await fetch(API_URL, {
                method: method,
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            
            const result = await response.json();
            hideLoading();
            return result;
        } catch (error) {
            hideLoading();
            console.error('API Request Error:', error);
            showMessage(`Error: ${error.message}`, 'error');
            return { success: false, message: error.message };
        }
    }

    // --- Authentication ---
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginPage.style.display = 'none';
        registerPage.style.display = 'block';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerPage.style.display = 'none';
        loginPage.style.display = 'block';
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        
        const result = await apiRequest('register', { username, email, password });
        if (result.success) {
            showMessage('Registration successful! Please login.', 'success');
            showLoginLink.click(); // Switch to login form
            registerForm.reset();
        } else {
            showMessage(result.message || 'Registration failed.', 'error');
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        
        const result = await apiRequest('login', { username, password });
        if (result.success && result.user) {
            localStorage.setItem('isLoggedIn', 'true'); // Simple flag, real session managed by PHP cookies
            localStorage.setItem('userData', JSON.stringify(result.user));
            switchToAppView(result.user);
        } else {
            showMessage(result.message || 'Login failed.', 'error');
        }
    });

    logoutButton.addEventListener('click', async () => {
        const result = await apiRequest('logout');
        if (result.success) {
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userData');
            switchToAuthView();
        } else {
            showMessage(result.message || 'Logout failed.', 'error');
        }
    });

    function switchToAppView(userData) {
        authContainer.style.display = 'none';
        mainAppContent.style.display = 'flex'; // Use flex for main app layout
        document.getElementById('profileUsername').textContent = userData.username;
        document.getElementById('profileEmail').textContent = userData.email;
        showPage('profilePage'); // Default to profile page
    }

    function switchToAuthView() {
        mainAppContent.style.display = 'none';
        authContainer.style.display = 'block';
        loginPage.style.display = 'block';
        registerPage.style.display = 'none';
        loginForm.reset();
        registerForm.reset();
    }

    // Check login status on load
    async function checkLoginStatus() {
        const result = await apiRequest('check_session');
        if (result.success && result.loggedIn && result.user) {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userData', JSON.stringify(result.user));
            switchToAppView(result.user);
        } else {
            switchToAuthView();
        }
    }


    // --- Page Specific Data Loading ---
    async function loadPageData(pageId) {
        switch (pageId) {
            case 'profilePage':
                await loadProfileData();
                await loadUserWithdrawals();
                break;
            case 'transactionPage':
                await loadUserGeneratedLinks();
                await loadUserSubmittedOrders();
                break;
            // Add other cases if needed for shop or evidence page dynamic content
        }
    }

    async function loadProfileData() {
        const result = await apiRequest('get_profile_data');
        if (result.success && result.data) {
            const data = result.data;
            document.getElementById('profileUsername').textContent = data.username;
            document.getElementById('profileEmail').textContent = data.email;
            document.getElementById('profileTotalPoints').textContent = data.total_points || 0;
            document.getElementById('profileLinksCreated').textContent = data.links_created_count || 0;
            document.getElementById('profileSuccessfulOrders').textContent = data.successful_orders_count || 0;
            document.getElementById('profilePendingOrders').textContent = data.pending_orders_count || 0;
        }
    }
    
    // --- Shop Page ---
    const generateLinkForm = document.getElementById('generateLinkForm');
    const originalUrlInput = document.getElementById('originalUrl');
    const generatedLinkResultDiv = document.getElementById('generatedLinkResult');
    const magicLinkOutput = document.getElementById('magicLinkOutput');
    const copyMagicLinkButton = document.getElementById('copyMagicLinkButton');

    generateLinkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const originalUrl = originalUrlInput.value;
        if (!originalUrl) {
            showMessage('Please enter a URL.', 'error');
            return;
        }
        const result = await apiRequest('generate_link', { original_url: originalUrl });
        if (result.success && result.affiliate_url) {
            magicLinkOutput.value = result.affiliate_url;
            generatedLinkResultDiv.style.display = 'block';
            showMessage('Magic link generated!', 'success');
        } else {
            showMessage(result.message || 'Failed to generate link.', 'error');
            generatedLinkResultDiv.style.display = 'none';
        }
    });

    copyMagicLinkButton.addEventListener('click', () => {
        magicLinkOutput.select();
        document.execCommand('copy');
        showMessage('Link copied to clipboard!', 'success');
    });

    // --- Evidence Page ---
    const quickSubmitOrderForm = document.getElementById('quickSubmitOrderForm');
    quickSubmitOrderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const orderId = document.getElementById('quickOrderId').value;
        const orderAmount = document.getElementById('quickOrderAmount').value;

        if (!orderId || !orderAmount) {
            showMessage('Please enter both Order ID and Amount.', 'error');
            return;
        }
        const result = await apiRequest('submit_order_evidence', { 
            order_id_external: orderId,
            purchase_amount: orderAmount 
            // Add other fields if you extend this form beyond Google Form
        });

        if (result.success) {
            showMessage('Order ID submitted! Please also fill the Google Form for complete details.', 'success');
            quickSubmitOrderForm.reset();
            // Optionally, refresh transaction page data if user navigates there
            if (document.getElementById('transactionPage').style.display === 'block') {
                loadUserSubmittedOrders();
            }
        } else {
            showMessage(result.message || 'Failed to submit Order ID.', 'error');
        }
    });
    
    // --- Transaction Page ---
    async function loadUserGeneratedLinks() {
        const result = await apiRequest('get_user_links');
        const container = document.getElementById('userLinksContainer');
        container.innerHTML = '<h3>My Generated Links</h3>'; // Reset
        if (result.success && result.links && result.links.length > 0) {
            const ul = document.createElement('ul');
            result.links.forEach(link => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>Original:</strong> ${escapeHTML(link.original_url.substring(0,50))}${link.original_url.length > 50 ? '...' : ''}<br>
                    <strong>Affiliate:</strong> <a href="${escapeHTML(link.affiliate_url)}" target="_blank">${escapeHTML(link.affiliate_url.substring(0,50))}${link.affiliate_url.length > 50 ? '...' : ''}</a><br>
                    <small>Platform: ${escapeHTML(link.platform)} | Created: ${new Date(link.created_at).toLocaleString()}</small>
                `;
                ul.appendChild(li);
            });
            container.appendChild(ul);
        } else {
            container.innerHTML += '<p>No links generated yet.</p>';
        }
    }

    async function loadUserSubmittedOrders() {
        const result = await apiRequest('get_user_orders');
        const container = document.getElementById('userOrdersContainer');
        container.innerHTML = '<h3>My Submitted Orders</h3>'; // Reset
        if (result.success && result.orders && result.orders.length > 0) {
            const ul = document.createElement('ul');
            result.orders.forEach(order => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>Order ID:</strong> ${escapeHTML(order.order_id_external)}<br>
                    <strong>Amount:</strong> ${escapeHTML(order.purchase_amount)}<br>
                    <strong>Status:</strong> <span class="status-${escapeHTML(order.status.toLowerCase())}">${escapeHTML(order.status)}</span><br>
                    <small>Submitted: ${new Date(order.submitted_at).toLocaleString()}</small>
                    ${order.admin_notes ? `<small style="color:blue;">Admin Note: ${escapeHTML(order.admin_notes)}</small>` : ''}
                `;
                ul.appendChild(li);
            });
            container.appendChild(ul);
        } else {
            container.innerHTML += '<p>No orders submitted yet.</p>';
        }
    }
    
    // -- Withdrawal --
    const withdrawalForm = document.getElementById('withdrawalForm');
    withdrawalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const points = document.getElementById('withdrawalPoints').value;
        const details = document.getElementById('withdrawalDetails').value;

        if (!points || !details) {
            showMessage('Please enter points and payment details.', 'error');
            return;
        }
        const result = await apiRequest('request_withdrawal', { points_withdrawn: points, withdrawal_details: details });
        if (result.success) {
            showMessage('Withdrawal request submitted!', 'success');
            withdrawalForm.reset();
            loadUserWithdrawals(); // Refresh list
            loadProfileData(); // Refresh points
        } else {
            showMessage(result.message || 'Withdrawal request failed.', 'error');
        }
    });

    async function loadUserWithdrawals() {
        const result = await apiRequest('get_user_withdrawals');
        const listElement = document.getElementById('userWithdrawalsList');
        listElement.innerHTML = ''; // Clear previous list
        if (result.success && result.withdrawals && result.withdrawals.length > 0) {
            result.withdrawals.forEach(w => {
                const li = document.createElement('li');
                li.innerHTML = `
                    Points: ${escapeHTML(w.points_withdrawn)} | Status: <span class="status-${escapeHTML(w.status.toLowerCase())}">${escapeHTML(w.status)}</span><br>
                    <small>Details: ${escapeHTML(w.withdrawal_details.substring(0, 50))}${w.withdrawal_details.length > 50 ? '...' : ''}</small><br>
                    <small>Requested: ${new Date(w.requested_at).toLocaleString()}</small>
                    ${w.processed_at ? `<small> | Processed: ${new Date(w.processed_at).toLocaleString()}</small>` : ''}
                    ${w.admin_notes ? `<br><small style="color:blue;">Admin Note: ${escapeHTML(w.admin_notes)}</small>` : ''}
                `;
                listElement.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = 'No withdrawal history.';
            listElement.appendChild(li);
        }
    }


    // --- Helper for security ---
    function escapeHTML(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, function (match) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            }[match];
        });
    }

    // --- Initial Load ---
    checkLoginStatus();
    // If using Telegram Web App specific features, initialize it:
    // if (window.Telegram && window.Telegram.WebApp) {
    //     window.Telegram.WebApp.ready();
    //     // Example: Use Telegram user data if available
    //     // const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
    //     // if (tgUser) {
    //     //     console.log("Telegram User:", tgUser);
    //     //     // You could use this to prefill registration or auto-login if linked
    //     // }
    // }
});