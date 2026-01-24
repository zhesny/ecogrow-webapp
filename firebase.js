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
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Firebase functions
class FirebaseService {
    constructor() {
        this.devicesRef = database.ref('devices');
        this.currentDeviceId = null;
        this.currentDeviceRef = null;
        this.stateListener = null;
        this.commandsListener = null;
    }

    // Scan for online devices
    scanForDevices() {
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

    // Connect to specific device
    connectToDevice(deviceId) {
        this.currentDeviceId = deviceId;
        this.currentDeviceRef = this.devicesRef.child(deviceId);
        
        // Update device last seen
        this.updateDeviceStatus();
        
        // Set up periodic status updates
        this.statusInterval = setInterval(() => {
            this.updateDeviceStatus();
        }, 30000);
        
        return this.currentDeviceRef;
    }

    // Update device status
    updateDeviceStatus() {
        if (this.currentDeviceRef) {
            this.currentDeviceRef.update({
                lastSeen: Date.now(),
                online: true
            });
        }
    }

    // Listen for device state changes
    listenToState(callback) {
        if (this.stateListener) {
            this.stateListener.off();
        }
        
        if (this.currentDeviceRef) {
            this.stateListener = this.currentDeviceRef.child('state').on('value', (snapshot) => {
                callback(snapshot.val());
            });
        }
    }

    // Listen for device settings
    listenToSettings(callback) {
        if (this.settingsListener) {
            this.settingsListener.off();
        }
        
        if (this.currentDeviceRef) {
            this.settingsListener = this.currentDeviceRef.child('settings').on('value', (snapshot) => {
                callback(snapshot.val());
            });
        }
    }

    // Send command to device
    sendCommand(command, value = null) {
        if (!this.currentDeviceRef) return false;
        
        const commandsRef = this.currentDeviceRef.child('commands');
        
        if (typeof command === 'object') {
            // If command is an object, set multiple values
            return commandsRef.update(command);
        } else {
            // If command is a string, set single value
            const data = {};
            data[command] = value;
            return commandsRef.update(data);
        }
    }

    // Update device settings
    updateSettings(settings) {
        if (!this.currentDeviceRef) return false;
        
        return this.currentDeviceRef.child('settings').update(settings);
    }

    // Get device errors
    getErrors() {
        if (!this.currentDeviceRef) return Promise.resolve([]);
        
        return new Promise((resolve) => {
            this.currentDeviceRef.child('errors').once('value', (snapshot) => {
                const errors = [];
                snapshot.forEach((childSnapshot) => {
                    errors.push({
                        id: childSnapshot.key,
                        message: childSnapshot.val()
                    });
                });
                resolve(errors);
            });
        });
    }

    // Clear errors
    clearErrors() {
        if (!this.currentDeviceRef) return false;
        
        return this.currentDeviceRef.child('errors').remove();
    }

    // Disconnect from device
    disconnect() {
        if (this.stateListener) {
            this.stateListener.off();
            this.stateListener = null;
        }
        
        if (this.settingsListener) {
            this.settingsListener.off();
            this.settingsListener = null;
        }
        
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
        
        this.currentDeviceId = null;
        this.currentDeviceRef = null;
    }

    // Check if device is online
    checkDeviceOnline(deviceId) {
        return new Promise((resolve) => {
            this.devicesRef.child(deviceId).child('online').once('value', (snapshot) => {
                resolve(snapshot.val() === true);
            });
        });
    }

    // Get device history
    getDeviceHistory(deviceId, hours = 24) {
        return new Promise((resolve) => {
            const ref = this.devicesRef.child(deviceId).child('moistureHistory');
            const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
            
            ref.orderByValue().startAt(cutoffTime).once('value', (snapshot) => {
                const history = [];
                snapshot.forEach((childSnapshot) => {
                    history.push({
                        timestamp: childSnapshot.key,
                        value: childSnapshot.val()
                    });
                });
                resolve(history);
            });
        });
    }
}

// Create global instance
const firebaseService = new FirebaseService();
