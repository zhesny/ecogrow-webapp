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
    }
    
    init() {
        this.initMoistureChart();
        this.initStatsChart();
        this.initParticles();
        this.setupTimeButtons();
    }
    
    initMoistureChart() {
        const ctx = document.getElementById('moistureChart');
        if (!ctx) return;
        
        // Получаем акцентный цвет из CSS переменной
        const getAccentColor = () => {
            return getComputedStyle(document.documentElement)
                .getPropertyValue('--accent-primary')
                .trim();
        };
        
        const accentColor = getAccentColor();
        
        // Преобразуем HEX в RGB для rgba
        const hexToRgb = (hex) => {
            hex = hex.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return { r, g, b };
        };
        
        let gradientStart, gradientEnd;
        
        // Создаем градиент в зависимости от темы
        if (accentColor === '#00ff9d' || accentColor === 'rgb(0, 255, 157)') {
            gradientStart = 'rgba(0, 255, 157, 0.3)';
            gradientEnd = 'rgba(0, 255, 157, 0.05)';
        } else if (accentColor === '#10b981' || accentColor === 'rgb(16, 185, 129)') {
            gradientStart = 'rgba(16, 185, 129, 0.3)';
            gradientEnd = 'rgba(16, 185, 129, 0.05)';
        } else if (accentColor === '#16a34a' || accentColor === 'rgb(22, 163, 74)') {
            gradientStart = 'rgba(22, 163, 74, 0.3)';
            gradientEnd = 'rgba(22, 163, 74, 0.05)';
        } else if (accentColor === '#0ea5e9' || accentColor === 'rgb(14, 165, 233)') {
            gradientStart = 'rgba(14, 165, 233, 0.3)';
            gradientEnd = 'rgba(14, 165, 233, 0.05)';
        } else {
            // Для других цветов пробуем преобразовать HEX в RGBA
            if (accentColor.startsWith('#')) {
                try {
                    const rgb = hexToRgb(accentColor);
                    gradientStart = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
                    gradientEnd = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05)`;
                } catch {
                    // Fallback на синий цвет
                    gradientStart = 'rgba(0, 255, 157, 0.3)';
                    gradientEnd = 'rgba(0, 255, 157, 0.05)';
                }
            } else {
                gradientStart = 'rgba(0, 255, 157, 0.3)';
                gradientEnd = 'rgba(0, 255, 157, 0.05)';
            }
        }
        
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, gradientStart);
        gradient.addColorStop(1, gradientEnd);
        
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
                    pointRadius: 3,
                    pointHoverRadius: 6,
                    pointBackgroundColor: accentColor,
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
                        titleColor: accentColor,
                        bodyColor: 'var(--text-primary)',
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
                            color: 'rgba(0, 255, 157, 0.1)',
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
                            color: 'rgba(0, 255, 157, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'var(--text-secondary)',
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
    
    getTimeLabel(value) {
        const label = this.moistureChart.data.labels[value];
        if (!label) return '';
        
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
        if (!this.moistureChart || this.historyData.length === 0) return;
        
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
                            color: 'rgba(0, 255, 157, 0.1)'
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
