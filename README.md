# MemePur_Sticks

An enhanced, high-reliability rebuild of the browser-only Meme Verse application (formerly Meme Verse 2.0). The new version features a local "Selfie-to-Sticker" animated pipeline.

## Tech Stack
- **Build tool:** Vite
- **Language:** Vanilla TypeScript
- **Machine Learning (Client-side):** `@mediapipe/tasks-vision` (HandLandmarker, FaceLandmarker, ImageSegmenter)
- **Rendering:** HTML5 Canvas (2D Context)
- **Export Encoding (Client-side):** MediaRecorder API + `canvas.captureStream()` for WebM; WebAssembly `libwebp` wrapper for animated WebP
- **Sticker Packing:** `jszip`
- **Persistence:** LocalStorage + Local IndexedDB
- **Background workers:** HTML5 Web Workers with Transferable Objects
