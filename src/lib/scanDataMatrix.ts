// Escaneo de código DataMatrix en el navegador, sobre la foto ya
// capturada (no requiere una segunda captura ni servidor propio).
//
// Usamos zxing-wasm (compilación WebAssembly del motor real de zxing-cpp)
// en vez de las clases Browser*CodeReader de @zxing/library: esas están
// deprecadas y su detector de DataMatrix es un port en JS puro bastante
// débil para encontrar el código dentro de una foto de escena completa
// (curvatura del vial, reflejos, fondo con texto). zxing-cpp es mucho más
// robusto para ese caso real.
//
// Import dinámico para no inflar el bundle inicial de páginas que no
// necesitan escanear códigos.

export async function scanDataMatrix(imageDataUrl: string): Promise<string | null> {
  const {readBarcodes} = await import('zxing-wasm/reader');
  const blob = await fetch(imageDataUrl).then((r) => r.blob());

  const results = await readBarcodes(blob, {
    tryHarder: true,
    formats: ['DataMatrix'],
    maxNumberOfSymbols: 1,
  });

  return results[0]?.text || null;
}
