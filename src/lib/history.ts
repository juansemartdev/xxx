// Historial local (en este navegador/dispositivo) de mediciones ya
// completadas, usado para la regla de auditoría "el peso de esta muestra
// se desvía más de 10% de otras mediciones del mismo producto".
//
// Importante: esto NO es una base de datos compartida entre usuarios ni
// dispositivos — es solo localStorage de este navegador. Si se borran
// los datos del sitio o se cambia de teléfono, el historial se pierde.
// Sirve para probar el concepto; para producción real esto debería vivir
// en un backend compartido.

export type HistoryRecord = {
  timestamp: number;
  product?: string;
  gtin?: string;
  beforeWeight?: number;
  afterWeight?: number;
};

const KEY = 'chaindose-history';
const MAX_RECORDS = 500;

export function getHistory(): HistoryRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendHistory(record: HistoryRecord) {
  const list = getHistory();
  list.push(record);
  if (list.length > MAX_RECORDS) list.splice(0, list.length - MAX_RECORDS);
  localStorage.setItem(KEY, JSON.stringify(list));
}

function matchesProduct(r: HistoryRecord, gtin?: string, product?: string): boolean {
  if (gtin && r.gtin) return r.gtin === gtin;
  if (product && r.product) return r.product.trim().toLowerCase() === product.trim().toLowerCase();
  return false;
}

export type Deviation = {avg: number; deviationPct: number; count: number};

// Compara `weight` contra el promedio de mediciones históricas del mismo
// producto (por GTIN si está disponible, si no por nombre de producto).
// Devuelve null si no hay suficiente historial para comparar.
export function deviationFromHistory(
  weight: number,
  field: 'beforeWeight' | 'afterWeight',
  gtin?: string,
  product?: string
): Deviation | null {
  if (!gtin && !product) return null;
  const list = getHistory().filter((r) => matchesProduct(r, gtin, product) && r[field] != null);
  if (list.length === 0) return null;

  const values = list.map((r) => r[field] as number);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg === 0) return null;

  const deviationPct = (Math.abs(weight - avg) / avg) * 100;
  return {avg, deviationPct, count: values.length};
}
