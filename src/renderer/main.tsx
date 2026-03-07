/**
 * BOFO - Personal Finance Manager
 * Main Entry Point
 */

import { h, render } from 'preact';
import { AppRoot } from './core/AppRoot';

import '@/assets/styles/global.css';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/outfit/300.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app') || document.body;

  root.innerHTML = '';

  const loader = document.getElementById('global-loader');
  if (loader) loader.remove();

  render(<AppRoot />, root);
});
