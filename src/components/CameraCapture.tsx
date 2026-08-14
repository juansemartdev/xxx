'use client';
import {useEffect, useRef, useState} from 'react';

type Props = {
  onCapture: (dataUrl: string) => void;
  // Texto de guía sobre el recuadro de encuadre (qué debe verse en la
  // foto). Por defecto genérico; cada pantalla lo ajusta a su caso.
  guideText?: string;
  // Relación de aspecto del visor. 'retrato' para documentos/cédula,
  // 'ancho' para vial + báscula.
  aspect?: 'retrato' | 'ancho';
};

export default function CameraCapture({
  onCapture,
  guideText = 'Encuadra el objeto dentro del marco',
  aspect = 'ancho',
}: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [active, setActive] = useState(false);
  const [captured, setCaptured] = useState('');

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);

  async function start() {
    setError('');
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}},
        audio: false,
      });
      if (video.current) {
        video.current.srcObject = stream.current;
        await video.current.play();
        setActive(true);
      }
    } catch {
      setError('No fue posible acceder a la cámara. Revisa los permisos del navegador.');
    }
  }

  function capture() {
    const v = video.current;
    if (!v || !v.videoWidth || !v.videoHeight) {
      setError('La cámara todavía está cargando, espera un segundo e intenta de nuevo.');
      return;
    }
    setError('');
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.9);
    setCaptured(dataUrl);
    onCapture(dataUrl);
    stream.current?.getTracks().forEach((t) => t.stop());
    setActive(false);
  }

  function retake() {
    setCaptured('');
    start();
  }

  const aspectClass = aspect === 'retrato' ? 'aspect-[3/4]' : 'aspect-[4/3]';

  return (
    <div className="space-y-3">
      <div className={`relative overflow-hidden rounded-3xl bg-slate-950 ${aspectClass}`}>
        <video
          ref={video}
          className="h-full w-full object-cover"
          playsInline
          muted
          style={{display: active ? 'block' : 'none'}}
        />
        {captured && !active && <img src={captured} className="h-full w-full object-cover" alt="Foto capturada" />}
        {!active && !captured && (
          <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
            Vista previa de cámara
          </div>
        )}
        {active && (
          <>
            <div className="pointer-events-none absolute inset-5 rounded-2xl border-2 border-white/80" />
            <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl bg-black/60 p-3 text-center text-sm font-medium text-white">
              {guideText}
            </div>
          </>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      {!active && !captured && (
        <button
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 active:scale-[0.98]"
          onClick={start}
        >
          Activar cámara
        </button>
      )}
      {active && (
        <button
          className="min-h-12 w-full rounded-xl bg-emerald-700 px-5 font-semibold text-white shadow-sm active:scale-[0.98]"
          onClick={capture}
        >
          Tomar fotografía
        </button>
      )}
      {captured && (
        <button
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 active:scale-[0.98]"
          onClick={retake}
        >
          Retomar foto
        </button>
      )}
    </div>
  );
}
