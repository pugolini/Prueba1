/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-deep': 'var(--bg-deep)',
        'surface-dim': 'var(--surface-dim)',
        'surface-low': 'var(--surface-low)',
        'surface-base': 'var(--surface-base)',
        'surface-high': 'var(--surface-high)',
        'surface-highest': 'var(--surface-highest)',
        'primary-tv': 'var(--primary-tv)',
        'success': 'var(--success)',
        'danger': 'var(--danger)',
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
      },
    },
  },
  plugins: [],
}
