class NotificationManager {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        if (!this.container) {
            this.createContainer();
        }
        this.notifications = [];
        this.notificationSound = new Audio('assets/sounds/notification.mp3');
        this.notificationSound.volume = 0.3;
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notificationContainer';
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', duration = 5000) {
        const notification = this.createNotification(message, type);
        this.container.appendChild(notification);
        this.notifications.push(notification);
        this.reflow();

        if (localStorage.getItem('notifications_sound') !== 'false') {
            this.playNotificationSound();
        }

        if (type === 'error') {
            this.sendTelegramNotification(message);
        }

        setTimeout(() => {
            this.removeNotification(notification);
        }, duration);

        return notification;
    }

    createNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.position = 'absolute';
        notification.style.top = '0';
        notification.style.right = '0';
        notification.style.width = '100%';
        notification.style.transform = 'translateY(20px) scale(0.9)';
        notification.style.opacity = '0';

        const icon = this.getIconForType(type);
        const color = this.getColorForType(type);

        notification.innerHTML = `
            <div class="notification-icon" style="color: ${color}">
                <i class="fas ${icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
                <div class="notification-time">Только что</div>
            </div>
            <button class="notification-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeNotification(notification);
        });

        setTimeout(() => {
            notification.style.transform = 'translateY(0) scale(1)';
            notification.style.opacity = '1';
        }, 10);

        return notification;
    }

    reflow() {
        this.notifications = this.notifications.filter(n => n.parentNode === this.container);
        this.notifications.reverse().forEach((n, index) => {
            const level = index + 1;
            n.classList.remove('notification-1', 'notification-2', 'notification-3', 'notification-4', 'notification-5');
            if (level <= 5) {
                n.classList.add(`notification-${level}`);
            } else {
                n.style.display = 'none';
            }
        });
    }

    getIconForType(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || 'fa-bell';
    }

    getColorForType(type) {
        const colors = {
            success: '#00ff9d',
            error: '#ff6b6b',
            warning: '#ffd166',
            info: '#4ecdc4'
        };
        return colors[type] || '#64ffda';
    }

    removeNotification(notification) {
        notification.style.transform = 'translateY(20px) scale(0.9)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
                this.notifications = this.notifications.filter(n => n !== notification);
                this.reflow();
            }
        }, 300);
    }

    playNotificationSound() {
        try {
            this.notificationSound.currentTime = 0;
            this.notificationSound.play();
        } catch (error) {
            console.log('Could not play notification sound:', error);
        }
    }

    async sendTelegramNotification(message) {
        const botToken = '8365221747:AAEskXtc6T-IhEik718wJJ9x-vz_TOh26tw';
        const chatId = '6712996693';
        try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `⚠️ EcoGrow: ${message}`,
                    parse_mode: 'HTML'
                })
            });
        } catch (error) {
            console.error('Failed to send Telegram notification:', error);
        }
    }

    toast(message, type = 'info') {
        return this.show(message, type, 3000);
    }

    success(message) {
        return this.show(message, 'success');
    }

    error(message) {
        return this.show(message, 'error');
    }

    warning(message) {
        return this.show(message, 'warning');
    }

    info(message) {
        return this.show(message, 'info');
    }
}