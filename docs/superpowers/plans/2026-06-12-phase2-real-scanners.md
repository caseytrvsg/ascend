# ASCEND Phase 2 — Real Scanners — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace both simulated scanners with a real live-camera experience: barcode scanning decodes on-device and looks products up in Open Food Facts; the meal scanner gets a live viewfinder + snap (AI recognition deferred until the AI account exists — manual food pick after snap, honestly labelled).

**Architecture:** New `scanner.js` owns the camera (getUserMedia rear camera) and barcode decoding — native `BarcodeDetector` when the browser has it (Chrome/Android), vendored ZXing fallback elsewhere (iPhone Safari). `index.html` swaps the faked views for live `<video>` viewfinders; product lookup is a small `lookupBarcode()` against Open Food Facts' free API. No backend changes.

**Tech Stack:** getUserMedia · BarcodeDetector API · @zxing/library UMD (vendored, lazy-loaded only when needed) · Open Food Facts API v2.

**Spec:** `docs/superpowers/specs/2026-06-12-ascend-backend-design.md` ("Real scanning" section)

---

### Task 1: Vendor ZXing fallback decoder
- [ ] Download `https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js` → `vendor/zxing.js`; verify the global `ZXing.BrowserMultiFormatReader` exists in the bundle (grep).
- [ ] Commit.

### Task 2: `scanner.js` camera module
- [ ] `Scanner.start(videoEl, onCode?)` → `{ok}` or `{ok:false, reason:'insecure'|'denied'|'nocam'}`; rear camera preferred; when `onCode` given, decode loop: native `BarcodeDetector` (ean_13/ean_8/upc_a/upc_e/code_128/code_39, ~220ms cadence) else lazy-load ZXing and decode video frames via canvas (~450ms cadence).
- [ ] `Scanner.stop()` — kills loop + camera tracks (battery!). `Scanner.snap(videoEl)` → ≤900px JPEG data-URL (mirrors `readImage()` sizing).
- [ ] Wire `<script src="scanner.js">`, add to sw CORE + FRESH, bump VERSION to v7.

### Task 3: Real barcode flow in `index.html`
- [ ] `openBarcode()` starts the camera into a live viewfinder (`<video>` under the existing corner-frame overlay); remove `PACKAGED`, `fauxBarcode()`, and the fake 1.7s timer.
- [ ] `onBarcodeDetected(code)` → debounced lookup → `lookupBarcode(code)` (Open Food Facts v2, fields: product_name, brands, serving_size, image_small_url, nutriments; per-serving macros when present else per-100g) → product view (photo when available) → `logBarcode()` unchanged (meals sync already works).
- [ ] Honest failure paths: not-in-database → keep scanning + offer manual food search; no camera/denied/insecure → message + type-the-digits fallback input (also our PC test path); offline → "lookup needs internet".
- [ ] `closeModal('scanModal')` always stops the camera.

### Task 4: Meal scanner gets the live camera
- [ ] `scanView 'photo'` becomes a live viewfinder + big Snap button → `Scanner.snap()` → straight to the results sheet with the photo and **zero invented foods**: copy says AI recognition is coming, user adds foods via the existing search. Remove `runDetect()` + `SCAN_MEALS` + the fake "analyzing" delay; keep file-upload as fallback when no camera.

### Task 5: Verify + ship
- [ ] Preview: barcode manual-entry path looks up a real product (e.g. Nutella `3017624010701`) end-to-end into the food log; camera-denied path shows the fallback gracefully; console clean.
- [ ] `node --test` still green; commit; push (auto-deploys); Casey tests the real camera on his phone at the live URL.

## Self-review
- Spec coverage: live viewfinder ✓ (T2-4), BarcodeDetector + fallback ✓ (T1-2), OFF lookup + manual fallback ✓ (T3), meal camera with deferred AI ✓ (T4), HTTPS caveat handled via 'insecure' reason ✓. Edge Function intentionally absent (AI account pending — spec allows).
- Placeholders: none. Types: Scanner API names match across tasks.
