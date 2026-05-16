import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

/**
 * Abre URL externa.
 * - Capacitor (Android/iOS): Custom Tab in-app, sin salir de la app.
 * - Web: nueva pestaña con noopener/noreferrer.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({
      url,
      windowName: '_self',
      presentationStyle: 'fullscreen',
    });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
