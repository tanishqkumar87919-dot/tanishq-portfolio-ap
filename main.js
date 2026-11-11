import Lenis from 'lenis';

const FRAME_COUNT = 238;
const images = [];
let loadedCount = 0;
let lastDrawnFrame = -1;
let targetProgress = 0;
let currentProgress = 0;

let canvasW = 0;
let canvasH = 0;
let destX = 0;
let destY = 0;
let destW = 0;
let destH = 0;
let baseImgW = 0;
let baseImgH = 0;

const canvas = document.getElementById('canvas');
const ctx = canvas ? canvas.getContext('2d', { alpha: false, desynchronized: true }) : null;
const loader = document.getElementById('loader');
const loaderProgress = document.getElementById('loader-progress');

// High-performance smooth scrolling with Lenis (butter smooth 60-120fps)
const lenis = new Lenis({
  duration: 1.0,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: 'vertical',
  gestureOrientation: 'vertical',
  smoothWheel: true,
  wheelMultiplier: 0.95,
  touchMultiplier: 1.5,
  infinite: false,
});

// Sync scroll progress via Lenis event - ZERO layout reflows/DOM reads in RAF!
lenis.on('scroll', (e) => {
  targetProgress = typeof e.progress === 'number' ? e.progress : 0;
});

// Calculate frame file path
function getFramePath(index) {
  const padded = String(index + 1).padStart(3, '0');
  return `/frames/ezgif-frame-${padded}.jpg`;
}

// Compute cover dimensions in physical canvas pixels to avoid per-frame scaling
function updateCanvasDimensions() {
  if (!canvas || !ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvasW = Math.round(w * dpr);
  canvasH = Math.round(h * dpr);

  canvas.width = canvasW;
  canvas.height = canvasH;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  if (baseImgW > 0 && baseImgH > 0) {
    const scale = Math.max(canvasW / baseImgW, canvasH / baseImgH);
    destW = Math.round(baseImgW * scale);
    destH = Math.round(baseImgH * scale);
    destX = Math.round((canvasW - destW) / 2);
    destY = Math.round((canvasH - destH) / 2);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';

  if (lastDrawnFrame >= 0) {
    drawFrame(lastDrawnFrame, true);
  }
}

// Fallback search for nearest loaded frame
function getLoadedFrame(index) {
  if (images[index] && images[index].complete && images[index].naturalWidth > 0) {
    return images[index];
  }
  for (let offset = 1; offset < FRAME_COUNT; offset++) {
    const prev = index - offset;
    if (prev >= 0 && images[prev]?.complete && images[prev]?.naturalWidth > 0) {
      return images[prev];
    }
    const next = index + offset;
    if (next < FRAME_COUNT && images[next]?.complete && images[next]?.naturalWidth > 0) {
      return images[next];
    }
  }
  return null;
}

// Ultra-fast direct buffer draw (no ctx.save/scale/restore overhead)
function drawFrame(index, force = false) {
  if (!ctx || (!force && index === lastDrawnFrame)) return;

  const img = getLoadedFrame(index);
  if (!img) return;

  // Initialize base dimensions on first loaded frame
  if (baseImgW === 0) {
    baseImgW = img.naturalWidth;
    baseImgH = img.naturalHeight;
    updateCanvasDimensions();
  }

  ctx.drawImage(img, destX, destY, destW, destH);
  lastDrawnFrame = index;
}

// Preload all 238 frames into memory with background decoding
function preloadImages() {
  // Safety timeout: ensure loader never lingers more than 1.5s
  setTimeout(() => {
    if (loader && !loader.classList.contains('loaded')) {
      loader.classList.add('loaded');
    }
  }, 1500);

  for (let i = 0; i < FRAME_COUNT; i++) {
    const img = new Image();
    img.src = getFramePath(i);

    img.onload = () => {
      // Decode off main thread to prevent GPU/UI jank on initial paint
      if ('decode' in img) {
        img.decode().catch(() => {});
      }

      loadedCount++;
      const progress = (loadedCount / FRAME_COUNT) * 100;
      if (loaderProgress) {
        loaderProgress.style.width = `${progress}%`;
      }

      // Draw initial frame as soon as frame 0 loads
      if (i === 0 && lastDrawnFrame === -1) {
        baseImgW = img.naturalWidth;
        baseImgH = img.naturalHeight;
        updateCanvasDimensions();
        drawFrame(0);
      }

      // Hide loader once minimum smooth playback threshold is reached
      if (loadedCount >= Math.min(30, FRAME_COUNT)) {
        setTimeout(() => {
          if (loader) loader.classList.add('loaded');
        }, 120);
      }
    };

    img.onerror = () => {
      loadedCount++;
      if (loadedCount >= Math.min(30, FRAME_COUNT)) {
        setTimeout(() => {
          if (loader) loader.classList.add('loaded');
        }, 120);
      }
    };

    images.push(img);
  }
}

// 60-120fps Animation loop with zero layout reads
function renderLoop(time) {
  lenis.raf(time);

  // Smooth lerp towards Lenis scroll target
  const diff = targetProgress - currentProgress;
  if (Math.abs(diff) > 0.0001) {
    currentProgress += diff * 0.18;
  } else {
    currentProgress = targetProgress;
  }

  const frameToRender = Math.min(
    FRAME_COUNT - 1,
    Math.max(0, Math.round(currentProgress * (FRAME_COUNT - 1)))
  );

  drawFrame(frameToRender);

  requestAnimationFrame(renderLoop);
}

// Smooth scroll to anchors
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId && targetId !== '#') {
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: -30, duration: 1.2 });
      }
    }
  });
});

// Debounced resize handler for resize performance
let resizeTimeout = null;
window.addEventListener('resize', () => {
  if (resizeTimeout) cancelAnimationFrame(resizeTimeout);
  resizeTimeout = requestAnimationFrame(() => {
    updateCanvasDimensions();
  });
}, { passive: true });

// Boot engine
updateCanvasDimensions();
preloadImages();
requestAnimationFrame(renderLoop);
