import { alertController } from '@ionic/core';

export interface ConfirmOptions {
  header: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}

/** Explicit confirmation gate for irreversible actions (locking, terminal status). */
export async function confirmAction(options: ConfirmOptions): Promise<boolean> {
  const alert = await alertController.create({
    header: options.header,
    message: options.message,
    buttons: [
      { text: options.cancelText ?? 'Cancel', role: 'cancel' },
      {
        text: options.confirmText ?? 'Confirm',
        role: 'confirm',
      },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  return role === 'confirm';
}

export async function showAlert(header: string, message?: string): Promise<void> {
  const alert = await alertController.create({
    header,
    message,
    buttons: [{ text: 'OK' }],
  });
  await alert.present();
  await alert.onDidDismiss();
}
