import Lenis from 'lenis';

const FRAME_COUNT = 112;
const images = [];
let loadedCount = 0;
let lastDrawnFrame = -1;
let targetFrame = 0;
let interpolatedFrame = 0;

const canvas = document.getElementById('canvas');
const ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
const loader = document.getElementById('loader');
const loaderProgress = document.getElementById('loader-progress');

// Initialize smooth scrolling with Lenis
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  orientation: 'vertical',
  gestureOrientation: 'vertical',
  smoothWheel: true,
  wheelMultiplier: 1.0,
  touchMultiplier: 1.8,
});

// Calculate frame file path for project frames
function getFramePath(index) {
  const padded = String(index + 1).padStart(3, '0');
  return `/project-frames/ezgif-frame-${padded}.jpg`;
}

// Resize canvas handling HiDPI displays
function resizeCanvas() {
  if (!canvas || !ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  if (lastDrawnFrame >= 0) {
    drawFrame(lastDrawnFrame, true);
  }
}

// Retrieve target frame or fallback to nearest loaded frame for zero flicker
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

// Draw a specific frame using 'cover' mode to fit any screen
function drawFrame(index, force = false) {
  if (!canvas || !ctx) return;
  if (!force && index === lastDrawnFrame) return;

  const img = getLoadedFrame(index);
  if (!img) return;

  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Calculate cover aspect ratio
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const scale = Math.max(w / imgW, h / imgH);
  const renderW = imgW * scale;
  const renderH = imgH * scale;
  const offsetX = (w - renderW) / 2;
  const offsetY = (h - renderH) / 2;

  ctx.drawImage(img, offsetX, offsetY, renderW, renderH);
  ctx.restore();

  lastDrawnFrame = index;
}

// Preload all 112 project frames into memory
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
      loadedCount++;
      const progress = (loadedCount / FRAME_COUNT) * 100;
      if (loaderProgress) {
        loaderProgress.style.width = `${progress}%`;
      }

      // Draw initial frame as soon as frame 0 loads
      if (i === 0 && lastDrawnFrame === -1) {
        drawFrame(0);
      }

      // Hide loader once minimum smooth playback threshold is reached
      if (loadedCount >= Math.min(25, FRAME_COUNT)) {
        setTimeout(() => {
          if (loader) loader.classList.add('loaded');
        }, 120);
      }
    };

    img.onerror = () => {
      loadedCount++;
      if (loadedCount >= Math.min(25, FRAME_COUNT)) {
        setTimeout(() => {
          if (loader) loader.classList.add('loaded');
        }, 120);
      }
    };

    images.push(img);
  }
}

// Animation loop with sub-frame dampening
function renderLoop(time) {
  lenis.raf(time);

  // Compute scroll progress (0 to 1)
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const currentScroll = window.scrollY || window.pageYOffset || 0;
  const scrollFraction = maxScroll > 0 ? Math.max(0, Math.min(1, currentScroll / maxScroll)) : 0;

  targetFrame = scrollFraction * (FRAME_COUNT - 1);

  // Smooth lerp interpolation for silky momentum
  const lerpFactor = 0.12;
  interpolatedFrame += (targetFrame - interpolatedFrame) * lerpFactor;

  // Snap when extremely close to target to avoid micro-renders
  if (Math.abs(targetFrame - interpolatedFrame) < 0.001) {
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
      // Toggle active button
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');

      projectCards.forEach((card) => {
        const cardCategory = card.getAttribute('data-category');
        if (filterValue === 'all' || cardCategory === filterValue) {
          card.style.display = 'grid';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
          }, 10);
        } else {
          card.style.opacity = '0';
          card.style.transform = 'translateY(16px)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 300);
        }
      });
    });
  });
}

// Smooth scroll to anchors
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', function (e) {
    const targetId = this.getAttribute('href');
    if (targetId && targetId !== '#') {
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: -30, duration: 1.4 });
      }
    }
  });
});

// Initialize
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
preloadImages();
setupProjectFilters();
requestAnimationFrame(renderLoop);
