import Lenis from 'lenis';

const FRAME_COUNT = 112;
const images = [];
let loadedCount = 0;
let lastDrawnFrame = -1;
let targetProgress = 0;
let interpolatedFrame = 0;

// Base resolution of project frames (1280x720) pre-initialized
let baseImgW = 1280;
let baseImgH = 720;
let canvasW = 0;
let canvasH = 0;
let destX = 0;
let destY = 0;
let destW = 0;
let destH = 0;

const canvas = document.getElementById('canvas');
const ctx = canvas ? canvas.getContext('2d', { alpha: false, desynchronized: true }) : null;
const loader = document.getElementById('loader');
const loaderProgress = document.getElementById('loader-progress');

// Liquid physics momentum scrolling with Lenis (butter-smooth 60-120fps)
const lenis = new Lenis({
  lerp: 0.08,             // Pure continuous physics lerp - silky smooth momentum
  wheelMultiplier: 0.85,  // Balanced tactile feel for mouse wheels & trackpads
  touchMultiplier: 1.5,   // Natural responsive touch gliding
  smoothWheel: true,
  infinite: false,
});

// Flag scrolling state on document.body to eliminate hover thrashing during scroll
let scrollTimer = null;
lenis.on('scroll', (e) => {
  targetProgress = typeof e.progress === 'number' ? e.progress : 0;
  if (!document.body.classList.contains('is-scrolling')) {
    document.body.classList.add('is-scrolling');
  }
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    document.body.classList.remove('is-scrolling');
  }, 100);
});

// Frame image path generator
function getFramePath(index) {
  const padded = String(index + 1).padStart(3, '0');
  return `/project-frames/ezgif-frame-${padded}.jpg`;
}

// Compute cover dimensions in physical canvas pixels once per resize
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

  const scale = Math.max(canvasW / baseImgW, canvasH / baseImgH);
  destW = Math.round(baseImgW * scale);
  destH = Math.round(baseImgH * scale);
  destX = Math.round((canvasW - destW) / 2);
  destY = Math.round((canvasH - destH) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';

  if (lastDrawnFrame >= 0) {
    drawFrame(lastDrawnFrame, true);
  }
}

// Fallback lookup: returns frame or nearest loaded neighbor
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

// Ultra-fast direct buffer draw without context save/scale/restore
function drawFrame(index, force = false) {
  if (!ctx || (!force && index === lastDrawnFrame)) return;

  const img = getLoadedFrame(index);
  if (!img) return;

  ctx.drawImage(img, destX, destY, destW, destH);
  lastDrawnFrame = index;
}

// Preload all 112 project frames with async decoding
function preloadImages() {
  // Safety timeout: dismiss loader after 1.2s max
  setTimeout(() => {
    if (loader && !loader.classList.contains('loaded')) {
      loader.classList.add('loaded');
    }
  }, 1200);

  for (let i = 0; i < FRAME_COUNT; i++) {
    const img = new Image();
    img.src = getFramePath(i);

    img.onload = () => {
      // Decode off main thread so canvas paints with zero hitch
      if ('decode' in img) {
        img.decode().catch(() => {});
      }

      loadedCount++;
      const progress = (loadedCount / FRAME_COUNT) * 100;
      if (loaderProgress) {
        loaderProgress.style.width = `${progress}%`;
      }

      // Draw initial frame as soon as frame 0 is ready
      if (i === 0 && lastDrawnFrame === -1) {
        drawFrame(0);
      }

      // Dismiss loader as soon as the first smooth batch is ready
      if (loadedCount >= Math.min(20, FRAME_COUNT)) {
        setTimeout(() => {
          if (loader) loader.classList.add('loaded');
        }, 100);
      }
    };

    img.onerror = () => {
      loadedCount++;
      if (loadedCount >= Math.min(20, FRAME_COUNT)) {
        setTimeout(() => {
          if (loader) loader.classList.add('loaded');
        }, 100);
      }
    };

    images.push(img);
  }
}

// 60-120fps Animation loop directly synchronized with Lenis
function renderLoop(time) {
  lenis.raf(time);

  // Read Lenis's smoothed progress directly (0.0 to 1.0)
  const progress = typeof lenis.progress === 'number' ? lenis.progress : targetProgress;
  const targetFrame = progress * (FRAME_COUNT - 1);

  // Sub-frame lerp ensures buttery transitions without discrete step artifacts
  const diff = targetFrame - interpolatedFrame;
  if (Math.abs(diff) > 0.001) {
    interpolatedFrame += diff * 0.25;
  } else {
    interpolatedFrame = targetFrame;
  }

  const frameToRender = Math.min(
    FRAME_COUNT - 1,
    Math.max(0, Math.round(interpolatedFrame))
  );

  drawFrame(frameToRender);

  requestAnimationFrame(renderLoop);
}

// Interactive Project Category Filtering
function setupProjectFilters() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.case-study-card');

  if (!filterBtns.length || !projectCards.length) return;

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');

      projectCards.forEach((card) => {
        const cardCategory = card.getAttribute('data-category');
        if (filterValue === 'all' || cardCategory === filterValue) {
          card.style.display = 'grid';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0) translateZ(0)';
          }, 10);
        } else {
          card.style.opacity = '0';
          card.style.transform = 'translateY(16px) translateZ(0)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 250);
        }
      });
    });
  });
}

// Smooth scroll to anchors with momentum
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId && targetId !== '#') {
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: -30, duration: 1.0 });
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
setupProjectFilters();
requestAnimationFrame(renderLoop);
