import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, ImagePlus, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/**
 * Live QR reader used by the Holder "Scan QR" tab.
 *
 *  - camera path: `getUserMedia` + a requestAnimationFrame loop that feeds each
 *    frame to `jsQR` until a payload is decoded;
 *  - image path: an uploaded QR image (screenshot) decoded the same way — the
 *    honest fallback when no camera is available (headless / desktop).
 *
 * It calls `onDecoded` once with the decoded text and stops itself. It never
 * uploads anything — decoding happens entirely in the browser.
 */
export function QrScanner({
  onDecoded,
  onError,
}: {
  onDecoded: (text: string) => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'starting' | 'scanning'>('starting');
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const settledRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const settle = (text: string) => {
    if (settledRef.current) return;
    settledRef.current = true;
    stopCamera();
    onDecoded(text);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    let frameId: number | null = null;
    const video = videoRef.current;

    const startCamera = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraUnavailable(true);
        setState('starting');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setState('scanning');
      } catch {
        setCameraUnavailable(true);
        setState('starting');
      }
    };

    const loop = () => {
      if (settledRef.current || !video || !video.videoWidth) {
        frameId = requestAnimationFrame(loop);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(data.data, data.width, data.height, { inversionAttempts: 'dontInvert' });
          if (result?.data) {
            settle(result.data);
            return;
          }
        } catch {
          // Frame decode hiccup — keep scanning.
        }
      }
      frameId = requestAnimationFrame(loop);
    };

    if (!cameraUnavailable) void startCamera().then(() => loop());
    else setState('starting');

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraUnavailable]);

  const decodeImageFile = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(img.width * scale));
        canvas.height = Math.max(1, Math.floor(img.height * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Canvas unavailable in this browser.');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
        if (result?.data) {
          onDecoded(result.data);
          return;
        }
        onError('No QR code found in that image. Make sure the whole code is visible.');
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      onError('Could not read that image.');
    };
    img.src = url;
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'relative flex h-64 items-center justify-center overflow-hidden rounded-xl border border-white/8 bg-black/40',
          state === 'scanning' && 'border-cyan-400/30',
        )}
      >
        <video ref={videoRef} playsInline muted className={cn('h-full w-full object-cover', state !== 'scanning' && 'hidden')} />
        {state === 'starting' && !cameraUnavailable && (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-300" aria-hidden />
            <span className="text-xs">Starting camera…</span>
          </div>
        )}
        {cameraUnavailable && (
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <AlertTriangle className="h-6 w-6 text-amber-300" aria-hidden />
            <span className="text-xs text-slate-400">
              No camera available in this browser. Scan with a phone camera app and paste the text
              into the &ldquo;Paste credential package&rdquo; tab, or upload a QR screenshot below.
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-44 w-44 rounded-xl border-2 border-cyan-400/40" />
        </div>
      </div>

      {cameraUnavailable ? (
        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" aria-hidden />
            Upload QR image
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => decodeImageFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Camera className="h-3 w-3 shrink-0" aria-hidden />
          Point the camera at the issuer&apos;s screen. Decoding is done entirely in your browser.
        </p>
      )}
      {!cameraUnavailable && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500">
            No camera? <span className="cursor-pointer text-cyan-300 underline" onClick={() => fileRef.current?.click()}>upload a QR screenshot</span> instead.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={(e) => decodeImageFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}