import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

// The camera lifecycle logic from CheckInClient.tsx, extracted so a second
// QR-scanning surface (RedemptionScanner) doesn't have to re-learn the same
// two bugs that component's own comments document in detail: a stream
// started via getUserMedia() has to be tracked in a ref independent of the
// <video> element (mountedRef/streamRef), or a fast navigate-away either
// leaks the camera (unmount races the still-resolving getUserMedia
// promise) or silently no-ops the stop (videoRef.current already null by
// the time cleanup runs). CheckInClient itself is left with its own copy
// rather than refactored to use this — it's a carefully-debugged, working
// component already, not worth the risk of a subtle regression to
// deduplicate against a second, newer caller.
export function useQRScanner(onScan: (data: string) => void) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const streamRef = useRef<MediaStream | null>(null);
  const lastCodeRef = useRef('');
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animRef.current = requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code?.data && code.data !== lastCodeRef.current) {
      lastCodeRef.current = code.data;
      onScanRef.current(code.data);
    }
    animRef.current = requestAnimationFrame(scanFrame);
  }

  async function startCamera() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (videoRef.current) {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        requestAnimationFrame(scanFrame);
      } else {
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions and try again.');
    }
  }

  function stopCamera() {
    cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current?.srcObject) videoRef.current.srcObject = null;
    lastCodeRef.current = '';
    setScanning(false);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
     
  }, []);

  return { videoRef, canvasRef, scanning, error, startCamera, stopCamera };
}
