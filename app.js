class EcoGrowApp {
    constructor() {
        this.api = new EcoGrowAPI();
        this.charts = new ChartsManager();
        this.theme = new ThemeManager();
        this.notifications = new NotificationManager();
        this.config = new ConfigManager();
        this.state = {
            connected: false,
            espIp: null,
            currentData: null,
            settings: {},
            lastUpdate: null
        };
        this.demoMode = false;
        this.demoInterval = null;
        this.updateInterval = 5000; // мс, по умолчанию 5 сек
        this.updateTimer = null;
        this.init();
    }

    async init() {
        this.theme.init();
        this.showLoading();
        await this.tryAutoConnect();
        this.charts.init();
        this.startUpdateLoop();
        this.setupEventListeners();
        this.initMobileNavigation();
        setTimeout(() => this.hideLoading(), 1500);
    }

    showLoading() {
        const ls = document.getElementById('loadingScreen');
        if (ls) {
            ls.style.opacity = '1';
            ls.style.pointerEvents = 'all';
        }
    }

    hideLoading() {
        const ls = document.getElementById('loadingScreen');
        const mc = document.getElementById('mainContainer');
        if (ls) {
            ls.style.opacity = '0';
            setTimeout(() => {
                ls.style.display = 'none';
                if (mc) mc.style.display = 'block';
            }, 500);
        }
    }

    async tryAutoConnect() {
        try {
            const res = await fetch('http://ecogrow.local/api/info', { timeout: 2000 });
            if (res.ok) {
                this.state.espIp = 'ecogrow.local';
                await this.connectToESP();
                return;
            }
        } catch (e) {
            const saved = localStorage.getItem('ecogrow_ip');
            if (saved) {
                this.state.espIp = saved;
                await this.connectToESP();
                return;
            }
        }
        this.showConnectionModal();
    }

    showConnectionModal() {
        const m = document.getElementById('connectionModal');
        if (m) m.classList.add('active');
    }

    hideConnectionModal() {
        const m = document.getElementById('connectionModal');
        if (m) m.classList.remove('active');
    }

    async connectToESP() {
        if (!this.state.espIp && !this.demoMode) return;
        try {
            if (this.demoMode) {
                this.api = new MockEcoGrowAPI();
                this.state.connected = true;
                this.updateConnectionStatus();
                await this.updateData();
                this.hideConnectionModal();
                this.notifications.show('🧪 Демо-режим активирован', 'info');
                return;
            }
            const info = await this.api.getInfo(this.state.espIp);
            localStorage.setItem('ecogrow_ip', this.state.espIp);
            this.state.connected = true;
            this.updateConnectionStatus();
            await this.updateData();
            this.hideConnectionModal();
            this.notifications.show('✅ Успешно подключено к системе!', 'success');
        } catch (e) {
            console.error(e);
            this.state.connected = false;
            this.updateConnectionStatus();
            this.notifications.show('❌ Не удалось подключиться к системе', 'error');
            this.showConnectionModal();
        }
    }

    enableDemoMode() {
        this.demoMode = true;
        this.state.espIp = 'demo';
        this.connectToESP();
    }

    updateConnectionStatus() {
        const el = document.getElementById('connectionStatus');
        if (el) {
            if (this.state.connected) {
                const ipText = this.demoMode ? 'Демо-режим' : this.state.espIp;
                el.innerHTML = `<div class="status-dot"></div><span>Подключено к ${ipText}</span>`;
                el.classList.add('connected');
            } else {
                el.innerHTML = `<div class="status-dot"></div><span>Нет подключения</span>`;
                el.classList.remove('connected');
            }
        }
    }

    async updateData() {
        if (!this.state.connected) return;
        try {
            const d = await this.api.getState(this.state.espIp);
            this.state.currentData = d;
            this.state.lastUpdate = new Date();
            this.updateUI(d);
            this.charts.addDataPoint(d.moisture);
            this.checkNotifications(d);
        } catch (e) {
            console.error(e);
            this.state.connected = false;
            this.updateConnectionStatus();
        }
    }

    updateUI(d) {
        this.updateElementWithPulse('moistureValue', d.moisture);
        this.updateElement('avgMoisture', (d.avg_moisture || '--') + '%');
        this.updateElement('minMoisture', (d.min_moisture || '--') + '%');
        this.updateElement('maxMoisture', (d.max_moisture || '--') + '%');

        const bar = document.getElementById('moistureBarFill');
        if (bar) bar.style.width = d.moisture + '%';

        const circ = document.querySelector('.circle-progress');
        if (circ) {
            const c = 2 * Math.PI * 54;
            const off = c - (d.moisture / 100) * c;
            circ.style.strokeDashoffset = off;
        }

        const icon = document.getElementById('moistureIcon');
        if (icon) {
            if (d.moisture < 30) icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            else if (d.moisture < 50) icon.innerHTML = '<i class="fas fa-tint"></i>';
            else if (d.moisture > 80) icon.innerHTML = '<i class="fas fa-flood"></i>';
            else icon.innerHTML = '<i class="fas fa-leaf"></i>';
        }

        document.getElementById('moistureStatus').innerHTML = d.moisture + '%';
        document.getElementById('pumpStatus').innerHTML = d.pump ? 'ВКЛ' : 'ВЫКЛ';
        document.getElementById('pumpStatus').className = `status-badge ${d.pump ? 'online' : ''}`;
        document.getElementById('lightStatus').innerHTML = d.light ? 'ВКЛ' : 'ВЫКЛ';
        document.getElementById('lightStatus').className = `status-badge ${d.light ? 'online' : ''}`;

        const sleep = d.sleep_enabled && this.isTimeInRange(new Date(), d.sleep_start, d.sleep_end);
        document.getElementById('sleepStatus').innerHTML = sleep ? 'Активен' : 'Неактивен';
        document.getElementById('sleepStatus').className = `status-badge ${sleep ? 'online' : ''}`;

        this.updateElement('totalWaterings', d.total_waterings || 0);
        this.updateElement('totalLightHours', d.total_light_hours || 0);
        this.updateElement('energyUsed', d.total_energy || 0);
        this.updateElement('systemTime', d.current_time || '--:--');
        this.updateElement('lightToday', (d.light ? 1 : 0) + ' ч');

        if (d.moisture_threshold !== undefined) {
            const th = document.getElementById('moistureThreshold');
            if (th) th.value = d.moisture_threshold;
            document.getElementById('thresholdValue').textContent = d.moisture_threshold + '%';
            document.getElementById('thresholdValueDisplay').textContent = d.moisture_threshold + '%';
        }
        if (d.watering_delay) document.getElementById('wateringDelay').value = d.watering_delay;
        if (d.watering_duration) document.getElementById('wateringDuration').value = d.watering_duration;

        if (d.lamp_start) document.getElementById('lightOnTime').value = d.lamp_start;
        if (d.lamp_end) document.getElementById('lightOffTime').value = d.lamp_end;
        const lampEn = document.getElementById('lightScheduleToggle');
        if (lampEn) lampEn.checked = d.lamp_enabled || false;

        if (d.sleep_start) document.getElementById('sleepStartTime').value = d.sleep_start;
        if (d.sleep_end) document.getElementById('sleepEndTime').value = d.sleep_end;
        const sleepEn = document.getElementById('sleepModeToggle');
        if (sleepEn) sleepEn.checked = d.sleep_enabled || false;

        if (d.current_time) {
            const parts = d.current_time.split(':');
            if (parts.length >= 2) {
                const hh = document.getElementById('manualHours');
                const mm = document.getElementById('manualMinutes');
                if (hh) hh.value = parseInt(parts[0], 10);
                if (mm) mm.value = parseInt(parts[1], 10);
            }
        }

        this.updateErrorsList(d.errors || []);
    }

    updateElement(id, val) {
        const el = document.getElementById(id);
        if (!el) return;
        if (typeof val === 'number' && !isNaN(parseFloat(el.textContent))) {
            this.animateValue(el, parseFloat(el.textContent) || 0, val, 500);
        } else {
            el.textContent = val;
        }
    }

    updateElementWithPulse(id, val) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.transition = 'transform 0.2s ease';
        el.style.transform = 'scale(1.1)';
        setTimeout(() => el.style.transform = 'scale(1)', 200);
        this.updateElement(id, val);
    }

    animateValue(el, start, end, dur) {
        let startTs = null;
        const step = (ts) => {
            if (!startTs) startTs = ts;
            const p = Math.min((ts - startTs) / dur, 1);
            el.textContent = Math.floor(p * (end - start) + start);
            if (p < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }

    updateErrorsList(errors) {
        const list = document.getElementById('errorsList');
        const cnt = document.getElementById('errorCount');
        if (!errors || errors.length === 0) {
            list.innerHTML = `<div class="error-item empty"><i class="fas fa-check-circle"></i><span>Ошибок нет, система работает стабильно</span></div>`;
            cnt.textContent = '0';
            return;
        }
        cnt.textContent = errors.length;
        let html = '';
        errors.slice(0, 5).forEach(e => {
            html += `<div class="error-item"><div class="error-icon"><i class="fas fa-exclamation-circle"></i></div><div class="error-content"><div class="error-time">${e.time}</div><div class="error-message">${e.msg}</div></div></div>`;
        });
        if (errors.length > 5) {
            html += `<div class="error-item more"><span>... и еще ${errors.length - 5} ошибок</span></div>`;
        }
        list.innerHTML = html;
    }

    checkNotifications(d) {
        if (d.moisture < 20) this.notifications.show(`⚠️ Низкая влажность: ${d.moisture}%`, 'warning');
        if (d.moisture === 0) this.notifications.show('❌ Ошибка датчика влажности!', 'error');
        if (d.pump) this.notifications.show('💧 Насос работает...', 'info');
    }

    isTimeInRange(now, startStr, endStr) {
        const [sh, sm] = startStr.split(':').map(Number);
        const [eh, em] = endStr.split(':').map(Number);
        const s = sh * 60 + sm;
        const e = eh * 60 + em;
        const c = now.getHours() * 60 + now.getMinutes();
        if (s <= e) return c >= s && c < e;
        else return c >= s || c < e;
    }

    initMobileNavigation() {
        if (window.innerWidth > 768) return;
        const navBtns = document.querySelectorAll('.bottom-nav .nav-item[data-screen]');
        const rows = document.querySelectorAll('.dashboard-row');
        if (navBtns.length && rows.length) {
            const activateSection = (sectionId) => {
                rows.forEach(row => row.classList.remove('active'));
                const targetRow = document.getElementById(`row-${sectionId}`);
                if (targetRow) targetRow.classList.add('active');
                navBtns.forEach(btn => btn.classList.remove('active'));
                const activeBtn = document.querySelector(`.nav-item[data-screen="${sectionId}"]`);
                if (activeBtn) activeBtn.classList.add('active');
            };
            navBtns.forEach(btn => {
                btn.addEventListener('click', () => activateSection(btn.dataset.screen));
            });
            if (rows.length) rows[0].classList.add('active');
        }
    }

    setupEventListeners() {
        document.getElementById('connectBtn')?.addEventListener('click', () => {
            const ip = document.getElementById('espIp')?.value;
            if (ip) {
                this.state.espIp = ip;
                this.connectToESP();
            }
        });

        document.getElementById('demoModeBtn')?.addEventListener('click', () => {
            this.enableDemoMode();
        });

        document.getElementById('themeToggle')?.addEventListener('click', () => this.theme.toggle());

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const th = btn.dataset.theme;
                if (th) this.theme.setTheme(th);
                this.notifications.show('✅ Тема изменена', 'success');
            });
        });

        document.getElementById('waterNowBtn')?.addEventListener('click', async () => {
            const duration = parseInt(document.getElementById('wateringDuration').value, 10);
            try {
                await this.api.updateSettings(this.state.espIp, { manual_pump_time: duration });
                await this.api.controlPump(this.state.espIp, 'on');
                this.notifications.show(`💧 Ручной полив на ${duration} сек запущен`, 'success');
                setTimeout(() => this.updateData(), 1000);
            } catch {
                this.notifications.show('❌ Ошибка запуска полива', 'error');
            }
        });

        document.getElementById('pumpOffBtn')?.addEventListener('click', async () => {
            try {
                await this.api.controlPump(this.state.espIp, 'off');
                this.notifications.show('✅ Насос выключен', 'success');
                await this.updateData();
            } catch {
                this.notifications.show('❌ Ошибка выключения насоса', 'error');
            }
        });

        document.getElementById('lightOnBtn')?.addEventListener('click', async () => {
            try {
                await this.api.controlLight(this.state.espIp, 'on');
                this.notifications.show('💡 Свет включен', 'success');
                await this.updateData();
            } catch {
                this.notifications.show('❌ Ошибка включения света', 'error');
            }
        });

        document.getElementById('lightOffBtn')?.addEventListener('click', async () => {
            try {
                await this.api.controlLight(this.state.espIp, 'off');
                this.notifications.show('✅ Свет выключен', 'success');
                await this.updateData();
            } catch {
                this.notifications.show('❌ Ошибка выключения света', 'error');
            }
        });

        document.getElementById('syncTimeBtn')?.addEventListener('click', async () => {
            try {
                await this.api.syncTime(this.state.espIp);
                this.notifications.show('🕐 Время синхронизировано', 'success');
                await this.updateData();
            } catch {
                this.notifications.show('❌ Ошибка синхронизации времени', 'error');
            }
        });

        document.getElementById('setTimeManuallyBtn')?.addEventListener('click', async () => {
            const hours = parseInt(document.getElementById('manualHours').value, 10);
            const minutes = parseInt(document.getElementById('manualMinutes').value, 10);
            if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                this.notifications.show('❌ Введите корректное время (0-23 ч, 0-59 мин)', 'error');
                return;
            }
            try {
                await this.api.setTime(this.state.espIp, hours, minutes);
                this.notifications.show(`🕐 Время установлено: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`, 'success');
                await this.updateData();
            } catch {
                this.notifications.show('❌ Ошибка установки времени', 'error');
            }
        });

        document.getElementById('clearErrorsBtn')?.addEventListener('click', async () => {
            try {
                await this.api.clearErrors(this.state.espIp);
                this.notifications.show('✅ Ошибки очищены', 'success');
                await this.updateData();
            } catch {
                this.notifications.show('❌ Ошибка очистки ошибок', 'error');
            }
        });

        const thSlider = document.getElementById('moistureThreshold');
        if (thSlider) {
            thSlider.addEventListener('input', (e) => {
                document.getElementById('thresholdValue').textContent = e.target.value + '%';
                document.getElementById('thresholdValueDisplay').textContent = e.target.value + '%';
            });
            thSlider.addEventListener('change', async (e) => {
                try {
                    await this.api.updateSettings(this.state.espIp, { moisture_threshold: parseInt(e.target.value) });
                    this.notifications.show('✅ Порог влажности обновлен', 'success');
                } catch {
                    this.notifications.show('❌ Ошибка обновления порога', 'error');
                }
            });
        }

        document.getElementById('wateringDelay')?.addEventListener('change', async (e) => {
            try {
                await this.api.updateSettings(this.state.espIp, { watering_delay: parseInt(e.target.value) });
                this.notifications.show('✅ Задержка полива обновлена', 'success');
            } catch {
                this.notifications.show('❌ Ошибка обновления', 'error');
            }
        });

        document.getElementById('wateringDuration')?.addEventListener('change', async (e) => {
            const val = parseInt(e.target.value);
            try {
                await this.api.updateSettings(this.state.espIp, {
                    watering_duration: val,
                    manual_pump_time: val
                });
                this.notifications.show('✅ Длительность полива обновлена', 'success');
            } catch {
                this.notifications.show('❌ Ошибка обновления', 'error');
            }
        });

        document.getElementById('lightOnTime')?.addEventListener('change', async (e) => {
            try {
                await this.api.updateSettings(this.state.espIp, { lamp_start: e.target.value });
                this.notifications.show('✅ Время включения света обновлено', 'success');
            } catch {
                this.notifications.show('❌ Ошибка обновления', 'error');
            }
        });

        document.getElementById('lightOffTime')?.addEventListener('change', async (e) => {
            try {
                await this.api.updateSettings(this.state.espIp, { lamp_end: e.target.value });
                this.notifications.show('✅ Время выключения света обновлено', 'success');
            } catch {
                this.notifications.show('❌ Ошибка обновления', 'error');
            }
        });

        document.getElementById('lightScheduleToggle')?.addEventListener('change', async (e) => {
            try {
                await this.api.updateSettings(this.state.espIp, { lamp_enabled: e.target.checked });
                this.notifications.show(e.target.checked ? '✅ Расписание света включено' : '✅ Расписание света выключено', 'success');
            } catch {
                this.notifications.show('❌ Ошибка обновления', 'error');
            }
        });

        document.getElementById('sleepStartTime')?.addEventListener('change', async (e) => {
            try {
                await this.api.updateSettings(this.state.espIp, { sleep_start: e.target.value });
                this.notifications.show('✅ Время начала сна обновлено', 'success');
            } catch {
                this.notifications.show('❌ Ошибка обновления', 'error');
            }
        });

        document.getElementById('sleepEndTime')?.addEventListener('change', async (e) => {
            try {
                await this.api.updateSettings(this.state.espIp, { sleep_end: e.target.value });
                this.notifications.show('✅ Время окончания сна обновлено', 'success');
            } catch {
                this.notifications.show('❌ Ошибка обновления', 'error');
            }
        });

        document.getElementById('sleepModeToggle')?.addEventListener('change', async (e) => {
            try {
                await this.api.updateSettings(this.state.espIp, { sleep_enabled: e.target.checked });
                this.notifications.show(e.target.checked ? '✅ Режим сна включен' : '✅ Режим сна выключен', 'success');
            } catch {
                this.notifications.show('❌ Ошибка обновления', 'error');
            }
        });

        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            document.getElementById('settingsModal')?.classList.add('active');
        });

        document.getElementById('closeConnectionModal')?.addEventListener('click', () => {
            document.getElementById('connectionModal')?.classList.remove('active');
        });

        document.getElementById('closeSettingsModal')?.addEventListener('click', () => {
            document.getElementById('settingsModal')?.classList.remove('active');
        });

        document.getElementById('closeGuideModal')?.addEventListener('click', () => {
            document.getElementById('guideModal')?.classList.remove('active');
        });

        document.getElementById('quickGuideBtn')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('guideModal')?.classList.add('active');
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.remove('active');
            });
        });

        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const hours = parseInt(e.target.dataset.hours);
                this.charts.setTimeRange(hours);
            });
        });

        document.getElementById('resetStatsBtn')?.addEventListener('click', () => {
            Swal.fire({
                title: 'Сбросить статистику?',
                text: 'Вся статистика будет обнулена',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#00ff9d',
                cancelButtonColor: '#ff4757',
                confirmButtonText: 'Да, сбросить',
                cancelButtonText: 'Отмена'
            }).then((result) => {
                if (result.isConfirmed) {
                    // Здесь можно вызвать API для сброса статистики
                    this.notifications.show('📊 Статистика сброшена', 'success');
                }
            });
        });

        // Обработчик изменения интервала обновления
        const updateIntervalInput = document.getElementById('updateInterval');
        if (updateIntervalInput) {
            updateIntervalInput.addEventListener('change', (e) => {
                let val = parseInt(e.target.value, 10);
                if (isNaN(val) || val < 2) val = 2;
                if (val > 60) val = 60;
                e.target.value = val;
                this.updateInterval = val * 1000;
                this.restartUpdateLoop();
                this.notifications.show(`⏱ Интервал обновления установлен ${val} сек`, 'info');
            });
        }

        // Обработчик звука
        const soundToggle = document.getElementById('soundToggle');
        if (soundToggle) {
            soundToggle.addEventListener('change', (e) => {
                localStorage.setItem('notifications_sound', e.target.checked ? 'true' : 'false');
            });
            // загрузить сохранённое значение
            const savedSound = localStorage.getItem('notifications_sound');
            if (savedSound !== null) {
                soundToggle.checked = savedSound === 'true';
            }
        }
    }

    restartUpdateLoop() {
        if (this.updateTimer) clearInterval(this.updateTimer);
        this.updateTimer = setInterval(() => {
            if (this.state.connected) this.updateData();
        }, this.updateInterval);
    }

    startUpdateLoop() {
        this.restartUpdateLoop();
        setInterval(() => {
            this.updateCurrentTime();
        }, 60000);
    }

    updateCurrentTime() {
        const now = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const el = document.querySelector('#currentTime span');
        if (el) el.textContent = now;
    }
}

class MockEcoGrowAPI {
    constructor() {
        this.mockState = {
            moisture: 45,
            moisture_threshold: 50,
            watering_delay: 30,
            watering_duration: 10,
            manual_pump_time: 10,
            pump: false,
            light: false,
            lamp_start: '08:00',
            lamp_end: '20:00',
            lamp_enabled: true,
            sleep_start: '23:00',
            sleep_end: '07:00',
            sleep_enabled: false,
            avg_moisture: 48,
            min_moisture: 30,
            max_moisture: 65,
            total_waterings: 128,
            total_light_hours: 245,
            total_energy: 12250,
            current_time: '12:30',
            errors: []
        };
        this.demoInterval = setInterval(() => this.randomize(), 15000);
    }

    randomize() {
        this.mockState.moisture = Math.floor(Math.random() * 40 + 30);
        this.mockState.pump = Math.random() > 0.8;
        this.mockState.light = Math.random() > 0.6;
        this.mockState.avg_moisture = Math.floor(Math.random() * 20 + 40);
        this.mockState.min_moisture = Math.floor(Math.random() * 20 + 25);
        this.mockState.max_moisture = Math.floor(Math.random() * 20 + 55);
        this.mockState.total_waterings += Math.floor(Math.random() * 3);
        if (Math.random() > 0.9) {
            this.mockState.errors = [{
                time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                msg: 'Демо: симулированная ошибка'
            }];
        } else {
            this.mockState.errors = [];
        }
    }

    async getInfo(ip) {
        return { version: '4.5.2', ip: 'demo', hostname: 'demo.local', uptime: 12345 };
    }

    async getState(ip) {
        return this.mockState;
    }

    async controlPump(ip, action) {
        if (action === 'on') this.mockState.pump = true;
        if (action === 'off') this.mockState.pump = false;
        return { status: 'ok' };
    }

    async controlLight(ip, action) {
        if (action === 'on') this.mockState.light = true;
        if (action === 'off') this.mockState.light = false;
        return { status: 'ok' };
    }

    async updateSettings(ip, settings) {
        Object.assign(this.mockState, settings);
        return { status: 'ok' };
    }

    async setTime(ip, hours, minutes) {
        this.mockState.current_time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        return { status: 'ok' };
    }

    async syncTime(ip) {
        const now = new Date();
        this.mockState.current_time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        return { status: 'ok' };
    }

    async clearErrors(ip) {
        this.mockState.errors = [];
        return { status: 'ok' };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.ecoGrowApp = new EcoGrowApp();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log(err));
    });
}

document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        window.ecoGrowApp?.theme?.toggle();
    }
    if (e.key === 'F5') {
        e.preventDefault();
        window.ecoGrowApp?.updateData();
    }
});
