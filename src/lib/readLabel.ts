export type LabelReading = {
  product: string | null;
  lot: string | null;
  expiry: string | null;
  confidence: 'alta' | 'media' | 'baja';
  notes: string;
};

export async function readVialLabel(imageDataUrl: string): Promise<LabelReading> {
  const res = await fetch('/api/read-label', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({image: imageDataUrl}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo leer la etiqueta.');
  }
  return data as LabelReading;
}
