class ChartsManager {
    constructor() {
        this.moistureChart = null;
        this.statsChart = null;
        this.historyData = [];
        this.currentTimeRange = 1;
        this.timeRanges = {
            1: 60 * 60 * 1000,
            6: 6 * 60 * 60 * 1000,
            24: 24 * 60 * 60 * 1000
        };
        this.chartInitialized = false;
    }
    
    init() {
        if (!this.chartInitialized) {
            this.initMoistureChart();
            this.initStatsChart();
            this.chartInitialized = true;
        }
    }
    
    recreateCharts() {
        this.chartInitialized = false;
        this.init();
    }
    
    initMoistureChart() {
        const ctx = document.getElementById('moistureChart');
        if (!ctx) return;
        
        // Уничтожаем предыдущий график, если он существует
        if (this.moistureChart) {
            this.moistureChart.destroy();
        }
        
        // Получаем цвета для текущей темы
        const accentColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--accent-primary').trim() || '#00ff9d';
        
        const bgCard = getComputedStyle(document.documentElement)
            .getPropertyValue('--bg-card').trim() || '#172a45';
        
        const textPrimary = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-primary').trim() || '#e2e8f0';
        
        const textSecondary = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-secondary').trim() || '#a0aec0';
        
        // Преобразуем hex в rgb
        let rgbColor = this.hexToRgb(accentColor) || { r: 0, g: 255, b: 157 };
        
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.3)`);
        gradient.addColorStop(1, `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.05)`);
        
        this.moistureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Влажность (%)',
                    data: [],
                    borderColor: accentColor,
                    backgroundColor: gradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointBackgroundColor: 'transparent',
                    pointBorderColor: 'transparent',
                    pointBorderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeInOutQuart'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: bgCard,
                        titleColor: accentColor,
                        bodyColor: textPrimary,
                        borderColor: accentColor,
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: {
                            label: (context) => {
                                return `Влажность: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.1)`,
                            drawBorder: false
                        },
                        ticks: {
                            color: textSecondary,
                            font: {
                                size: 11
                            },
                            callback: (value) => value + '%'
                        }
                    },
                    x: {
                        grid: {
                            color: `rgba(${rgbColor.r}, ${rgbColor.g}, ${rgbColor.b}, 0.1)`,
                            drawBorder: false
                        },
                        ticks: {
                            color: textSecondary,
                            maxRotation: 0,
                            callback: (value, index, values) => {
                                if (values.length > 10 && index % Math.floor(values.length / 5) !== 0) {
                                    return '';
                                }
                                return this.getTimeLabel(values[index]);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                }
            }
        });
    }
    
    hexToRgb(hex) {
        // Удаляем # если есть
        hex = hex.replace('#', '');
        
        // Преобразуем 3-значный hex в 6-значный
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        return { r, g, b };
    }
    
    getTimeLabel(value) {
        const label = this.moistureChart.data.labels[value];
        if (!label) return '';
        
        const timeParts = label.split(':');
        if (timeParts.length === 2) {
            return `${timeParts[0]}:${timeParts[1]}`;
        }
        return label;
    }
    
    setTimeRange(hours) {
        console.log(`Установка диапазона времени: ${hours} часов`);
        this.currentTimeRange = hours;
        this.updateChartWithTimeRange();
    }
    
    updateMoistureChart(historyData, currentTime = null) {
        if (!this.moistureChart) {
            this.initMoistureChart();
        }
        
        if (!historyData || !Array.isArray(historyData)) {
            return;
        }
        
        const now = new Date();
        this.historyData.push({
            timestamp: now.getTime(),
            value: historyData[historyData.length - 1] || 50,
            timeString: now.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })
        });
        
        const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);
        this.historyData = this.historyData.filter(data => data.timestamp > twentyFourHoursAgo);
        
        this.updateChartWithTimeRange();
    }
    
    updateChartWithTimeRange() {
        console.log(`Обновление графика с диапазоном: ${this.currentTimeRange}ч`);
        console.log(`Данных в истории: ${this.historyData.length}`);
        
        if (!this.moistureChart || this.historyData.length === 0) {
            console.warn('График не инициализирован или нет данных');
            return;
        }
        
        const now = new Date().getTime();
        const timeRange = this.timeRanges[this.currentTimeRange];
        const cutoffTime = now - timeRange;
        
        const filteredData = this.historyData.filter(data => data.timestamp >= cutoffTime);
        
        if (filteredData.length === 0) return;
        
        let maxPoints;
        switch (this.currentTimeRange) {
            case 1:
                maxPoints = 12;
                break;
            case 6:
                maxPoints = 18;
                break;
            case 24:
                maxPoints = 24;
                break;
            default:
                maxPoints = 20;
        }
        
        const step = Math.max(1, Math.floor(filteredData.length / maxPoints));
        const displayData = [];
        const displayLabels = [];
        
        for (let i = 0; i < filteredData.length; i += step) {
            if (displayData.length >= maxPoints) break;
            
            displayData.push(filteredData[i].value);
            
            const date = new Date(filteredData[i].timestamp);
            let timeLabel;
            
            if (this.currentTimeRange === 1) {
                timeLabel = date.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            } else if (this.currentTimeRange === 6) {
                timeLabel = date.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            } else {
                timeLabel = date.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit' 
                });
            }
            
            displayLabels.push(timeLabel);
        }
        
        this.moistureChart.data.labels = displayLabels;
        this.moistureChart.data.datasets[0].data = displayData;
        this.moistureChart.update('none');
    }
    
    initStatsChart() {
        const ctx = document.getElementById('statsChart');
        if (!ctx) return;
        
        if (this.statsChart) {
            this.statsChart.destroy();
        }
        
        const accentPrimary = getComputedStyle(document.documentElement)
            .getPropertyValue('--accent-primary').trim() || '#00ff9d';
        const accentSecondary = getComputedStyle(document.documentElement)
            .getPropertyValue('--accent-secondary').trim() || '#00d9ff';
        
        const textSecondary = getComputedStyle(document.documentElement)
            .getPropertyValue('--text-secondary').trim() || '#a0aec0';
        
        this.statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                datasets: [{
                    label: 'Поливы',
                    data: [3, 5, 2, 4, 6, 3, 5],
                    backgroundColor: accentPrimary,
                    borderRadius: 6,
                    borderWidth: 0
                }, {
                    label: 'Часы света',
                    data: [8, 10, 9, 8, 12, 10, 9],
                    backgroundColor: accentSecondary,
                    borderRadius: 6,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: textSecondary,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    }
                },
                scales: {
                    y: {
                        grid: {
                            color: `rgba(${this.hexToRgb(accentPrimary).r}, ${this.hexToRgb(accentPrimary).g}, ${this.hexToRgb(accentPrimary).b}, 0.1)`
                        },
                        ticks: {
                            color: textSecondary
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: textSecondary
                        }
                    }
                }
            }
        });
    }
}
