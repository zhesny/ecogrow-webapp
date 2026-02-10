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
                },
                mode: 'cors',
                credentials: 'omit'
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
            this.serverAddress = '';
            this.localConnection = false;
            return;
        }
        
        const cleanedAddress = ipAddress.replace(/^https?:\/\//, '').toLowerCase();
        const isLocalDevice = this.checkLocalDevice(cleanedAddress);
        this.localConnection = isLocalDevice;

        if (isLocalDevice) {
            this.serverAddress = `http://${cleanedAddress}`;
        } else {
            if (window.location.protocol === 'https:' && !cleanedAddress.startsWith('https://')) {
                this.serverAddress = `https://${cleanedAddress}`;
            } else {
                this.serverAddress = `http://${cleanedAddress}`;
            }
        }
        
        console.log(`API URL установлен: ${this.serverAddress}`);
    }

    checkLocalDevice(ipAddress) {
        const hostnameOnly = ipAddress.split('/')[0].split(':')[0];
        
        if (hostnameOnly === 'localhost' || hostnameOnly.endsWith('.local')) {
            return true;
        }
        
        if (hostnameOnly === 'demo-mode') {
            return false;
        }
        
        const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = hostnameOnly.match(ipPattern);
        
        if (match) {
            const [_, a, b, c, d] = match.map(Number);
            
            if (a === 10) return true;
            if (a === 172 && b >= 16 && b <= 31) return true;
            if (a === 192 && b === 168) return true;
            if (a === 127 && b === 0 && c === 0 && d === 1) return true;
            if (a === 169 && b === 254) return true;
            if (a === 100 && b >= 64 && b <= 127) return true;
        }
        
        return false;
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
            return new Promise(resolve => {
                setTimeout(() => resolve(true), 500);
            });
        }
        
        this.configureServerAddress(ipAddress);
        
        try {
            const abortController = new AbortController();
            const connectionTimer = setTimeout(() => abortController.abort(), 3000);
            
            const testResponse = await fetch(`${this.serverAddress}/api/info`, {
                method: 'GET',
                signal: abortController.signal,
                mode: 'cors',
                credentials: 'omit',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(connectionTimer);
            
            if (testResponse.ok) {
                const responseData = await testResponse.json().catch(() => ({}));
                console.log(`Подключение к ${ipAddress}:`, responseData);
                return true;
            }
            
            return false;
        } catch (error) {
            console.log(`Не удалось подключиться к ${ipAddress}:`, error.message);
            return false;
        }
    }
}
