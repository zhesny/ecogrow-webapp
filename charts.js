class ChartsManager {
    constructor() {
        this.moistureChart = null;
        this.statsChart = null;
        this.historyData = [];
    }
    
    init() {
        this.initMoistureChart();
        this.initStatsChart();
        this.initParticles();
    }
    
    initMoistureChart() {
        const ctx = document.getElementById('moistureChart');
        if (!ctx) return;
        
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(100, 255, 218, 0.3)');
        gradient.addColorStop(1, 'rgba(100, 255, 218, 0.05)');
        
        this.moistureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Влажность (%)',
                    data: [],
                    borderColor: '#64ffda',
                    backgroundColor: gradient,
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointBackgroundColor: '#64ffda',
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
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            display: false
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
    
    updateMoistureChart(data) {
        if (!this.moistureChart || !data) return;
        
        // Add new data point
        const now = new Date();
        const timeLabel = now.toLocaleTimeString('ru-RU', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        // Keep only last 20 points
        if (this.moistureChart.data.labels.length >= 20) {
            this.moistureChart.data.labels.shift();
            this.moistureChart.data.datasets[0].data.shift();
        }
        
        // Add new point
        this.moistureChart.data.labels.push(timeLabel);
        this.moistureChart.data.datasets[0].data.push(data.moisture);
        
        // Update chart
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
                        value: "#64ffda"
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
                        color: "#64ffda",
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
