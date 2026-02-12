class ConfigManager {
    constructor() {
        this.config = {
            api: {
                endpoints: {
                    state: '/api/state',
                    settings: '/api/settings',
                    pump: '/api/pump',
                    light: '/api/light',
                    time: '/api/time',
                    errors: '/api/errors/clear',
                    info: '/api/info'
                },
                timeout: 5000,
                retryAttempts: 3
            },
            weather: {
                enabled: true,
                apiKey: 'your_openweathermap_api_key',
                location: {
                    lat: 55.7558,
                    lon: 37.6176
                },
                updateInterval: 300000
            },
            charts: {
                updateInterval: 5000,
                historyLength: 20,
                animationDuration: 1000
            },
            notifications: {
                enabled: true,
                sound: true,
                telegram: {
                    botToken: '8365221747:AAEskXtc6T-IhEik718wJJ9x-vz_TOh26tw',
                    chatId: '6712996693',
                    enabled: true
                }
            },
            theme: {
                default: 'dark',
                available: ['dark', 'light', 'green', 'purple'],
                autoSwitch: false,
                switchTime: {
                    light: '08:00',
                    dark: '20:00'
                }
            },
            plantDatabase: {
                plants: [
                    {
                        id: 1,
                        name: 'Монстера',
                        type: 'Декоративное',
                        moistureMin: 60,
                        moistureMax: 80,
                        lightHours: 8,
                        temperatureMin: 18,
                        temperatureMax: 25
                    },
                    {
                        id: 2,
                        name: 'Петуния',
                        type: 'Цветущее',
                        moistureMin: 70,
                        moistureMax: 90,
                        lightHours: 6,
                        temperatureMin: 15,
                        temperatureMax: 28
                    },
                    {
                        id: 3,
                        name: 'Кактус',
                        type: 'Сукулент',
                        moistureMin: 30,
                        moistureMax: 50,
                        lightHours: 12,
                        temperatureMin: 20,
                        temperatureMax: 35
                    }
                ]
            },
            developer: {
                name: 'Купченя Евгений Андреевич',
                telegram: '@Zhesny',
                email: 'zhenya.kupchenya@mail.ru',
                github: 'https://github.com/zhesny'
            }
        };
        this.loadFromLocalStorage();
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('ecogrow_config');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.config = { ...this.config, ...parsed };
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('ecogrow_config', JSON.stringify(this.config));
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    }

    get(key) {
        return key.split('.').reduce((obj, k) => obj?.[k], this.config);
    }

    set(key, value) {
        const keys = key.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, k) => obj[k] = obj[k] || {}, this.config);
        target[lastKey] = value;
        this.saveToLocalStorage();
    }

    getPlantRecommendation(moisture, lightHours) {
        const plants = this.config.plantDatabase.plants;
        for (const plant of plants) {
            if (
                moisture >= plant.moistureMin &&
                moisture <= plant.moistureMax &&
                lightHours >= plant.lightHours
            ) {
                return {
                    plant: plant.name,
                    match: 'Отличное соответствие',
                    message: `Идеальные условия для ${plant.name}`
                };
            }
        }
        return {
            plant: null,
            match: 'Нет совпадений',
            message: 'Рассмотрите изменение условий для ваших растений'
        };
    }

    calculateWaterConsumption(wateringCount, durationSec) {
        const pumpRate = 2;
        const totalSeconds = wateringCount * durationSec;
        const totalMinutes = totalSeconds / 60;
        return (totalMinutes * pumpRate).toFixed(1);
    }

    calculateEnergyConsumption(lightHours, pumpHours) {
        const lightPower = 50;
        const pumpPower = 100;
        return (lightHours * lightPower + pumpHours * pumpPower).toFixed(0);
    }
}