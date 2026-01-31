/**
 * BOFO - Personal Finance Manager
 * Main Entry Point
 */
/**
 * BOFO - Personal Finance Manager
 * Main Entry Point
 */
import './tailwind-input.css';
import './styles/validation.css';
import './styles/transfer-preview.css';
import { App } from './core/app';
import { installLegacyPatches } from './legacy-patches';

let app: App;

document.addEventListener('DOMContentLoaded', async () => {
  app = new App();

  // Install legacy patches and globals
  installLegacyPatches(app);

  await app.init();
});
