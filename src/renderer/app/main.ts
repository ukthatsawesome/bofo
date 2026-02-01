/**
 * BOFO - Personal Finance Manager
 * Main Entry Point
 */

// Styles
import './styles/tailwind-input.css';
import './styles/validation.css';
import './styles/transfer-preview.css';

// Core
import { App } from './App';
import { installLegacyPatches } from './legacy-patches';

let app: App;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    app = new App();

    // Install legacy patches and globals
    installLegacyPatches(app);

    await app.init();
  } catch (error) {
    console.error('Failed to initialize application:', error);
  }
});