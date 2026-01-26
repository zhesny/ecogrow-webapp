class NotificationManager {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        if (!this.container) {
            this.createContainer();
        }
        
        // Отложенная инициализация AudioContext
        this.audioContext = null;
        this.userInteracted = false;
        
        // Отмечаем взаимодействие пользователя
        document.addEventListener('click', () => {
            this.userInteracted = true;
        }, { once: true });
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
        
        // Play sound only if user has interacted
        if (this.userInteracted && localStorage.getItem('notifications_sound') !== 'false') {
            this.playNotificationSound();
        }
        
        // Auto remove after duration
        setTimeout(() => {
            this.removeNotification(notification);
        }, duration);
        
        // Send to Telegram if critical (опционально)
        if (type === 'error') {
            // this.sendTelegramNotification(message);
        }
        
        return notification;
    }
    
    createNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
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
        
        // Add close button handler
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.removeNotification(notification);
        });
        
        // Add animation
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        return notification;
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
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    playNotificationSound() {
        if (!this.userInteracted) return;
        
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.1);
        } catch (error) {
            console.log('Не удалось воспроизвести звук уведомления:', error);
        }
    }
    
    async sendTelegramNotification(message) {
        const botToken = '8365221747:AAEskXtc6T-IhEik718wJJ9x-vz_TOh26tw';
        const chatId = '6712996693';
        
        try {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `⚠️ EcoGrow: ${message}`,
                    parse_mode: 'HTML'
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Failed to send Telegram notification:', error);
        }
    }
    
    // Toast notification for quick messages
    toast(message, type = 'info') {
        return this.show(message, type, 3000);
    }
    
    // Success shortcut
    success(message) {
        return this.show(message, 'success');
    }
    
    // Error shortcut
    error(message) {
        return this.show(message, 'error');
    }
    
    // Warning shortcut
    warning(message) {
        return this.show(message, 'warning');
    }
    
    // Info shortcut
    info(message) {
        return this.show(message, 'info');
    }
}
