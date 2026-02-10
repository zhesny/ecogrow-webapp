class EcoGrowAPI {
    constructor() {
        this.serverAddress = '';
        this.requestTimeout = 8000;
        this.localConnection = false;
    }
    
    async makeRequest(endpoint, requestOptions = {}) {
        const abortController = new AbortController();
        const timeoutTimer = setTimeout(() => abortController.abort(), this.requestTimeout);
        
        try {
            let requestUrl = `${this.serverAddress}${endpoint}`;
            
            const apiResponse = await fetch(requestUrl, {
                ...requestOptions,
                signal: abortController.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...requestOptions.headers
                }
            });
            
            clearTimeout(timeoutTimer);
            
            if (!apiResponse.ok) {
                const errorText = await apiResponse.text().catch(() => apiResponse.statusText);
                throw new Error(`HTTP ${apiResponse.status}: ${errorText}`);
            }
            
            return await apiResponse.json();
            
        } catch (error) {
            clearTimeout(timeoutTimer);
            
            if (error.name === 'AbortError') {
                throw new Error('Таймаут соединения (8 секунд)');
            }
            
            if (error.name === 'TypeError' || error.message.includes('Failed to fetch')) {
                console.error('Сетевая ошибка подключения');
            }
            
            throw error;
        }
    }
    
    configureServerAddress(ipAddress) {
        if (ipAddress === 'demo-mode') {
            this.serverAddress = 'demo://';
            this.localConnection = false;
            return;
        }
        
        let cleanedAddress = ipAddress.trim();
        
        if (!cleanedAddress.startsWith('http://') && !cleanedAddress.startsWith('https://')) {
            cleanedAddress = 'http://' + cleanedAddress;
        }
        
        this.serverAddress = cleanedAddress;
        
        const hostname = new URL(this.serverAddress).hostname;
        this.localConnection = this.checkLocalDevice(hostname);
        
        console.log(`API URL установлен: ${this.serverAddress} (локальное: ${this.localConnection})`);
    }

    checkLocalDevice(hostname) {
        if (hostname === 'localhost' || hostname.endsWith('.local')) {
            return true;
        }
        
        const ipPatterns = [
            /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
            /^192\.168\.\d{1,3}\.\d{1,3}$/,
            /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
            /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
        ];
        
        return ipPatterns.some(pattern => pattern.test(hostname));
    }
    
    async getSystemInfo(ipAddress) {
        this.configureServerAddress(ipAddress);
        return await this.makeRequest('/api/info');
    }
    
    async getSystemState(ipAddress) {
        this.configureServerAddress(ipAddress);
        return await this.makeRequest('/api/state');
    }
    
    async controlPumpOperation(ipAddress, action) {
        this.configureServerAddress(ipAddress);
        return await this.makeRequest('/api/pump', {
            method: 'POST',
            body: JSON.stringify({ state: action })
        });
    }
    
    async controlLightOperation(ipAddress, action) {
        this.configureServerAddress(ipAddress);
        return await this.makeRequest('/api/light', {
            method: 'POST',
            body: JSON.stringify({ state: action })
        });
    }
    
    async updateSystemSettings(ipAddress, newSettings) {
        this.configureServerAddress(ipAddress);
        return await this.makeRequest('/api/settings', {
            method: 'POST',
            body: JSON.stringify(newSettings)
        });
    }
    
    async setDeviceTime(ipAddress, hoursValue, minutesValue) {
        this.configureServerAddress(ipAddress);
        return await this.makeRequest('/api/time', {
            method: 'POST',
            body: JSON.stringify({ hours: hoursValue, minutes: minutesValue })
        });
    }
    
    async synchronizeTime(ipAddress) {
        this.configureServerAddress(ipAddress);
        return await this.makeRequest('/api/time/sync', {
            method: 'POST'
        });
    }
    
    async clearErrorLog(ipAddress) {
        this.configureServerAddress(ipAddress);
        return await this.makeRequest('/api/errors/clear', {
            method: 'POST'
        });
    }
    
    async resetSystemStatistics(ipAddress) {
        this.configureServerAddress(ipAddress);
        return await this.makeRequest('/api/stats/reset', {
            method: 'POST'
        });
    }
    
    async testDeviceConnection(ipAddress) {
        if (ipAddress === 'demo-mode') {
            return true;
        }
        
        this.configureServerAddress(ipAddress);
        
        try {
            const abortController = new AbortController();
            const connectionTimer = setTimeout(() => abortController.abort(), 4000);
            
            const testResponse = await fetch(`${this.serverAddress}/api/info`, {
                method: 'GET',
                signal: abortController.signal
            });
            
            clearTimeout(connectionTimer);
            
            if (testResponse.ok) {
                const responseData = await testResponse.json().catch(() => ({}));
                console.log(`Успешное подключение к ${ipAddress}:`, responseData);
                return true;
            }
            
            return false;
        } catch (error) {
            console.log(`Не удалось подключиться к ${ipAddress}:`, error.message);
            return false;
        }
    }
}
