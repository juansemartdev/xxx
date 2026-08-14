export type WeightAnalysis = {
  weight: number | null;
  confidence: 'alta' | 'media' | 'baja';
  notes: string;
};

export async function analyzeVialWeight(imageDataUrl: string): Promise<WeightAnalysis> {
  const res = await fetch('/api/analyze-vial', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({image: imageDataUrl}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo analizar la imagen.');
  }
  return data as WeightAnalysis;
}
