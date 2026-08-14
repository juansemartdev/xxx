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

// Textos en español para el componente de AWS (viene en inglés por
// defecto). Se pasan vía el prop `displayText`, que Amplify documenta como
// la forma soportada de traducirlo (no hay locale automático). Se omiten a
// propósito las claves cuyo valor real puede ser dinámico (por ejemplo
// hintMatchIndicatorText, que interpola un porcentaje) para no arriesgar un
// tipo incorrecto — en esos casos queda el texto en inglés de Amplify.
const LIVENESS_DISPLAY_TEXT_ES = {
  errorLabelText: 'Error',
  connectionTimeoutHeaderText: 'Tiempo de conexión agotado',
  connectionTimeoutMessageText: 'Se agotó el tiempo de la conexión.',
  timeoutHeaderText: 'Tiempo agotado',
  timeoutMessageText: 'El rostro no llenó el óvalo a tiempo. Intenta de nuevo y llena completamente el óvalo con tu rostro.',
  faceDistanceHeaderText: 'Se detectó movimiento hacia adelante',
  faceDistanceMessageText: 'Evita acercarte mientras se conecta.',
  multipleFacesHeaderText: 'Se detectaron varios rostros',
  multipleFacesMessageText: 'Asegúrate de que solo haya un rostro frente a la cámara mientras se conecta.',
  clientHeaderText: 'Error del cliente',
  clientMessageText: 'La verificación falló por un problema del cliente.',
  serverHeaderText: 'Problema del servidor',
  serverMessageText: 'No se pudo completar la verificación por un problema del servidor.',
  landscapeHeaderText: 'Orientación horizontal no compatible',
  landscapeMessageText: 'Gira tu dispositivo a orientación vertical (retrato).',
  portraitMessageText: 'Mantén tu dispositivo en orientación vertical (retrato) durante toda la verificación.',
  tryAgainText: 'Intentar de nuevo',
  cameraMinSpecificationsHeadingText: 'La cámara no cumple los requisitos mínimos',
  cameraMinSpecificationsMessageText: 'La cámara debe admitir al menos resolución 320×240 y 15 cuadros por segundo.',
  cameraNotFoundHeadingText: 'No se puede acceder a la cámara.',
  cameraNotFoundMessageText:
    'Verifica que haya una cámara conectada y que ninguna otra aplicación la esté usando. Puede que debas dar permisos de cámara en la configuración y cerrar todas las instancias del navegador antes de reintentar.',
  a11yVideoLabelText: 'Cámara web para la verificación de vida',
  cancelLivenessCheckText: 'Cancelar verificación',
  goodFitCaptionText: 'Buen encuadre',
  goodFitAltText: "Ilustración del rostro de una persona encajando perfectamente dentro de un óvalo.",
  hintCenterFaceText: 'Centra tu rostro',
  hintCenterFaceInstructionText:
    'Antes de comenzar, asegúrate de que la cámara esté en la parte superior central de la pantalla y centra tu rostro frente a ella. Al iniciar la verificación aparecerá un óvalo en el centro: acércate hasta llenarlo y luego quédate quieto unos segundos.',
  hintFaceOffCenterText: 'El rostro no está dentro del óvalo, céntralo frente a la cámara.',
  hintMoveFaceFrontOfCameraText: 'Coloca tu rostro frente a la cámara',
  hintTooManyFacesText: 'Asegúrate de que solo haya un rostro frente a la cámara',
  hintFaceDetectedText: 'Rostro detectado',
  hintCanNotIdentifyText: 'Coloca tu rostro frente a la cámara',
  hintTooCloseText: 'Aléjate un poco',
  hintTooFarText: 'Acércate un poco',
  hintConnectingText: 'Conectando…',
  hintVerifyingText: 'Verificando…',
  hintCheckCompleteText: 'Verificación completa',
  hintIlluminationTooBrightText: 'Muévete a un área con menos luz',
  hintIlluminationTooDarkText: 'Muévete a un área con más luz',
  hintIlluminationNormalText: 'Condiciones de luz normales',
  hintHoldFaceForFreshnessText: 'Quédate quieto',
  photosensitivityWarningBodyText: 'Esta verificación destella colores. Ten precaución si eres fotosensible.',
  photosensitivityWarningHeadingText: 'Advertencia de fotosensibilidad',
  photosensitivityWarningInfoText:
    'Algunas personas pueden sufrir crisis epilépticas al exponerse a luces de colores. Ten precaución si tú o alguien de tu familia tiene una condición epiléptica.',
  photosensitivityWarningLabelText: 'Más información sobre fotosensibilidad',
  retryCameraPermissionsText: 'Reintentar',
  recordingIndicatorText: 'Rec',
  startScreenBeginCheckText: 'Iniciar verificación en video',
  tooFarCaptionText: 'Demasiado lejos',
  tooFarAltText: 'Ilustración del rostro de una persona dentro de un óvalo, con espacio entre el rostro y el borde del óvalo.',
  waitingCameraPermissionText: 'Esperando que aceptes el permiso de la cámara.',
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
        Preparando verificación biométrica…
      </div>
    );
  }
  if (error) {
    return <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>;
  }
  if (!sessionId) return null;

  const region = process.env.NEXT_PUBLIC_AWS_REGION || '';

  return (
    <div className="w-full overflow-hidden rounded-3xl">
      <FaceLivenessDetectorCore
        sessionId={sessionId}
        region={region}
        onAnalysisComplete={handleAnalysisComplete}
        onError={(e) => setError(e?.error?.message || 'Error en la verificación biométrica.')}
        onUserCancel={onCancel}
        config={{credentialProvider}}
        displayText={LIVENESS_DISPLAY_TEXT_ES}
      />
    </div>
  );
}
