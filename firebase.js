// Firebase Configuration and Initialization

console.log('🔥 Инициализация Firebase...');

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBsZr7vWJDFt_S5i0Rvj6ejp6QT0JX9SPk",
    authDomain: "ecogrow-remote.firebaseapp.com",
    databaseURL: "https://ecogrow-remote-default-rtdb.firebaseio.com",
    projectId: "ecogrow-remote",
    storageBucket: "ecogrow-remote.firebasestorage.app",
    messagingSenderId: "121689275158",
    appId: "1:121689275158:web:f3b1829755c8b8a1fb2e37",
    measurementId: "G-PG5116NH38"
};

// Initialize Firebase
try {
    if (typeof firebase === 'undefined') {
        console.error('❌ Firebase SDK не загружен');
        // Создаем заглушку для демо-режима
        window.firebaseDatabase = {
            ref: function(path) {
                console.log('DEMO: Ref to ' + path);
                return {
                    on: function(eventType, callback, errorCallback) {
                        console.log('DEMO: on ' + eventType + ' for ' + path);
                        return () => {};
                    },
                    set: function(value) {
                        console.log('DEMO: set', value, 'to', path);
                        return Promise.resolve();
                    },
                    update: function(value) {
                        console.log('DEMO: update', value, 'to', path);
                        return Promise.resolve();
                    },
                    remove: function() {
                        console.log('DEMO: remove', path);
                        return Promise.resolve();
                    },
                    once: function(eventType) {
                        console.log('DEMO: once ' + eventType + ' for ' + path);
                        return Promise.resolve({ 
                            val: () => null,
                            exists: () => false 
                        });
                    }
                };
            }
        };
    } else {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase инициализирован успешно');
        } else {
            console.log('⚠️ Firebase уже инициализирован');
        }
        
        const database = firebase.database();
        window.firebaseDatabase = database;
        
        console.log('📊 Firebase Database готов к использованию');
        
        // Тест подключения
        const connectedRef = database.ref('.info/connected');
        connectedRef.on('value', (snap) => {
            console.log('📡 Firebase подключение:', snap.val() ? '✅ Подключено' : '❌ Отключено');
        });
    }
    
} catch (error) {
    console.error('❌ Ошибка инициализации Firebase:', error);
    // Создаем заглушку для демо-режима
    window.firebaseDatabase = {
        ref: function(path) {
            console.log('DEMO (fallback): Ref to ' + path);
            return {
                on: function() { return () => {}; },
                set: function() { return Promise.resolve(); },
                update: function() { return Promise.resolve(); },
                remove: function() { return Promise.resolve(); },
                once: function() { return Promise.resolve({ val: () => null }); }
            };
        }
    };
}

// Firebase Service Class
class FirebaseService {
    constructor() {
        this.db = window.firebaseDatabase;
        this.devicesRef = this.db ? this.db.ref('devices') : null;
        this.currentDeviceId = null;
        this.currentDeviceRef = null;
    }

    isAvailable() {
        return this.db !== null;
    }

    scanForDevices() {
        if (!this.devicesRef) return Promise.resolve([]);
        
        return new Promise((resolve) => {
            this.devicesRef.once('value', (snapshot) => {
                const devices = [];
                snapshot.forEach((childSnapshot) => {
                    const device = childSnapshot.val();
                    if (device.online) {
                        devices.push({
                            id: childSnapshot.key,
                            name: device.name || 'EcoGrow Device',
                            ip: device.ip || 'Unknown',
                            online: device.online,
                            lastSeen: device.lastSeen || Date.now()
                        });
                    }
                });
                resolve(devices);
            });
        });
    }

    connectToDevice(deviceId) {
        if (!this.devicesRef) return null;
        
        this.currentDeviceId = deviceId;
        this.currentDeviceRef = this.devicesRef.child(deviceId);
        this.updateDeviceStatus();
        
        return this.currentDeviceRef;
    }

    updateDeviceStatus() {
        if (this.currentDeviceRef) {
            this.currentDeviceRef.update({
                lastSeen: Date.now(),
                online: true
            });
        }
    }

    sendCommand(command, value = null) {
        if (!this.currentDeviceRef) return false;
        
        const commandsRef = this.currentDeviceRef.child('commands');
        
        if (typeof command === 'object') {
            return commandsRef.update(command);
        } else {
            const data = {};
            data[command] = value;
            return commandsRef.update(data);
        }
    }

    disconnect() {
        this.currentDeviceId = null;
        this.currentDeviceRef = null;
    }
}

// Create global instance if Firebase available
if (window.firebaseDatabase) {
    window.firebaseService = new FirebaseService();
    console.log('✅ Firebase Service создан');
}
