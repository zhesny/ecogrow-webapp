class ThemeManager {
    constructor() {
        this.currentTheme = 'dark-blue';
        this.themes = {
            'dark-blue': {
                name: 'Темно-синяя (основная)',
                icon: 'fa-moon',
                colors: {
                    '--bg-primary': '#0a192f',
                    '--bg-secondary': '#112240',
                    '--bg-tertiary': '#1a365d',
                    '--bg-card': '#172a45',
                    '--bg-input': '#2d3748',
                    '--accent-green': '#00ff9d',
                    '--accent-blue': '#00d9ff',
                    '--accent-purple': '#9d4edd',
                    '--accent-orange': '#ff9e00',
                    '--accent-red': '#ff4757',
                    '--text-primary': '#e2e8f0',
                    '--text-secondary': '#a0aec0',
                    '--text-muted': '#718096',
                    '--gradient-primary': 'linear-gradient(135deg, #00ff9d 0%, #00d9ff 100%)',
                    '--gradient-button': 'linear-gradient(135deg, #00ff9d 0%, #00d9ff 100%)',
                    '--shadow-glow': '0 0 20px rgba(0, 255, 157, 0.3)'
                }
            },
            'dark-green': {
                name: 'Темно-зеленая',
                icon: 'fa-leaf',
                colors: {
                    '--bg-primary': '#0a2f1a',
                    '--bg-secondary': '#1a4028',
                    '--bg-tertiary': '#2a5a3c',
                    '--bg-card': '#1a3a2a',
                    '--bg-input': '#2d4a3d',
                    '--accent-green': '#00ff88',
                    '--accent-blue': '#00ccaa',
                    '--accent-purple': '#7d4edd',
                    '--accent-orange': '#ffaa00',
                    '--accent-red': '#ff6666',
                    '--text-primary': '#e8f5e9',
                    '--text-secondary': '#a8d5a9',
                    '--text-muted': '#88b588',
                    '--gradient-primary': 'linear-gradient(135deg, #00ff88 0%, #00ccaa 100%)',
                    '--gradient-button': 'linear-gradient(135deg, #00ff88 0%, #00ccaa 100%)',
                    '--shadow-glow': '0 0 20px rgba(0, 255, 136, 0.3)'
                }
            },
            'dark-purple': {
                name: 'Темно-фиолетовая',
                icon: 'fa-magic',
                colors: {
                    '--bg-primary': '#1a0a2f',
                    '--bg-secondary': '#2a1a40',
                    '--bg-tertiary': '#3a2a5a',
                    '--bg-card': '#2a1a45',
                    '--bg-input': '#3d2d4a',
                    '--accent-green': '#b388ff',
                    '--accent-blue': '#9370db',
                    '--accent-purple': '#9d4edd',
                    '--accent-orange': '#ff9e00',
                    '--accent-red': '#ff6b6b',
                    '--text-primary': '#f3e5f5',
                    '--text-secondary': '#d1c4e9',
                    '--text-muted': '#b39ddb',
                    '--gradient-primary': 'linear-gradient(135deg, #b388ff 0%, #9370db 100%)',
                    '--gradient-button': 'linear-gradient(135deg, #b388ff 0%, #9370db 100%)',
                    '--shadow-glow': '0 0 20px rgba(179, 136, 255, 0.3)'
                }
            },
            'light-modern': {
                name: 'Светлая (современная)',
                icon: 'fa-sun',
                colors: {
                    '--bg-primary': '#f5f7fa',
                    '--bg-secondary': '#e4e7eb',
                    '--bg-tertiary': '#d1d9e6',
                    '--bg-card': '#ffffff',
                    '--bg-input': '#edf2f7',
                    '--accent-green': '#10b981',
                    '--accent-blue': '#3b82f6',
                    '--accent-purple': '#8b5cf6',
                    '--accent-orange': '#f59e0b',
                    '--accent-red': '#ef4444',
                    '--text-primary': '#1f2937',
                    '--text-secondary': '#4b5563',
                    '--text-muted': '#6b7280',
                    '--gradient-primary': 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                    '--gradient-button': 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                    '--shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.1)',
                    '--shadow-md': '0 4px 20px rgba(0, 0, 0, 0.1)',
                    '--shadow-lg': '0 10px 40px rgba(0, 0, 0, 0.1)',
                    '--shadow-glow': '0 0 20px rgba(16, 185, 129, 0.2)'
                }
            },
            'light-warm': {
                name: 'Светлая (теплая)',
                icon: 'fa-cloud-sun',
                colors: {
                    '--bg-primary': '#fdf6e3',
                    '--bg-secondary': '#f0e6cc',
                    '--bg-tertiary': '#e8ddb5',
                    '--bg-card': '#ffffff',
                    '--bg-input': '#f5ebd3',
                    '--accent-green': '#059669',
                    '--accent-blue': '#0891b2',
                    '--accent-purple': '#7c3aed',
                    '--accent-orange': '#d97706',
                    '--accent-red': '#dc2626',
                    '--text-primary': '#1c1917',
                    '--text-secondary': '#57534e',
                    '--text-muted': '#78716c',
                    '--gradient-primary': 'linear-gradient(135deg, #059669 0%, #0891b2 100%)',
                    '--gradient-button': 'linear-gradient(135deg, #059669 0%, #0891b2 100%)',
                    '--shadow-glow': '0 0 20px rgba(5, 150, 105, 0.2)'
                }
            },
            'light-blue': {
                name: 'Светло-голубая',
                icon: 'fa-cloud',
                colors: {
                    '--bg-primary': '#f0f9ff',
                    '--bg-secondary': '#e0f2fe',
                    '--bg-tertiary': '#bae6fd',
                    '--bg-card': '#ffffff',
                    '--bg-input': '#dbeafe',
                    '--accent-green': '#0d9488',
                    '--accent-blue': '#0284c7',
                    '--accent-purple': '#7c3aed',
                    '--accent-orange': '#ea580c',
                    '--accent-red': '#e11d48',
                    '--text-primary': '#0c4a6e',
                    '--text-secondary': '#0369a1',
                    '--text-muted
