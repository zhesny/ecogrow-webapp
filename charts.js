class ChartsManager {
    constructor() {
        this.moistureChart = null;
        this.statsChart = null;
        this.historyData = [];
        this.currentTimeRange = 1; // 1 час по умолчанию
        this.timeRanges = {
            1: 60 * 60 * 1000,    // 1 час в миллисекундах
            6: 6 * 60 * 60 * 1000, // 6 часов
            24: 24 * 60 * 60 * 1000 // 24 часа
        };
        this.chartInitialized = false;
    }
    
    init() {
        if (!this.chartInitialized) {
            this.initMoistureChart();
            this.initStatsChart();
            this.initParticles();
            this.setupTimeButtons();
            this.chartInitialized = true;
        }
    }
    
    initMoistureChart() {
        const ctx = document.getElementById('moistureChart');
        if (!ctx) return;
        
        // Уничтожаем предыдущий график, если он существует
        if (this.moistureChart) {
            this.moistureChart.destroy();
        }
        
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(var(--accent-primary-rgb, 0, 255, 157), 0.3)');
        gradient.addColorStop(1, 'rgba(var(--accent-primary-rgb, 0, 255, 157), 0.05)');
        
        this.moistureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Влажность (%)',
                    data: [],
                    borderColor: 'var(--accent-primary)',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: 'var(--accent-primary)',
                    pointBorderColor: 'var(--bg-card)',
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
                        backgroundColor: 'var(--bg-card)',
                        titleColor: 'var(--accent-primary)',
                        bodyColor: 'var(--text-primary)',
                        borderColor: 'var(--accent-primary)',
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
                            color: 'rgba(var(--accent-primary-rgb, 0, 255, 157), 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'var(--text-secondary)',
                            font: {
                                size: 11
                            },
                            callback: (value) => value + '%'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(var(--accent-primary-rgb, 0, 255, 157), 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'var(--text-secondary)',
                            maxRotation: 0,
                            callback: (value, index, values) => {
                                // Показываем время только для некоторых делений
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
    
    getTimeLabel(value) {
        const label = this.moistureChart.data.labels[value];
        if (!label) return '';
        
        // Преобразуем строку времени в более короткий формат
        const timeParts = label.split(':');
        if (timeParts.length === 2) {
            return `${timeParts[0]}:${timeParts[1]}`;
        }
        return label;
    }
    
    setupTimeButtons() {
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const hours = parseInt(e.target.dataset.hours);
                this.setTimeRange(hours);
                
                // Update active button
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }
    
    setTimeRange(hours) {
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
        
        // Добавляем новые данные в историю
        const now = new Date();
        this.historyData.push({
            timestamp: now.getTime(),
            value: historyData[historyData.length - 1] || 50,
            timeString: now.toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
            })
        });
        
        // Храним данные за последние 24 часа
        const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000);
        this.historyData = this.historyData.filter(data => data.timestamp > twentyFourHoursAgo);
        
        this.updateChartWithTimeRange();
    }
    
    updateChartWithTimeRange() {
        if (!this.moistureChart || this.historyData.length === 0) return;
        
        const now = new Date().getTime();
        const timeRange = this.timeRanges[this.currentTimeRange];
        const cutoffTime = now - timeRange;
        
        // Фильтруем данные по выбранному диапазону
        const filteredData = this.historyData.filter(data => data.timestamp >= cutoffTime);
        
        if (filteredData.length === 0) return;
        
        // Определяем количество точек для отображения
        let maxPoints;
        switch (this.currentTimeRange) {
            case 1:
                maxPoints = 12; // Каждые 5 минут
                break;
            case 6:
                maxPoints = 18; // Каждые 20 минут
                break;
            case 24:
                maxPoints = 24; // Каждый час
                break;
            default:
                maxPoints = 20;
        }
        
        // Выбираем точки для отображения
        const step = Math.max(1, Math.floor(filteredData.length / maxPoints));
        const displayData = [];
        const displayLabels = [];
        
        for (let i = 0; i < filteredData.length; i += step) {
            if (displayData.length >= maxPoints) break;
            
            displayData.push(filteredData[i].value);
            
            // Форматируем метку времени
            const date = new Date(filteredData[i].timestamp);
            let timeLabel;
            
            if (this.currentTimeRange === 1) {
                // Для 1 часа показываем минуты
                timeLabel = date.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            } else if (this.currentTimeRange === 6) {
                // Для 6 часов показываем часы и минуты
                timeLabel = date.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            } else {
                // Для 24 часов показываем только часы
                timeLabel = date.toLocaleTimeString('ru-RU', { 
                    hour: '2-digit' 
                });
            }
            
            displayLabels.push(timeLabel);
        }
        
        // Обновляем график
        this.moistureChart.data.labels = displayLabels;
        this.moistureChart.data.datasets[0].data = displayData;
        this.moistureChart.update('none');
    }
    
    initStatsChart() {
        const ctx = document.getElementById('statsChart');
        if (!ctx) return;
        
        // Уничтожаем предыдущий график, если он существует
        if (this.statsChart) {
            this.statsChart.destroy();
        }
        
        this.statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
                datasets: [{
                    label: 'Поливы',
                    data: [3, 5, 2, 4, 6, 3, 5],
                    backgroundColor: 'var(--accent-primary)',
                    borderRadius: 6,
                    borderWidth: 0
                }, {
                    label: 'Часы света',
                    data: [8, 10, 9, 8, 12, 10, 9],
                    backgroundColor: 'var(--accent-secondary)',
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
                            color: 'var(--text-secondary)',
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    }
                },
                scales: {
                    y: {
                        grid: {
                            color: 'rgba(var(--accent-primary-rgb, 0, 255, 157), 0.1)'
                        },
                        ticks: {
                            color: 'var(--text-secondary)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'var(--text-secondary)'
                        }
                    }
                }
            }
        });
    }
    
    initParticles() {
        if (typeof particlesJS !== 'undefined') {
            particlesJS('particles-js', {
                particles: {
                    number: {
                        value: 80,
                        density: {
                            enable: true,
                            value_area: 800
                        }
                    },
                    color: {
                        value: "var(--accent-primary)"
                    },
                    shape: {
                        type: "circle"
                    },
                    opacity: {
                        value: 0.3,
                        random: true,
                        anim: {
                            enable: true,
                            speed: 1,
                            opacity_min: 0.1,
                            sync: false
                        }
                    },
                    size: {
                        value: 3,
                        random: true,
                        anim: {
                            enable: true,
                            speed: 2,
                            size_min: 0.1,
                            sync: false
                        }
                    },
                    line_linked: {
                        enable: true,
                        distance: 150,
                        color: "var(--accent-primary)",
                        opacity: 0.2,
                        width: 1
                    },
                    move: {
                        enable: true,
                        speed: 1,
                        direction: "none",
                        random: true,
                        straight: false,
                        out_mode: "out",
                        bounce: false,
                        attract: {
                            enable: false,
                            rotateX: 600,
                            rotateY: 1200
                        }
                    }
                },
                interactivity: {
                    detect_on: "canvas",
                    events: {
                        onhover: {
                            enable: true,
                            mode: "grab"
                        },
                        onclick: {
                            enable: true,
                            mode: "push"
                        },
                        resize: true
                    },
                    modes: {
                        grab: {
                            distance: 140,
                            line_linked: {
                                opacity: 0.5
                            }
                        },
                        push: {
                            particles_nb: 4
                        }
                    }
                },
                retina_detect: true
            });
        }
    }
}
