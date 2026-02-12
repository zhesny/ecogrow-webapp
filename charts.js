class ChartsManager {
    constructor() {
        this.moistureChart = null;
        this.history = [];
        this.currentRange = 1;
    }

    init() {
        this.initMoistureChart();
        this.loadHistory();
    }

    initMoistureChart() {
        const ctx = document.getElementById('moistureChart');
        if (!ctx) return;
        const grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        grad.addColorStop(0, 'rgba(100, 255, 218, 0.3)');
        grad.addColorStop(1, 'rgba(100, 255, 218, 0.05)');
        this.moistureChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Влажность (%)',
                    data: [],
                    borderColor: '#64ffda',
                    backgroundColor: grad,
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
                animation: { duration: 500 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(10,25,47,0.9)',
                        titleColor: '#64ffda',
                        bodyColor: '#e6f1ff',
                        borderColor: '#64ffda',
                        borderWidth: 1,
                        cornerRadius: 8,
                        callbacks: { label: (ctx) => `Влажность: ${ctx.parsed.y}%` }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(100,255,218,0.1)', drawBorder: false },
                        ticks: { color: '#8892b0', font: { size: 11 }, callback: (v) => v + '%' }
                    },
                    x: {
                        grid: { display: false, drawBorder: false },
                        ticks: { color: '#8892b0', maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }
                    }
                },
                interaction: { intersect: false, mode: 'nearest' }
            }
        });
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('ecogrow_moisture_history');
            if (saved) {
                this.history = JSON.parse(saved);
                this.history = this.history.slice(-1000);
            }
        } catch (e) {
            console.warn('Failed to load moisture history', e);
        }
    }

    saveHistory() {
        try {
            localStorage.setItem('ecogrow_moisture_history', JSON.stringify(this.history.slice(-1000)));
        } catch (e) {}
    }

    addDataPoint(moisture) {
        if (!moisture && moisture !== 0) return;
        const now = Date.now();
        this.history.push({ time: now, value: moisture });
        this.history = this.history.slice(-1000);
        this.saveHistory();
        this.renderChart();
    }

    setTimeRange(hours) {
        this.currentRange = hours;
        this.renderChart();
    }

    renderChart() {
        if (!this.moistureChart) return;
        const cutoff = Date.now() - this.currentRange * 3600 * 1000;
        let filtered = this.history.filter(p => p.time >= cutoff);
        if (filtered.length === 0) {
            this.moistureChart.data.labels = [];
            this.moistureChart.data.datasets[0].data = [];
            this.moistureChart.update();
            return;
        }
        let aggregated;
        if (this.currentRange <= 1) {
            aggregated = filtered;
        } else if (this.currentRange <= 6) {
            aggregated = this.aggregateByMinutes(filtered, 10);
        } else {
            aggregated = this.aggregateByMinutes(filtered, 30);
        }
        const labels = aggregated.map(p => {
            const d = new Date(p.time);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        });
        const values = aggregated.map(p => p.value);
        this.moistureChart.data.labels = labels;
        this.moistureChart.data.datasets[0].data = values;
        this.moistureChart.update();
    }

    aggregateByMinutes(data, interval) {
        const ms = interval * 60 * 1000;
        const groups = new Map();
        data.forEach(p => {
            const bucket = Math.floor(p.time / ms) * ms;
            if (!groups.has(bucket)) groups.set(bucket, []);
            groups.get(bucket).push(p.value);
        });
        const result = [];
        groups.forEach((values, time) => {
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            result.push({ time, value: Math.round(avg) });
        });
        return result.sort((a, b) => a.time - b.time);
    }

    updateMoistureChart(data) {
        this.addDataPoint(data);
    }
}