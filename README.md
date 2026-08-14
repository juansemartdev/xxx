# ChainDose PWA — V0.1

MVP mobile-first para trazabilidad digital de administración de medicamentos.

## Flujo incluido
1. Acceso profesional (demo; preparado para WebAuthn).
2. Selección/autenticación de paciente (demo; Face Liveness se integra después).
3. Lectura NFC mediante Web NFC cuando el navegador lo soporta.
4. Captura de foto del vial + display de balanza con cámara trasera.
5. Peso ANTES (campo temporal; sustituir por OCR/visión).
6. Captura DESPUÉS + peso.
7. Resumen y cierre de sesión.

## Ejecutar

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

### Pruebas de cámara/NFC
Para APIs de hardware el navegador exige contexto seguro. En producción Vercel entrega HTTPS. Web NFC es principalmente una ruta Android/Chrome; para iOS dejar fallback QR o implementar una pequeña capa nativa posteriormente.

## Próximas iteraciones
- OCR automático del display de la balanza.
- Detección del vial y validación de etiqueta.
- Comparación visual ANTES/DESPUÉS.
- Backend PostgreSQL + almacenamiento de evidencia.
- Tags NFC/tamper definitivos.
- Face Liveness/Face Verification.
- WebAuthn para profesional.
