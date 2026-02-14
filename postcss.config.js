/**
 * PostCSS Configuration
 *
 * Integrates CSS processing plugins for the build pipeline.
 * - tailwindcss: Processes utility classes and applies design tokens.
 * - autoprefixer: Automatically adds vendor prefixes (e.g., -webkit-, -ms-) for browser compatibility.
 */
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};