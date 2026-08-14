'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import Header from '@/components/Header';
import LivenessCheck, {type LivenessResult} from '@/components/LivenessCheck';
import {updateSession} from '@/lib/session';

type Mode = 'idle' | 'register' | 'authenticate';

export default function Login() {
  const r = useRouter();
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  function startRegister() {
    const u = username.trim();
    if (!u) {
      setError('Ingresa un usuario para registrar el biométrico.');
      return;
    }
    setError('');
    setMsg('');
    setMode('register');
  }

  function startAuthenticate() {
    const u = username.trim();
    if (!u) {
      setError('Ingresa tu usuario para entrar con biometría.');
      return;
    }
    setError('');
    setMsg('');
    setMode('authenticate');
  }

  async function onRegisterComplete(result: LivenessResult) {
    setMode('idle');
    if (!result.isLive || !result.referenceImageBase64) {
      setError('No se pudo confirmar que fueras una persona real frente a la cámara. Intenta de nuevo con buena luz.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/professional-biometric/enroll', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          username: username.trim(),
          referenceImageBase64: `data:image/jpeg;base64,${result.referenceImageBase64}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo registrar el biométrico.');
      setMsg('Biométrico registrado. Ya puedes entrar con "Entrar con biometría".');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el biométrico.');
    } finally {
      setBusy(false);
    }
  }

  async function onAuthenticateComplete(result: LivenessResult) {
    setMode('idle');
    if (!result.isLive || !result.referenceImageBase64) {
      setError('No se pudo confirmar que fueras una persona real frente a la cámara. Intenta de nuevo con buena luz.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/professional-biometric/verify', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          username: username.trim(),
          capturedImageBase64: `data:image/jpeg;base64,${result.referenceImageBase64}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo verificar el biométrico.');
      if (!json.matched) {
        setError('El rostro capturado no coincide con el biométrico registrado para este usuario.');
        return;
      }
      updateSession({professional: username.trim()});
      r.push('/session');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar con biometría.');
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'register') {
    return (
      <>
        <Header step="Acceso profesional" />
        <div className="content space-y-5">
          <div className="card">
            <div className="step">1 · Profesional</div>
            <h1 className="text-2xl font-bold mt-2">Registrar biométrico</h1>
            <p className="sub">Mira a la cámara y sigue las instrucciones en pantalla.</p>
          </div>
          <LivenessCheck onComplete={onRegisterComplete} onCancel={() => setMode('idle')} />
        </div>
      </>
    );
  }

  if (mode === 'authenticate') {
    return (
      <>
        <Header step="Acceso profesional" />
        <div className="content space-y-5">
          <div className="card">
            <div className="step">1 · Profesional</div>
            <h1 className="text-2xl font-bold mt-2">Verificando identidad</h1>
            <p className="sub">Mira a la cámara y sigue las instrucciones en pantalla.</p>
          </div>
          <LivenessCheck onComplete={onAuthenticateComplete} onCancel={() => setMode('idle')} />
        </div>
      </>
    );
  }

  return (
    <>
      <Header step="Acceso profesional" />
      <div className="content space-y-5">
        <div className="card">
          <div className="step">1 · Profesional</div>
          <h1 className="text-2xl font-bold mt-2">Entrar a ChainDose</h1>
          <p className="sub">
            Verificación biométrica con prueba de vida (Face Liveness) y comparación facial, provista
            por AWS Rekognition.
          </p>

          <label className="block mt-4">
            <span className="text-sm text-gray-600">Usuario</span>
            <input
              className="w-full rounded-xl border border-slate-200 p-3 mt-1"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tu.usuario"
              autoComplete="username"
            />
          </label>

          {error && <p className="text-sm text-red-700 bg-red-50 rounded-md p-2 mt-3">{error}</p>}
          {msg && <p className="text-sm text-green-700 bg-green-50 rounded-md p-2 mt-3">{msg}</p>}
        </div>

        <button className="btn primary disabled:opacity-40" onClick={startAuthenticate} disabled={busy}>
          Entrar con biometría
        </button>
        <button className="btn secondary disabled:opacity-40" onClick={startRegister} disabled={busy}>
          Registrar biométrico (primera vez)
        </button>
      </div>
    </>
  );
}
