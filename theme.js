class ThemeManager {
    constructor() {
        this.currentTheme = 'dark';
        this.themes = {
            dark: {
                name: 'Темная синяя',
                icon: 'fa-moon',
                colors: {
                    '--bg-primary': '#0a192f',
                    '--bg-secondary': '#112240',
                    '--bg-tertiary': '#1e3a5f',
                    '--bg-card': '#172a45',
                    '--text-primary': '#e6f1ff',
                    '--text-secondary': '#a8b2d1',
                    '--accent-green': '#64ffda',
                    '--accent-blue': '#00d9ff'
                }
            },
            'dark-green': {
                name: 'Темная зеленая',
                icon: 'fa-leaf',
                colors: {
                    '--bg-primary': '#0f2c1a',
                    '--bg-secondary': '#1a3d29',
                    '--bg-tertiary': '#2a5740',
                    '--bg-card': '#1e3a2e',
                    '--text-primary': '#e8f5e9',
                    '--text-secondary': '#c8e6c9',
                    '--accent-green': '#69f0ae',
                    '--accent-blue': '#4fc3f7'
                }
            },
            'dark-purple': {
                name: 'Темная фиолетовая',
                icon: 'fa-magic',
                colors: {
                    '--bg-primary': '#1a103f',
                    '--bg-secondary': '#2a1b5f',
                    '--bg-tertiary': '#3d2a7f',
                    '--bg-card': '#2a1b5f',
                    '--text-primary': '#f3e5f5',
                    '--text-secondary': '#e1bee7',
                    '--accent-green': '#b388ff',
                    '--accent-blue': '#80cbc4'
                }
            },
            light: {
                name: 'Светлая',
                icon: 'fa-sun',
                colors: {
                    '--bg-primary': '#f8fafc',
                    '--bg-secondary': '#f1f5f9',
                    '--bg-tertiary': '#e2e8f0',
                    '--bg-card': '#ffffff',
                    '--text-primary': '#1e293b',
                    '--text-secondary': '#475569',
                    '--accent-green': '#2e7d32',
                    '--accent-blue': '#1976d2'
                }
            },
            'light-blue': {
                name: 'Светлая голубая',
                icon: 'fa-water',
                colors: {
                    '--bg-primary': '#f0f9ff',
                    '--bg-secondary': '#e6f3ff',
                    '--bg-tertiary': '#b8e1ff',
                    '--bg-card': '#ffffff',
                    '--text-primary': '#0c4a6e',
                    '--text-secondary': '#0369a1',
                    '--accent-green': '#0284c7',
                    '--accent-blue': '#38bdf8'
                }
            },
            'light-green': {
                name: 'Светлая зеленая',
                icon: 'fa-seedling',
                colors: {
                    '--bg-primary': '#f1f8e9',
                    '--bg-secondary': '#dcedc8',
                    '--bg-tertiary': '#c5e1a5',
                    '--bg-card': '#ffffff',
                    '--text-primary': '#1e3a2e',
                    '--text-secondary': '#2e7d32',
                    '--accent-green': '#388e3c',
                    '--accent-blue': '#66bb6a'
                }
            }
        };
    }

    init() {
        const saved = localStorage.getItem('ecogrow_theme') || 'dark';
        this.setTheme(saved);
        this.initToggleButton();
    }

    setTheme(themeName) {
        if (!this.themes[themeName]) return;
        this.currentTheme = themeName;
        document.documentElement.setAttribute('data-theme', themeName);
        const theme = this.themes[themeName];
        Object.entries(theme.colors).forEach(([prop, val]) => {
            document.documentElement.style.setProperty(prop, val);
        });
        localStorage.setItem('ecogrow_theme', themeName);
        this.updateToggleButton();
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: themeName } }));
    }

    toggle() {
        const keys = Object.keys(this.themes);
        const currentIndex = keys.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % keys.length;
        this.setTheme(keys[nextIndex]);
    }

    initToggleButton() {
        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.addEventListener('click', () => this.toggle());
            this.updateToggleButton();
        }
    }

    updateToggleButton() {
        const btn = document.getElementById('themeToggle');
        if (btn) {
            const theme = this.themes[this.currentTheme];
            btn.innerHTML = `<i class="fas ${theme.icon}"></i><span>${theme.name}</span>`;
        }
    }
}