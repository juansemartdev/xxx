'use client';
import '@aws-amplify/ui-react-liveness/styles.css';
import {useCallback, useEffect, useState} from 'react';
import {FaceLivenessDetectorCore} from '@aws-amplify/ui-react-liveness';
import type {AwsCredentials} from '@aws-amplify/ui-react-liveness';

export type LivenessResult = {
  isLive: boolean;
  confidence: number;
  referenceImageBase64: string | null;
};

type Props = {
  onComplete: (result: LivenessResult) => void;
  onCancel?: () => void;
};

// Componente reutilizable de prueba de vida (Face Liveness, AWS
// Rekognition). Lo usan tanto el login del profesional como la
// verificación de identidad del paciente. El flujo:
// 1) pide un sessionId a nuestro backend (CreateFaceLivenessSession)
// 2) el propio componente transmite el video directo a Rekognition, usando
//    credenciales temporales de 15 min que también pide a nuestro backend
// 3) al terminar, nuestro backend consulta el resultado autoritativo
//    (GetFaceLivenessSessionResults) — nunca confiamos solo en el cliente.
export default function LivenessCheck({onComplete, onCancel}: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/liveness/create-session', {method: 'POST'});
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'No se pudo iniciar la verificación.');
        setSessionId(json.sessionId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo iniciar la verificación biométrica.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const credentialProvider = useCallback(async (): Promise<AwsCredentials> => {
    const res = await fetch('/api/liveness/credentials', {method: 'POST'});
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudieron obtener credenciales temporales.');
    return {
      accessKeyId: json.accessKeyId,
      secretAccessKey: json.secretAccessKey,
      sessionToken: json.sessionToken,
    };
  }, []);

  const handleAnalysisComplete = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch('/api/liveness/result', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sessionId}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo obtener el resultado.');
      onComplete({
        isLive: !!json.isLive,
        confidence: json.confidence ?? 0,
        referenceImageBase64: json.referenceImageBase64 ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo verificar la prueba de vida.');
    }
  }, [sessionId, onComplete]);

  if (loading) return <p className="sub">Preparando verificación biométrica…</p>;
  if (error) return <p className="text-sm text-red-700 bg-red-50 rounded-md p-2">{error}</p>;
  if (!sessionId) return null;

  const region = process.env.NEXT_PUBLIC_AWS_REGION || '';

  return (
    <div className="rounded-2xl overflow-hidden" style={{minHeight: 400}}>
      <FaceLivenessDetectorCore
        sessionId={sessionId}
        region={region}
        onAnalysisComplete={handleAnalysisComplete}
        onError={(e) => setError(e?.error?.message || 'Error en la verificación biométrica.')}
        onUserCancel={onCancel}
        config={{credentialProvider}}
      />
    </div>
  );
}
