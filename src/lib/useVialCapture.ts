'use client';
import {useState} from 'react';
import {scanDataMatrix} from './scanDataMatrix';
import {parseGS1} from './gs1';
import {readVialLabel} from './readLabel';
import {analyzeVialWeight} from './analyzeVial';

export type VialCaptureData = {
  product: string;
  gtin: string;
  lot: string;
  expiry: string;
};

// Lógica compartida entre las pantallas "Antes" y "Después": a partir de
// una foto (vial + display de báscula), resuelve los datos del vial y el
// peso, con la misma cadena de respaldo en ambas:
//   1. DataMatrix leído como GS1 (HRI o "plano" — ver src/lib/gs1.ts).
//   2. Si el DataMatrix no se pudo interpretar como GS1 en ningún
//      formato (o no se detectó ningún código), leer la etiqueta
//      impresa por OCR/visión como último recurso.
//   3. El peso siempre se lee por IA a partir del display de la báscula.
export function useVialCapture() {
  const [product, setProduct] = useState('');
  const [gtin, setGtin] = useState('');
  const [lot, setLot] = useState('');
  const [expiry, setExpiry] = useState('');
  const [weight, setWeight] = useState('');
  const [processing, setProcessing] = useState(false);
  const [codeMsg, setCodeMsg] = useState('');
  const [rawCode, setRawCode] = useState('');
  const [weightMsg, setWeightMsg] = useState('');
  const [weightReading, setWeightReading] = useState('');
  const [confidence, setConfidence] = useState<'alta' | 'media' | 'baja' | ''>('');

  async function resolveVialData(photoDataUrl: string): Promise<VialCaptureData> {
    const code = await scanDataMatrix(photoDataUrl);

    if (code) {
      const data = parseGS1(code);
      if (data.gtin || data.lot) {
        if (data.gtin) setGtin(data.gtin);
        if (data.lot) setLot(data.lot);
        if (data.expiry) setExpiry(data.expiry);
        setCodeMsg('');
        return {product: '', gtin: data.gtin || '', lot: data.lot || '', expiry: data.expiry || ''};
      }
      // Se detectó un código pero no se pudo interpretar como GS1 (ni
      // HRI ni plano). Lo mostramos para referencia y caemos a OCR.
      setRawCode(code);
      setCodeMsg('El código detectado no tiene formato GS1 reconocido. Leyendo la etiqueta con IA…');
    } else {
      setCodeMsg('No se detectó código DataMatrix. Leyendo la etiqueta con IA…');
    }

    try {
      const label = await readVialLabel(photoDataUrl);
      if (label.product) setProduct(label.product);
      if (label.lot) setLot(label.lot);
      if (label.expiry) setExpiry(label.expiry);
      if (label.confidence === 'alta' && (label.product || label.lot)) {
        setCodeMsg('No se detectó código; datos leídos por IA desde la etiqueta. Verifica que sean correctos.');
      } else {
        setCodeMsg(
          label.notes ||
            'No se pudo leer el código ni la etiqueta con confianza. Completa los datos manualmente.'
        );
      }
      return {product: label.product || '', gtin: '', lot: label.lot || '', expiry: label.expiry || ''};
    } catch {
      setCodeMsg(
        (code ? 'El código no es GS1 reconocible y ' : '') +
          'no se pudo leer la etiqueta automáticamente. Completa los datos manualmente.'
      );
      return {product: '', gtin: '', lot: '', expiry: ''};
    }
  }

  async function capture(photoDataUrl: string): Promise<VialCaptureData> {
    setProcessing(true);
    setWeightMsg('');
    setWeightReading('');
    setCodeMsg('');
    setRawCode('');
    setConfidence('');

    const [vialResult, weightResult] = await Promise.allSettled([
      resolveVialData(photoDataUrl),
      analyzeVialWeight(photoDataUrl),
    ]);

    if (weightResult.status === 'fulfilled') {
      const result = weightResult.value;
      if (result.weight != null) setWeight(String(result.weight));
      setConfidence(result.confidence);
      if (result.digitsSeen != null) {
        setWeightReading(`${result.digitsSeen}${result.unit ? ' ' + result.unit : ''}`);
      }
      if (result.confidence !== 'alta') {
        setWeightMsg(result.notes || 'Verifica el peso detectado antes de continuar.');
      }
    } else {
      setWeightMsg('No se pudo leer la báscula automáticamente. Ingresa el peso manualmente.');
    }

    setProcessing(false);
    return vialResult.status === 'fulfilled' ? vialResult.value : {product: '', gtin: '', lot: '', expiry: ''};
  }

  return {
    product,
    setProduct,
    gtin,
    setGtin,
    lot,
    setLot,
    expiry,
    setExpiry,
    weight,
    setWeight,
    processing,
    codeMsg,
    rawCode,
    weightMsg,
    weightReading,
    confidence,
    capture,
  };
}
