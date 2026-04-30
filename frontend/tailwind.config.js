/** @type {import('tailwindcss').Config} */
const THEME_COLORS = ['indigo', 'blue', 'sky', 'cyan', 'teal', 'emerald', 'green', 'lime', 'amber', 'orange', 'red', 'rose', 'pink', 'fuchsia', 'purple', 'violet', 'slate', 'gray', 'zinc'];

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800'];

const safelistColors = THEME_COLORS.flatMap(c =>
  SHADES.flatMap(s => [
    `bg-${c}-${s}`,
    `text-${c}-${s}`,
    `border-${c}-${s}`,
    `ring-${c}-${s}`,
    `hover:bg-${c}-${s}`,
    `hover:text-${c}-${s}`,
    `hover:border-${c}-${s}`,
    `focus:ring-${c}-${s}`,
    `focus:border-${c}-${s}`,
    `from-${c}-${s}`,
    `to-${c}-${s}`,
    `via-${c}-${s}`,
  ])
);

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: safelistColors,
  theme: {
    extend: {},
  },
  plugins: [],
};
