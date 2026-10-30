// WHAT: Connects Tailwind CSS and Autoprefixer to Next.js stylesheet processing.
// WHY: These are the only CSS build transforms used by the app.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
