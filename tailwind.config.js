/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{html,js,ts}",
    "./src/renderer/index.html"
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Brand Colors - Using CSS variables for theme consistency
        brand: {
          primary: 'var(--brand-primary)',
          'primary-light': 'var(--brand-primary-light)',
          secondary: 'var(--brand-secondary)',
        },
        // Semantic Colors
        success: 'var(--success)',
        danger: 'var(--danger)',
        warning: 'var(--warning)',
        info: 'var(--info)',
        // Surface Colors
        surface: {
          base: 'var(--bg-base)',
          panel: 'var(--bg-panel)',
          card: 'var(--bg-card)',
          elevated: 'var(--bg-elevated)',
          input: 'var(--bg-input)',
          'input-hover': 'var(--bg-input-hover)',
        },
        // Text Colors
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
          // Legacy support
          main: 'var(--text-primary)',
        },
        // Border Colors
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
          focus: 'var(--border-focus)',
        },
        accent: 'var(--brand-primary)',
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
      },
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
      },
      transitionTimingFunction: {
        'smooth': 'var(--ease-smooth)',
        'bounce': 'var(--ease-bounce)',
      },
      transitionDuration: {
        'fast': '150ms',
        'base': '250ms',
        'slow': '400ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s var(--ease-smooth)',
        'slide-up': 'slideUp 0.3s var(--ease-smooth)',
        'slide-down': 'slideDown 0.3s var(--ease-smooth)',
        'scale-in': 'scaleIn 0.2s var(--ease-smooth)',
        'pulse-soft': 'pulseSoft 2s infinite',
        'spin': 'spin 1s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        spin: {
          'to': { transform: 'rotate(360deg)' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
  safelist: [
    // Status colors
    'text-success', 'text-danger', 'text-warning', 'text-info', 'text-brand',
    'bg-success', 'bg-danger', 'bg-warning', 'bg-info', 'bg-brand-primary',
    // Button variants
    'btn-primary', 'btn-secondary', 'btn-danger', 'btn-text', 'btn-sm',
    // Card variants
    'card-glass', 'card-panel', 'clickable-card',
    // Stat card
    'stat-card',
    // Form elements
    'input-field', 'select-field', 'form-control',
    // Modal
    'modal', 'modal-content', 'close',
    // Tables
    'data-table', 'action-btn',
    // Badges
    'badge', 'badge-success', 'badge-danger', 'badge-warning', 'badge-info',
    'type-pill',
    // Progress
    'progress-bar-container', 'progress-bar-fill',
    // Loader
    'loader-overlay', 'spinner',
    // Toast
    'toast-container', 'toast',
    // Utilities
    'hidden', 'truncate', 'spinning',
    {
      pattern: /bg-(success|danger|warning|info)/,
      variants: ['hover'],
    },
    {
      pattern: /(text|border)-(success|danger|warning|info|brand)/,
    },
  ],
}
