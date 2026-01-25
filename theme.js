class ThemeManager {
    constructor() {
        this.currentTheme = 'dark';
        this.themes = {
            dark: {
                name: 'Темная',
                icon: 'fa-moon',
                colors: {
                    '--primary-dark': '#0a192f',
                    '--secondary-dark': '#112240',
                    '--tertiary-dark': '#1e3a5f',
                    '--card-dark': '#172a45',
                    '--text-primary': '#e6f1ff',
                    '--text-secondary': '#a8b2d1'
                }
            },
            light: {
                name: 'Светлая',
                icon: 'fa-sun',
                colors: {
                    '--primary-dark': '#f8fafc',
                    '--secondary-dark': '#f1f5f9',
                    '--tertiary-dark': '#e2e8f0',
                    '--card-dark': '#ffffff',
                    '--text-primary': '#1e293b',
                    '--text-secondary': '#475569'
                }
            },
            green: {
                name: 'Зеленая',
                icon: 'fa-leaf',
                colors: {
                    '--primary-dark': '#0f2c1a',
                    '--secondary-dark': '#1a3d29',
                    '--tertiary-dark': '#2a5740',
                    '--card-dark': '#1e3a2e',
                    '--text-primary': '#e8f5e9',
                    '--text-secondary': '#c8e6c9'
                }
            },
            purple: {
                name: 'Фиолетовая',
                icon: 'fa-magic',
                colors: {
                    '--primary-dark': '#1a103f',
                    '--secondary-dark': '#2a1b5f',
                    '--tertiary-dark': '#3d2a7f',
                    '--card-dark': '#2a1b5f',
                    '--text-primary': '#f3e5f5',
                    '--text-secondary': '#e1bee7'
                }
            }
        };
    }
    
    init() {
        // Load saved theme
        const savedTheme = localStorage.getItem('ecogrow_theme') || 'dark';
        this.setTheme(savedTheme);
        
        // Initialize theme toggle button
        this.initToggleButton();
    }
    
    setTheme(themeName) {
        if (!this.themes[themeName]) return;
        
        this.currentTheme = themeName;
        document.documentElement.setAttribute('data-theme', themeName);
        
        // Apply custom colors
        const theme = this.themes[themeName];
        Object.entries(theme.colors).forEach(([property, value]) => {
            document.documentElement.style.setProperty(property, value);
        });
        
        // Save to localStorage
        localStorage.setItem('ecogrow_theme', themeName);
        
        // Update toggle button
        this.updateToggleButton();
        
        // Dispatch theme change event
        window.dispatchEvent(new CustomEvent('themechange', { 
            detail: { theme: themeName } 
        }));
    }
    
    toggle() {
        const themeKeys = Object.keys(this.themes);
        const currentIndex = themeKeys.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themeKeys.length;
        this.setTheme(themeKeys[nextIndex]);
    }
    
    initToggleButton() {
        const button = document.getElementById('themeToggle');
        if (!button) return;
        
        button.addEventListener('click', () => this.toggle());
        this.updateToggleButton();
    }
    
    updateToggleButton() {
        const button = document.getElementById('themeToggle');
        if (!button) return;
        
        const theme = this.themes[this.currentTheme];
        button.innerHTML = `
            <i class="fas ${theme.icon}"></i>
            <span>${theme.name}</span>
        `;
    }
    
    // Add smooth theme transition
    enableTransitions() {
        document.documentElement.style.transition = 
            'background-color 0.5s ease, color 0.5s ease';
    }
    
    disableTransitions() {
        document.documentElement.style.transition = 'none';
    }
}
