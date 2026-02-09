class EcoGrowAPI {
    constructor() {
        this.baseUrl = '';
        this.timeout = 10000;
        this.isLocalEndpoint = false;
    }
    
    async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const isHttpsPage = window.location.protocol === 'https:';
            let url = `${this.baseUrl}${endpoint}`;
            
            if (isHttpsPage && url.startsWith('http://')) {
                console.warn('Mixed Content Warning: HTTPS page trying to access HTTP resource');
            }
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                // Разрешаем небезопасные запросы в development
                mode: 'cors',
                credentials: 'omit'
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            // Проверяем, не связано ли с CORS или Mixed Content
            if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
                console.error('Network error - возможно, проблема с CORS или Mixed Content');
                if (window.location.protocol === 'https:' && this.baseUrl.startsWith('http://')) {
                    console.log('Подсказка: откройте страницу через HTTP или используйте локальный режим');
                } else {
                    console.log('Подсказка: для локального устройства используйте HTTP страницу');
                }
            }
            
            throw error;
        }
    }
    
    setBaseUrl(ip) {
        // Автоматически определяем протокол
        if (ip === 'demo-mode') {
            this.baseUrl = 'demo://';
            this.isLocalEndpoint = false;
            return;
        }
        
        // Убираем протокол, если он есть
        const cleanIp = ip.replace(/^https?:\/\//, '');
        
        const isLocalTarget = this.isLocalTarget(cleanIp);
        this.isLocalEndpoint = isLocalTarget;

        if (isLocalTarget) {
            this.baseUrl = `http://${cleanIp}`;
        } else {
            this.baseUrl = `${window.location.protocol}//${cleanIp}`;
        }
        
        console.log(`API URL установлен: ${this.baseUrl}`);
    }

    isLocalTarget(ip) {
        const cleanIp = ip.replace(/^https?:\/\//, '');
        const hostOnly = cleanIp.split('/')[0].split(':')[0];
        const isLocalHost = hostOnly === 'localhost' || hostOnly.endsWith('.local');
        const isPrivateIp = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostOnly);
        return isLocalHost || isPrivateIp;
    }
    
    async getInfo(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/info');
    }
    
    async getState(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/state');
    }
    
    async controlPump(ip, action) {
        this.setBaseUrl(ip);
        return await this.request('/api/pump', {
            method: 'POST',
            body: JSON.stringify({ state: action })
        });
    }
    
    async controlLight(ip, action) {
        this.setBaseUrl(ip);
        return await this.request('/api/light', {
            method: 'POST',
            body: JSON.stringify({ state: action })
        });
    }
    
    async updateSettings(ip, settings) {
        this.setBaseUrl(ip);
        return await this.request('/api/settings', {
            method: 'POST',
            body: JSON.stringify(settings)
        });
    }
    
    async setTime(ip, hours, minutes) {
        this.setBaseUrl(ip);
        return await this.request('/api/time', {
            method: 'POST',
            body: JSON.stringify({ hours, minutes })
        });
    }
    
    async syncTime(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/time/sync', {
            method: 'POST'
        });
    }
    
    async clearErrors(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/errors/clear', {
            method: 'POST'
        });
    }
    
    async resetStats(ip) {
        this.setBaseUrl(ip);
        return await this.request('/api/stats/reset', {
            method: 'POST'
        });
    }
    
    async testConnection(ip) {
        this.setBaseUrl(ip);
        
        // Для демо-режима всегда true
        if (ip === 'demo-mode') {
            return true;
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${this.baseUrl}/api/info`, {
                method: 'HEAD',
                signal: controller.signal,
                mode: 'no-cors' // Используем no-cors для избежания CORS ошибок
            });
            
            clearTimeout(timeoutId);
            return true;
        } catch (error) {
            console.log(`Не удалось подключиться к ${ip}:`, error.message);
            return false;
        }
    }
}
