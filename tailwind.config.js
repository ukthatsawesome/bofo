/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/**/*.{html,js,ts,jsx,tsx}",
    "./src/renderer/index.html"
  ],
  darkMode: ['class', '[data-theme="dark"]'],

  theme: {
    extend: {
      // ==================== COLORS ====================
      colors: {
        // Base UI (Shadcn/UI Style - HSL based)
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },

        // Brand Colors (RGB based)
        brand: {
          primary: 'rgb(var(--brand-primary) / <alpha-value>)',
          'primary-light': 'rgb(var(--brand-primary-light) / <alpha-value>)',
          secondary: 'rgb(var(--brand-secondary) / <alpha-value>)',
        },

        // Semantic Colors (RGB based)
        success: 'rgb(var(--success) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)',

        // Surface Colors (RGB based)
        surface: {
          base: 'rgb(var(--bg-base) / <alpha-value>)',
          panel: 'rgb(var(--bg-panel) / <alpha-value>)',
          card: 'rgb(var(--bg-card) / <alpha-value>)',
          elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
          input: 'rgb(var(--bg-input) / <alpha-value>)',
          'input-hover': 'rgb(var(--bg-input-hover) / <alpha-value>)',
          active: 'rgb(var(--bg-active) / <alpha-value>)',
          hover: 'rgb(var(--bg-hover) / <alpha-value>)',
        },

        // Text Colors (RGB based)
        text: {
          primary: 'rgb(var(--text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--text-muted) / <alpha-value>)',
          inverse: 'rgb(var(--text-inverse) / <alpha-value>)',
        },

        // Legacy
        borderColor: {
          DEFAULT: 'var(--border)',
        },
      },

      // ==================== TYPOGRAPHY ====================
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },

      // ==================== SPACING & BORDERS ====================
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      borderRadius: {
        'xs': 'var(--radius-xs)',
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
      },

      // ==================== EFFECTS ====================
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

      // ==================== ANIMATIONS ====================
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
    },
  },
  plugins: [],

  // ==================== SAFELIST ====================
  // Explicitly whitelist classes that are not detected by static analysis
  // or generated dynamically via JavaScript.
  safelist: [
    // --- UI Components ---
    'btn-primary', 'btn-secondary', 'btn-danger', 'btn-text', 'btn-sm',
    'card-glass', 'card-panel', 'clickable-card',
    'stat-card',
    'input-field', 'select-field', 'form-control',
    'modal', 'modal-content', 'close',
    'data-table', 'action-btn',
    'badge', 'badge-success', 'badge-danger', 'badge-warning', 'badge-info',
    'type-pill',
    'progress-bar-container', 'progress-bar-fill',
    'loader-overlay', 'spinner',
    'toast-container', 'toast',

    // --- Utilities ---
    'hidden', 'truncate', 'spinning',
    'bg-brand-primary', // Not covered by the generic brand pattern below

    // --- Dynamic Patterns ---

    // Generates: bg-success, bg-danger, bg-warning, bg-info (and hover variants)
    {
      pattern: /bg-(success|danger|warning|info)/,
      variants: ['hover'],
    },

    // Generates: text-{color}, border-{color} for success, danger, warning, info, brand
    {
      pattern: /(text|border)-(success|danger|warning|info|brand)/,
    },
  ],
};