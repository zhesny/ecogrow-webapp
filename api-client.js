class EcoGrowAPI {
    constructor() {
        this.baseUrl = '';
        this.timeout = 10000;
        this.isGitHubPages = window.location.hostname === 'zhesny.github.io';
    }
    
    async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const url = `${this.baseUrl}${endpoint}`;
            
            // На GitHub Pages блокируем все HTTP-запросы к локальным устройствам
            if (this.isGitHubPages && url.startsWith('http://')) {
                throw new Error('GitHub Pages (HTTPS) блокирует HTTP-запросы к локальным устройствам. Скачайте файлы для локального запуска.');
            }
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
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
            
            // Специальная обработка для GitHub Pages
            if (this.isGitHubPages && error.message.includes('GitHub Pages блокирует')) {
                throw error;
            }
            
            if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
                console.error('Сетевая ошибка - возможно, проблема с CORS или Mixed Content');
            }
            
            throw error;
        }
    }
    
    setBaseUrl(ip) {
        if (ip === 'demo-mode') {
            this.baseUrl = 'demo://';
            return;
        }
        
        const cleanIp = ip.replace(/^https?:\/\//, '');
        
        // На GitHub Pages всегда используем HTTPS (даже если это не сработает)
        // В локальном режиме - определяем автоматически
        if (this.isGitHubPages) {
            this.baseUrl = `https://${cleanIp}`;
        } else {
            // Для локального запуска: если открыто через file:// или localhost, используем HTTP
            const isLocalPage = window.location.protocol === 'file:' || 
                               window.location.hostname === 'localhost' ||
                               window.location.hostname === '127.0.0.1';
            
            if (isLocalPage) {
                this.baseUrl = `http://${cleanIp}`;
            } else {
                this.baseUrl = `${window.location.protocol}//${cleanIp}`;
            }
        }
        
        console.log(`API URL установлен: ${this.baseUrl} (GitHub Pages: ${this.isGitHubPages})`);
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
        
        if (ip === 'demo-mode') {
            return true;
        }
        
        // На GitHub Pages пропускаем реальную проверку для локальных устройств
        if (this.isGitHubPages && 
            (ip.includes('192.168.') || 
             ip.includes('.local') ||
             ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/))) {
            
            console.warn('⚠️ GitHub Pages не может проверить подключение к локальному устройству');
            return false;
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(`${this.baseUrl}/api/info`, {
                method: 'GET',
                signal: controller.signal,
                mode: 'cors'
            }).catch(err => {
                console.log(`Не удалось подключиться к ${ip}:`, err.message);
                throw err;
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                console.log(`✅ Успешно подключено к ${ip}`);
                return true;
            } else {
                console.log(`❌ ${ip} недоступен: ${response.status}`);
                return false;
            }
            
        } catch (error) {
            console.log(`Соединение с ${ip} не удалось:`, error.message);
            
            // Даем полезную информацию в зависимости от типа ошибки
            if (error.name === 'AbortError') {
                console.log(`⏱️  Таймаут подключения к ${ip} (3 секунды)`);
            } else if (error.message.includes('Failed to fetch')) {
                console.log(`🌐 Сетевая ошибка: устройство ${ip} недоступно`);
            }
            
            return false;
        }
    }
}
