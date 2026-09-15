import '@ionic/core/css/ionic.bundle.css';
import { defineCustomElements } from '@ionic/core/loader';
import './index.css';
import { registerAppIcons } from './icons.js';
import { applyAccent, applyCrt, loadAccent, loadCrt } from './lib/theme.js';

async function bootstrap(): Promise<void> {
  await defineCustomElements(window);
  registerAppIcons();
  applyAccent(loadAccent());
  applyCrt(loadCrt());
  await import('./lock-in-app.js');
}

bootstrap();
