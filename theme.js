class ThemeManager {
    constructor() {
        this.currentTheme = 'dark-blue';
        this.themes = {
            'dark-blue': {
                name: 'Темно-синяя',
                icon: 'fa-moon',
                isDark: true
            },
            'light': {
                name: 'Светлая',
                icon: 'fa-sun',
                isDark: false
            },
            'green': {
                name: 'Зеленая',
                icon: 'fa-leaf',
                isDark: true
            },
            'purple': {
                name: 'Фиолетовая',
                icon: 'fa-magic',
                isDark: true
            },
            'orange': {
                name: 'Оранжевая',
                icon: 'fa-fire',
                isDark: true
            },
            'pink': {
                name: 'Розовая',
                icon: 'fa-heart',
                isDark: true
            },
            'light-green': {
                name: 'Светло-зеленая',
                icon: 'fa-spa',
                isDark: false
            },
            'light-blue': {
                name: 'Светло-голубая',
                icon: 'fa-cloud-sun',
                isDark: false
            }
        };
        
        this.init();
    }
    
    init() {
        // Load saved theme
        const savedTheme = localStorage.getItem('ecogrow_theme') || 'dark-blue';
        this.setTheme(savedTheme);
        
        // Initialize theme toggle button
        this.initToggleButton();
        this.initThemeButtons();
    }
    
    setTheme(themeName) {
        if (!this.themes[themeName]) {
            console.error(`Тема "${themeName}" не найдена`);
            themeName = 'dark-blue';
        }
        
        this.currentTheme = themeName;
        document.documentElement.setAttribute('data-theme', themeName);
        
        // Save to localStorage
        localStorage.setItem('ecogrow_theme', themeName);
        
        // Update toggle button
        this.updateToggleButton();
        
        // Update active theme buttons
        this.updateThemeButtons();
        
        // Dispatch theme change event
        window.dispatchEvent(new CustomEvent('themechange', { 
            detail: { theme: themeName } 
        }));
        
        console.log(`Тема изменена на: ${this.themes[themeName].name}`);
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
    
    initThemeButtons() {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.target.dataset.theme;
                this.setTheme(theme);
            });
        });
    }
    
    updateToggleButton() {
        const button = document.getElementById('themeToggle');
        if (!button) return;
        
        const theme = this.themes[this.currentTheme];
        const icon = theme.isDark ? 'fa-moon' : 'fa-sun';
        
        button.innerHTML = `<i class="fas ${icon}"></i>`;
        button.title = `Тема: ${theme.name}`;
    }
    
    updateThemeButtons() {
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.dataset.theme === this.currentTheme) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
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
