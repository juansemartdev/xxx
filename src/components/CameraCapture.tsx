'use client';
import {useEffect,useRef,useState} from 'react';

export default function CameraCapture({onCapture}:{onCapture:(dataUrl:string)=>void}){
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream|null>(null);
  const [error,setError] = useState('');
  const [active,setActive] = useState(false);
  const [captured,setCaptured] = useState('');

  useEffect(()=>()=>stream.current?.getTracks().forEach(t=>t.stop()),[]);

  async function start(){
    setError('');
    try{
      stream.current = await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:'environment'},width:{ideal:1280}},
        audio:false
      });
      if(video.current){
        video.current.srcObject = stream.current;
        await video.current.play();
        setActive(true);
      }
    }catch(e){
      setError('No fue posible acceder a la cámara. Revisa los permisos del navegador.');
    }
  }

  function capture(){
    const v = video.current;
    if(!v || !v.videoWidth || !v.videoHeight){
      setError('La cámara todavía está cargando, espera un segundo e intenta de nuevo.');
      return;
    }
    setError('');
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext('2d');
    if(!ctx) return;
    ctx.drawImage(v,0,0);
    const dataUrl = c.toDataURL('image/jpeg',.9);
    setCaptured(dataUrl);
    onCapture(dataUrl);
    stream.current?.getTracks().forEach(t=>t.stop());
    setActive(false);
  }

  function retake(){
    setCaptured('');
    start();
  }

  return (
    <div className="space-y-3">
      <div className="preview relative">
        <video ref={video} className="w-full h-full object-cover" playsInline muted style={{display: active ? 'block' : 'none'}}/>
        {captured && !active && <img src={captured} className="w-full h-full object-cover" alt="Foto capturada"/>}
        {!active && !captured && <span>Vista previa de cámara</span>}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!active && !captured && <button className="btn secondary" onClick={start}>Activar cámara</button>}
      {active && <button className="btn primary" onClick={capture}>Tomar fotografía</button>}
      {captured && <button className="btn secondary" onClick={retake}>Retomar foto</button>}
    </div>
  );
}
