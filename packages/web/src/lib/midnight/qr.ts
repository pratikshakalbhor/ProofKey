/**
 * QR code for the safe credential-package mechanism.
 *
 * The QR encodes EXACTLY the same serialized credential package that backs
 * "Copy credential package" and paste-import — not a URL, not a reference, and
 * never a route that could host the private payload publicly. It is a
 * peer-to-peer, in-person transfer (camera sees the issuer's screen), which is
 * the same exposure as handing over the package directly. The UI must always
 * pair it with a privacy warning: never photograph it, post it online, or put
 * it on a public URL.
 */

import QRCode from 'qrcode';

export async function credentialQrDataUrl(packageJson: string, width = 640): Promise<string> {
  return QRCode.toDataURL(packageJson, {
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}

export function downloadQrImage(dataUrl: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}