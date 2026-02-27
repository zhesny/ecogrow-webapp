class ThemeManager {
    constructor() {
        this.currentTheme = 'dark';
        this.themes = {
            dark: {
                name: 'Тёмная',
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
            'light-blue': {
                name: 'Светлая',
                icon: 'fa-sun',
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
