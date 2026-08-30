/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: '#6A0DAD',
          purpleHover: '#500885',
        },
        background: 'var(--bg-background)',
        surface: 'var(--bg-surface)',
        'surface-elevated': 'var(--bg-surface-elevated)',
        'surface-muted': 'var(--bg-surface-muted)',
        border: 'var(--border-color)',
        'border-subtle': 'var(--border-subtle)',
        foreground: 'var(--text-foreground)',
        'foreground-muted': 'var(--text-muted)',
        'foreground-subtle': 'var(--text-subtle)',
      }
    },
  },
  plugins: [],
}

