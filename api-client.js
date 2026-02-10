class EcoGrowAPI {
    constructor() {
        this.baseUrl = '';
        this.timeout = 8000; // Увеличен для мобильных
    }
    
    async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const url = `${this.baseUrl}${endpoint}`;
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    setBaseUrl(ip) {
        if (!ip.startsWith('http://') && !ip.startsWith('https://')) {
            this.baseUrl = `http://${ip}`;
        } else {
            this.baseUrl = ip;
        }
    }
    
    // System Info
    async getInfo(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/info');
    }
    
    // Get State
    async getState(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/state');
    }
    
    // Pump Control
    async controlPump(ip, action) {
        this.setBaseUrl(ip);
        return await this.request('/api/pump', {
            method: 'POST',
            body: JSON.stringify({ state: action })
        });
    }
    
    // Light Control
    async controlLight(ip, action) {
        this.setBaseUrl(ip);
        return await this.request('/api/light', {
            method: 'POST',
            body: JSON.stringify({ state: action })
        });
    }
    
    // Update Settings
    async updateSettings(ip, settings) {
        this.setBaseUrl(ip);
        return await this.request('/api/settings', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
    }
    
    // Set Time
    async setTime(ip, hours, minutes) {
        this.setBaseUrl(ip);
        return await this.request('/api/time', {
            method: 'POST',
            body: JSON.stringify({ hours, minutes })
        });
    }
    
    // Sync Time (новый метод)
    async syncTime(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/time/sync', {
            method: 'POST'
        });
    }
    
    // Clear Errors
    async clearErrors(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/errors/clear', {
            method: 'POST'
        });
    }
    
    // Get Weather Data (external API)
    async getWeather(lat, lon, apiKey) {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=ru`;
        const response = await fetch(url);
        return await response.json();
    }
    
    // Send Telegram Notification
    async sendTelegramNotification(botToken, chatId, message) {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: 'HTML'
            })
        });
        return await response.json();
    }
}
