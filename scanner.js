// Live camera + barcode decoding. Native BarcodeDetector where the browser has it
// (Chrome / Android); vendored ZXing fallback elsewhere (iPhone Safari), lazy-loaded
// only when actually needed. Camera requires a secure context (https or localhost).
window.Scanner = (() => {
  let stream = null, timer = 0, zreader = null, active = false;

  const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  const loadScript = src => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });

  async function start(video, onCode){
    stop();
    if (!window.isSecureContext) return { ok:false, reason:'insecure' };
    if (!supported()) return { ok:false, reason:'nocam' };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
    } catch(e){
      return { ok:false, reason:(e && (e.name==='NotAllowedError' || e.name==='SecurityError')) ? 'denied' : 'nocam' };
    }
    video.srcObject = stream; active = true;
    try { await video.play(); } catch(e){}
    if (onCode) decodeLoop(video, onCode);
    return { ok:true };
  }

  async function decodeLoop(video, onCode){
    if ('BarcodeDetector' in window){
      let det = null;
      try { det = new BarcodeDetector({ formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39'] }); } catch(e){}
      if (det){
        const loop = async () => {
          if (!active) return;
          try { const codes = await det.detect(video); if (codes.length && codes[0].rawValue) onCode(codes[0].rawValue); } catch(e){}
          timer = setTimeout(loop, 220);
        };
        loop(); return;
      }
    }
    // Fallback: ZXing over canvas frames (slower cadence — decode is CPU work).
    try {
      if (!window.ZXing) await loadScript('vendor/zxing.js');
      zreader = new ZXing.BrowserMultiFormatReader();
      const c = document.createElement('canvas');
      const loop = async () => {
        if (!active) return;
        if (video.readyState >= 2 && video.videoWidth){
          c.width = video.videoWidth; c.height = video.videoHeight;
          c.getContext('2d').drawImage(video, 0, 0);
          try { const res = await zreader.decodeFromImageUrl(c.toDataURL('image/jpeg', 0.8)); if (res) onCode(res.getText()); } catch(e){}
        }
        timer = setTimeout(loop, 450);
      };
      loop();
    } catch(e){ /* no decoder available — manual entry fallback still works */ }
  }

  function stop(){
    active = false; clearTimeout(timer);
    if (zreader){ try { zreader.reset(); } catch(e){} zreader = null; }
    if (stream){ stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  // Grab a frame as a ≤900px JPEG data-URL (matches readImage() sizing).
  function snap(video){
    const w = video.videoWidth || 640, h = video.videoHeight || 480, max = 900;
    let cw = w, ch = h;
    if (w > h && w > max){ ch = Math.round(h*max/w); cw = max; } else if (h >= w && h > max){ cw = Math.round(w*max/h); ch = max; }
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    c.getContext('2d').drawImage(video, 0, 0, cw, ch);
    return c.toDataURL('image/jpeg', 0.72);
  }

  return { start, stop, snap, supported };
})();
