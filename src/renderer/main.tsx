/**
 * BOFO - Personal Finance Manager
 * Main Entry Point
 */

import { h, render } from 'preact';
import { AppRoot } from './core/AppRoot';

// Global Styles
import '@/assets/styles/global.css';

// Offline Fonts
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/outfit/300.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
// We keep the legacy imports inside AppRoot for now

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app') || document.body;

  // Clear any existing content (like loading spinners static HTML)
  root.innerHTML = '';

  // Remove global loader overlay
  const loader = document.getElementById('global-loader');
  if (loader) loader.remove();

  // Mount Preact
  render(<AppRoot />, root);
});