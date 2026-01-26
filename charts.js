class ChartsManager {
    constructor() {
        this.moistureChart = null;
        this.statsChart = null;
        this.selectedTimeRange = '1h';
        this.chartData = {
            timestamps: [],
            moisture: []
        };
    }
    
    init() {
        this.initMoistureChart();
        this.initStatsChart();
        this.setupTimeRangeButtons();
    }
    
    setupTimeRangeButtons() {
        const buttons = document.querySelectorAll('.time-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                buttons.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.selectedTimeRange = e.target.dataset.range;
                this.updateChartWithTimeRange();
            });
        });
    }
    
    initMoistureChart() {
        const ctx = document.getElementById('moistureChart');
        if (!ctx) return;
        
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(0, 255, 157, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 255, 157, 0.05)');
        
        this.moistureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Влажность (%)',
                    data: [],
                    borderColor: '#00ff9d',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#00ff9d',
                    pointBorderColor: '#0a192f',
                    pointBorderWidth: 2
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
                        backgroundColor: 'rgba(10, 25, 47, 0.9)',
                        titleColor: '#64ffda',
                        bodyColor: '#e6f1ff',
                        borderColor: '#64ffda',
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
                            color: 'rgba(100, 255, 218, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8892b0',
                            font: {
                                size: 11
                            },
                            callback: (value) => value + '%'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(100, 255, 218, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#8892b0',
                            font: {
                                size: 11
                            },
                            maxTicksLimit: 8
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
    
    updateChartWithTimeRange() {
        if (!this.moistureChart || !this.chartData.timestamps.length) return;
        
        const now = Date.now();
        let timeFilter;
        
        switch(this.selectedTimeRange) {
            case '1h':
                timeFilter = now - (60 * 60 * 1000);
                break;
            case '6h':
                timeFilter = now - (6 * 60 * 60 * 1000);
                break;
            case '24h':
                timeFilter = now - (24 * 60 * 60 * 1000);
                break;
            default:
                timeFilter = now - (60 * 60 * 1000);
        }
        
        const filteredIndices = [];
        const filteredTimestamps = [];
        const filteredMoisture = [];
        
        for (let i = 0; i < this.chartData.timestamps.length; i++) {
            if (this.chartData.timestamps[i] >= timeFilter) {
                filteredIndices.push(i);
                filteredTimestamps.push(this.chartData.timestamps[i]);
                filteredMoisture.push(this.chartData.moisture[i]);
            }
        }
        
        // If not enough data, generate demo data
        if (filteredTimestamps.length < 5) {
            this.generateDemoDataForTimeRange(timeFilter, now);
            this.updateChartWithTimeRange();
            return;
        }
        
        // Sample data for display (max 100 points)
        const sampleStep = Math.max(1, Math.floor(filteredTimestamps.length / 100));
        const sampledTimestamps = [];
        const sampledMoisture = [];
        
        for (let i = 0; i < filteredTimestamps.length; i += sampleStep) {
            sampledTimestamps.push(filteredTimestamps[i]);
            sampledMoisture.push(filteredMoisture[i]);
        }
        
        // Format time labels
        const labels = sampledTimestamps.map(ts => {
            const date = new Date(ts);
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        });
        
        this.moistureChart.data.labels = labels;
        this.moistureChart.data.datasets[0].data = sampledMoisture;
        this.moistureChart.update();
    }
    
    updateMoistureChart(historyData) {
        if (!this.moistureChart) return;
        
        const now = Date.now();
        
        // Add new data
        if (Array.isArray(historyData)) {
            // If array of history data
            const step = 300000; // 5 minutes between points
            historyData.forEach((value, index) => {
                const timestamp = now - (historyData.length - index - 1) * step;
                this.chartData.timestamps.push(timestamp);
                this.chartData.moisture.push(value);
            });
        } else {
            // If single value
            this.chartData.timestamps.push(now);
            this.chartData.moisture.push(historyData);
        }
        
        // Limit data size (keep 7 days)
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
        while (this.chartData.timestamps.length > 0 && this.chartData.timestamps[0] < weekAgo) {
            this.chartData.timestamps.shift();
            this.chartData.moisture.shift();
        }
        
        this.updateChartWithTimeRange();
    }
    
    generateDemoDataForTimeRange(startTime, endTime) {
        const duration = endTime - startTime;
        const pointCount = Math.min(100, Math.floor(duration / (5 * 60 * 1000))); // point every 5 minutes
        
        if (pointCount < 2) return;
        
        this.chartData.timestamps = [];
        this.chartData.moisture = [];
        
        const baseMoisture = 50 + Math.random() * 20;
        
        for (let i = 0; i < pointCount; i++) {
            const timestamp = startTime + (i * duration / pointCount);
            const moisture = baseMoisture + Math.sin(i * 0.5) * 15 + Math.random() * 5;
            
            this.chartData.timestamps.push(timestamp);
            this.chartData.moisture.push(Math.max(0, Math.min(100, moisture)));
        }
    }
    
    generateDemoData() {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);
        this.generateDemoDataForTimeRange(oneHourAgo, now);
        this.updateChartWithTimeRange();
    }
    
    initStatsChart() {
        const ctx = document.getElementById('statsChart');
        if (!ctx) return;
        
        this.statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                datasets: [{
                    label: 'Поливы',
                    data: [3, 5, 2, 4, 6, 3, 5],
                    backgroundColor: '#64ffda',
                    borderRadius: 6,
                    borderWidth: 0
                }, {
                    label: 'Часы света',
                    data: [8, 10, 9, 8, 12, 10, 9],
                    backgroundColor: '#00d9ff',
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
                            color: '#a8b2d1',
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    }
                },
                scales: {
                    y: {
                        grid: {
                            color: 'rgba(100, 255, 218, 0.1)'
                        },
                        ticks: {
                            color: '#8892b0'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#8892b0'
                        }
                    }
                }
            }
        });
    }
}
