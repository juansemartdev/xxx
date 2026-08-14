'use client';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
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

  if (mode === 'register' || mode === 'authenticate') {
    // Sin Header aquí a propósito: el componente de cámara de AWS necesita
    // todo el alto disponible, y con el header fijo arriba parte de su
    // contenido quedaba tapado o forzaba scroll. Amplify ya trae su propio
    // botón de cancelar.
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-xl px-4 py-4">
          <LivenessCheck
            onComplete={mode === 'register' ? onRegisterComplete : onAuthenticateComplete}
            onCancel={() => setMode('idle')}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50">
      <main className="mx-auto w-full max-w-xl px-4 py-8">
        <div className="text-center pb-8">
          <img src="/logo-wordmark.png" alt="Probattio" className="mx-auto h-10 w-auto" />
          <p className="mt-4 text-sm text-slate-500">
            Verificación biométrica con prueba de vida (Face Liveness) y comparación facial, provista por AWS
            Rekognition.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Usuario</span>
            <input
              className="min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="tu.usuario"
              autoComplete="username"
            />
          </label>

          {error && <p className="mt-3 rounded-xl bg-red-50 p-2 text-sm text-red-700">{error}</p>}
          {msg && <p className="mt-3 rounded-xl bg-green-50 p-2 text-sm text-green-700">{msg}</p>}
        </div>

        <div className="mt-6 space-y-3">
          <button
            className="min-h-12 w-full rounded-xl bg-blue-700 px-5 font-semibold text-white shadow-sm disabled:opacity-40 active:scale-[0.98]"
            onClick={startAuthenticate}
            disabled={busy}
          >
            Entrar con biometría
          </button>
          <button
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 disabled:opacity-40 active:scale-[0.98]"
            onClick={startRegister}
            disabled={busy}
          >
            Registrar biométrico (primera vez)
          </button>
        </div>
      </main>
    </div>
  );
}
