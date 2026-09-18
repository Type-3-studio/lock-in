import '@ionic/core/css/ionic.bundle.css';
import { defineCustomElements } from '@ionic/core/loader';
import './index.css';
import { registerAppIcons } from './icons.js';
import { applyTheme, loadTheme } from './lib/theme.js';

async function bootstrap(): Promise<void> {
  await defineCustomElements(window);
  registerAppIcons();
  applyTheme(loadTheme());
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (loadTheme() === 'system') applyTheme('system');
    });
  await import('./lock-in-app.js');
}

bootstrap();
