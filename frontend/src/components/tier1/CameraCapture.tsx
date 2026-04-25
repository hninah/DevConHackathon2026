import { useRef, useState } from 'react';
import { Button } from '../ui/button';

type CameraCaptureProps = {
  onCapture: (b64: string) => void;
  hasCapture: boolean;
};

function resizeToBase64(blob: Blob, maxPx = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image failed to load')); };
    img.src = url;
  });
}

function CameraCapture({ onCapture, hasCapture }: CameraCaptureProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setStatus('Processing…');
    try {
      onCapture(await resizeToBase64(file));
      setStatus('Image attached');
    } catch {
      setStatus('Could not process image');
    }
  }

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setWebcamActive(true);
    } catch {
      setStatus('Camera access denied');
    }
  }

  async function captureFrame() {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    stopWebcam();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) return;
    setStatus('Processing…');
    try {
      onCapture(await resizeToBase64(blob));
      setStatus('Image attached');
    } catch {
      setStatus('Could not process image');
    }
  }

  function stopWebcam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setWebcamActive(false);
  }

  return (
    <section className="feature-card">
      <p className="feature-id">F1</p>
      <h3>Photo-of-Manual question</h3>
      <p>Snap or upload a confusing manual passage. Claude reads the image and answers in your language.</p>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      {!webcamActive && (
        <div className="camera-actions">
          <Button size="sm" variant="secondary" type="button" onClick={() => fileRef.current?.click()}>
            Upload photo
          </Button>
          <Button size="sm" variant="secondary" type="button" onClick={startWebcam}>
            Use camera
          </Button>
          {hasCapture && <span className="priority-chip">✓ Image attached</span>}
        </div>
      )}
      {webcamActive && (
        <div className="webcam-panel">
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxWidth: 320, borderRadius: 6 }} />
          <div className="camera-actions">
            <Button size="sm" type="button" onClick={captureFrame}>Capture</Button>
            <Button size="sm" variant="secondary" type="button" onClick={stopWebcam}>Cancel</Button>
          </div>
        </div>
      )}
      {status && <p className="field-hint">{status}</p>}
    </section>
  );
}

export default CameraCapture;
