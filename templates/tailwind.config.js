// Tailwind CSS 4 utilise une configuration minimale ; la majorité passe par le @import dans le CSS.
// Ce fichier est optionnel avec @tailwindcss/vite. Le garder sous le coude au cas où le bootstrap génère encore l'ancien format.

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
