// Escaneo de código DataMatrix en el navegador, sobre la foto ya
// capturada (no requiere una segunda captura ni servidor). Import
// dinámico para no inflar el bundle inicial de las páginas que no
// necesitan escanear códigos.

export async function scanDataMatrix(imageDataUrl: string): Promise<string | null> {
  const {BrowserDatamatrixCodeReader} = await import('@zxing/library');
  const reader = new BrowserDatamatrixCodeReader();
  try {
    const result = await reader.decodeFromImageUrl(imageDataUrl);
    return result.getText();
  } catch {
    // No se encontró/decodificó ningún DataMatrix en la imagen.
    return null;
  } finally {
    reader.reset();
  }
}
