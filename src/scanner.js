import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat, GoogleBarcodeScannerModuleInstallState as S } from '@capacitor-mlkit/barcode-scanning';

export const isNative = Capacitor.isNativePlatform();

async function ensureModule() {
  const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
  if (available) return;
  await new Promise(async (res, rej) => {
    const h = await BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', (e) => {
      if (e.state === S.COMPLETED) { h.remove(); res(); }
      else if (e.state === S.FAILED || e.state === S.CANCELED) { h.remove(); rej(new Error('Installazione del modulo scanner non riuscita')); }
    });
    try { await BarcodeScanner.installGoogleBarcodeScannerModule(); } catch (e) { h.remove(); rej(e); }
  });
}

// Restituisce il codice letto, oppure null se l'utente annulla.
export async function scanBarcode() {
  if (!isNative) return null;
  await ensureModule();
  try {
    const { barcodes } = await BarcodeScanner.scan({
      formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE, BarcodeFormat.Code128],
    });
    return (barcodes[0] && barcodes[0].rawValue) || null;
  } catch (e) {
    if (/cancel/i.test(String(e && e.message))) return null;
    throw e;
  }
}
