// Cabinet.js - Personal Cabinet and Admin Panel Functions

let currentUser = null;
let currentSubscription = null;

// Initialize cabinet
async function initCabinet() {
    try {
        if (!window.Telegram || !window.Telegram.WebApp) {
            console.warn('⚠️ Telegram WebApp not available');
            return;
        }

        const initData = window.Telegram.WebApp.initData;

        // Send to backend
        const response = await fetch('/api/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ initData })
        });

        const data = await response.json();
        if (data.ok) {
            currentUser = data.user;
            currentSubscription = data.user.subscription;

            // Update UI
            updateProfileDisplay();
            updateSubscriptionDisplay();

            // Show admin tab if admin
            if (currentUser.role === 'admin') {
                document.querySelector('.admin-only').style.display = 'block';
                loadAdminUsers();
            }

            console.log('✅ Cabinet initialized');
        } else {
            console.error('Failed to init cabinet:', data.error);
        }
    } catch (error) {
        console.error('Error initializing cabinet:', error);
    }
}

function updateProfileDisplay() {
    if (!currentUser) return;

    document.getElementById('userId').textContent = currentUser.userId;
    document.getElementById('userFirstName').textContent = currentUser.firstName || '-';
    document.getElementById('userUsername').textContent = '@' + (currentUser.username || '-');
    document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '👑 Администратор' : 'Пользователь';

    if (currentUser.createdAt) {
        const date = new Date(currentUser.createdAt);
        document.getElementById('userCreatedAt').textContent = date.toLocaleDateString('ru-RU');
    }
}

async function updateSubscriptionDisplay() {
    if (!currentUser) return;

    try {
        const response = await fetch(`/api/subscription/${currentUser.userId}`);
        const data = await response.json();

        if (data.ok) {
            currentSubscription = data.subscription;
            const tierNames = {
                'free': 'FREE',
                'premium_1month': 'PREMIUM (1 месяц)',
                'premium_3month': 'PREMIUM (3 месяца)',
                'premium_6month': 'PREMIUM (6 месяцев)'
            };

            document.getElementById('tierName').textContent = tierNames[currentSubscription.tier] || 'FREE';

            if (currentSubscription.expiresAt && currentSubscription.status === 'active') {
                const expiresDate = new Date(currentSubscription.expiresAt);
                document.getElementById('expiresDate').textContent = expiresDate.toLocaleDateString('ru-RU');
                document.getElementById('expiresInfo').textContent = `Дней осталось: ${currentSubscription.daysRemaining || 0}`;
                document.getElementById('premiumInfo').style.display = 'block';
            } else {
                document.getElementById('expiresInfo').textContent = 'Бесплатный план';
                document.getElementById('premiumInfo').style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading subscription:', error);
    }
}

// Admin functions
async function loadAdminUsers() {
    if (!currentUser || currentUser.role !== 'admin') {
        console.warn('⚠️ Not admin');
        return;
    }

    try {
        const response = await fetch(`/api/admin/users?adminId=${currentUser.userId}`);
        const data = await response.json();

        if (data.ok) {
            const usersList = document.getElementById('usersList');

            if (!data.users || data.users.length === 0) {
                usersList.innerHTML = '<div class="empty-state"><p>Нет пользователей</p></div>';
                return;
            }

            usersList.innerHTML = data.users.map(user => `
                <div class="user-item">
                    <div class="user-item-header">
                        <div>
                            <div class="user-name">${user.firstName || 'Unknown'} ${user.lastName || ''}</div>
                            <div class="user-id">ID: ${user.userId}</div>
                        </div>
                        <div class="user-status ${user.status === 'active' ? 'status-premium' : 'status-free'}">
                            ${user.tier || 'FREE'}
                        </div>
                    </div>
                    <div class="user-controls">
                        <button class="btn-small" onclick="openEditModal(${user.userId})">✏️ Тариф</button>
                        <button class="btn-small" onclick="viewUserLogs(${user.userId})">📋 Логи</button>
                    </div>
                </div>
            `).join('');

            console.log(`✅ Loaded ${data.users.length} users`);
        }
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersList').innerHTML = `<div class="alert alert-error">Ошибка: ${error.message}</div>`;
    }
}

function openEditModal(userId) {
    document.getElementById('editSubModal').classList.add('active');
    document.getElementById('editSubForm').dataset.userId = userId;
    document.getElementById('tierSelect').value = '';
    document.getElementById('daysInput').value = '30';
}

function closeModal() {
    document.getElementById('editSubModal').classList.remove('active');
}

document.getElementById('editSubForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const userId = parseInt(this.dataset.userId);
    const tier = document.getElementById('tierSelect').value;
    const daysValid = parseInt(document.getElementById('daysInput').value) || 0;

    if (!tier) {
        alert('❌ Выберите тариф');
        return;
    }

    try {
        const response = await fetch('/api/admin/update-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                adminId: currentUser.userId,
                userId: userId,
                tier: tier,
                daysValid: daysValid > 0 ? daysValid : (tier === 'free' ? 0 : 30)
            })
        });

        const data = await response.json();
        if (data.ok) {
            alert('✅ Подписка обновлена!');
            closeModal();
            loadAdminUsers();
        } else {
            alert('❌ Ошибка: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        alert('❌ Ошибка: ' + error.message);
    }
});

// Close modal on background click
document.getElementById('editSubModal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

function goToChat() {
    // Redirect to main chat
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.close();
    }
}

function viewUserLogs(userId) {
    alert('📋 Функция просмотра логов в разработке');
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tab = this.dataset.tab;
        switchTab(tab);
    });
});

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => {
        el.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('active');
    });

    // Show selected tab
    const tabElement = document.getElementById(tabName + '-tab');
    if (tabElement) {
        tabElement.classList.add('active');
    }

    const btnElement = document.querySelector('[data-tab="' + tabName + '"]');
    if (btnElement) {
        btnElement.classList.add('active');
    }

    // Load data for specific tabs
    if (tabName === 'admin') {
        loadAdminUsers();
    } else if (tabName === 'subscription') {
        updateSubscriptionDisplay();
    }
}

// Initialize when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCabinet);
} else {
    initCabinet();
}