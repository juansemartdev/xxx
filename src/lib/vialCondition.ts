export type VialCondition = {
  looksOpened: boolean | null;
  confidence: 'alta' | 'media' | 'baja';
  notes: string;
};

export async function checkVialCondition(imageDataUrl: string): Promise<VialCondition> {
  const res = await fetch('/api/check-vial-condition', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({image: imageDataUrl}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo evaluar la condición del vial.');
  }
  return data as VialCondition;
}
