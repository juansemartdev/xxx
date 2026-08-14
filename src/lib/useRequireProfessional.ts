'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {getSession} from './session';

// Manda a /login si todavía no hay un profesional autenticado en esta
// sesión (localStorage). Se usa en todas las pantallas del flujo de
// atención (registro de paciente, identificación, verificación, empaque,
// antes/después, cierre) para que nada de eso sea alcanzable sin login.
export function useRequireProfessional() {
  const r = useRouter();
  useEffect(() => {
    if (!getSession().professional) r.replace('/login');
  }, [r]);
}
