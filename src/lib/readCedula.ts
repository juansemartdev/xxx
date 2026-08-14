export type CedulaReading = {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  secondLastName: string | null;
  documentNumber: string | null;
  birthDate: string | null;
  bloodType: string | null;
  gender: 'M' | 'F' | null;
  confidence: 'alta' | 'media' | 'baja';
  notes: string;
};

export async function readCedula(frontImage: string, backImage?: string): Promise<CedulaReading> {
  const res = await fetch('/api/read-cedula', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({frontImage, backImage}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'No se pudo leer la cédula.');
  }
  return data as CedulaReading;
}
