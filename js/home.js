/**
 * SOFT ERROR — Homepage
 * Irregular-blob lens + decaying-persistence trail + Lenis scroll effects
 */

(function () {
  // =========================================================================
  // 1. CANVAS LENS — BLOB + DECAY TRAIL
  // =========================================================================
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d');

  let W, H;
  let drawW, drawH, offX, offY;
  let imgCover, imgCoverUn;
  let offCover, offCoverUn;      // pre-scaled image layers
  let tempCanvas, tempCtx;       // compositing workspace
  let persistCanvas, persistCtx; // decaying trail mask
  let blurCanvas, blurCtx;       // pre-blurred mask

  // Lens state
  let lensX = -9999, lensY = -9999;
  let lensActive = false;

  const LENS_RADIUS  = 155;
  const BLUR_RADIUS  = 24;
  const DECAY_RATE   = 0.035;    // fraction erased per frame (lower = longer trail)

  // ---- Noise helpers ----
  function noise1(angle, t) {
    return (
      Math.sin(angle * 3.1 + t * 0.71) * 0.40 +
      Math.cos(angle * 5.3 - t * 0.53) * 0.28 +
      Math.sin(angle * 2.0 + t * 1.13) * 0.18 +
      Math.cos(angle * 7.7 + t * 0.31) * 0.14
    );
  }

  function drawBlob(ctx, cx, cy, radius, t) {
    const segments = 90;
    const raw = [];
    for (let i = 0; i < segments; i++) {
      raw.push(noise1((i / segments) * Math.PI * 2, t));
    }
    const min = Math.min(...raw);
    const max = Math.max(...raw);
    const range = max - min || 1;

    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const n = noise1(angle, t);
      const mapped = 0.58 + ((n - min) / range) * 0.54;
      const r = radius * mapped;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ---- Image loading ----
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // ---- Sizing ----
  function sizeCanvas() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;

    const imgRatio = imgCover.naturalWidth / imgCover.naturalHeight;
    const canvasRatio = W / H;

    if (canvasRatio > imgRatio) {
      drawW = W;
      drawH = W / imgRatio;
      offX = 0;
      offY = (H - drawH) / 2;
    } else {
      drawH = H;
      drawW = H * imgRatio;
      offX = (W - drawW) / 2;
      offY = 0;
    }
  }

  function buildOffscreenCanvases() {
    offCover = document.createElement('canvas');
    offCover.width = W; offCover.height = H;
    offCover.getContext('2d').drawImage(imgCover, offX, offY, drawW, drawH);

    offCoverUn = document.createElement('canvas');
    offCoverUn.width = W; offCoverUn.height = H;
    offCoverUn.getContext('2d').drawImage(imgCoverUn, offX, offY, drawW, drawH);

    tempCanvas = document.createElement('canvas');
    tempCanvas.width = W; tempCanvas.height = H;
    tempCtx = tempCanvas.getContext('2d');

    persistCanvas = document.createElement('canvas');
    persistCanvas.width = W; persistCanvas.height = H;
    persistCtx = persistCanvas.getContext('2d');

    blurCanvas = document.createElement('canvas');
    blurCanvas.width = W; blurCanvas.height = H;
    blurCtx = blurCanvas.getContext('2d');
  }

  // ---- Render ----
  let canvasOpacity = 1;

  function renderLens(blobTime) {
    // Stop drawing entirely when canvas should be invisible
    if (canvasOpacity <= 0.005) {
      ctx.clearRect(0, 0, W, H);
      return;
    }

    // 1. Decay the persistence mask: erase a fraction each frame
    persistCtx.globalCompositeOperation = 'destination-out';
    persistCtx.fillStyle = `rgba(0,0,0,${DECAY_RATE})`;
    persistCtx.fillRect(0, 0, W, H);

    // 2. Draw current blob (if active) at full white
    if (lensActive) {
      persistCtx.globalCompositeOperation = 'source-over';
      persistCtx.fillStyle = '#fff';
      drawBlob(persistCtx, lensX, lensY, LENS_RADIUS, blobTime);
    }

    // 3. Blur the persistence mask for soft edges
    blurCtx.clearRect(0, 0, W, H);
    blurCtx.filter = `blur(${BLUR_RADIUS}px)`;
    blurCtx.drawImage(persistCanvas, 0, 0);
    blurCtx.filter = 'none';

    // 4. Punch hole(s) in cover.png
    tempCtx.clearRect(0, 0, W, H);
    tempCtx.globalCompositeOperation = 'source-over';
    tempCtx.drawImage(offCover, 0, 0);

    tempCtx.globalCompositeOperation = 'destination-out';
    tempCtx.drawImage(blurCanvas, 0, 0);

    // 5. Composite with globalAlpha for fade
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = canvasOpacity;
    ctx.drawImage(offCoverUn, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  // =========================================================================
  // 2. LENIS + CONTINUOUS RENDER LOOP
  // =========================================================================
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  function renderFrame(time) {
    lenis.raf(time);

    const blobTime = time * 0.002;  // 2× morph speed
    renderLens(blobTime);

    requestAnimationFrame(renderFrame);
  }

  // =========================================================================
  // 3. MOUSE / TOUCH — boundary check via coordinates
  // =========================================================================
  function isOverCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return (
      e.clientX >= r.left && e.clientX <= r.right &&
      e.clientY >= r.top  && e.clientY <= r.bottom
    );
  }

  document.addEventListener('mousemove', (e) => {
    // Don't activate lens once canvas is fading out (phase 2)
    if (parseFloat(canvas.style.opacity) < 0.3) {
      lensActive = false;
      canvas.style.cursor = 'crosshair';
      return;
    }
    if (isOverCanvas(e)) {
      lensX = e.clientX;
      lensY = e.clientY;
      lensActive = true;
      canvas.style.cursor = 'none';
    } else {
      lensActive = false;
      canvas.style.cursor = 'crosshair';
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    lensX = e.touches[0].clientX;
    lensY = e.touches[0].clientY;
    lensActive = true;
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    lensActive = false;
  });

  window.addEventListener('resize', () => {
    sizeCanvas();
    buildOffscreenCanvases();
  });

  // =========================================================================
  // 4. SCROLL-DRIVEN EFFECTS (two-phase)
  // =========================================================================
  const redOverlay    = document.getElementById('redOverlay');
  const heroTitle     = document.getElementById('heroTitle');
  const cornerTL      = document.getElementById('cornerTL');
  const cornerTC      = document.getElementById('cornerTC');
  const cornerTR      = document.getElementById('cornerTR');
  const scrollHint    = document.getElementById('scrollHint');
  const chapterList   = document.getElementById('chapterList');
  const chapterLinks  = document.querySelectorAll('.chapter-link');
  const creditsPanel  = document.getElementById('creditsPanel');
  const boxCurtain    = document.getElementById('boxCurtain');

  function updateScrollEffects() {
    const scrollY = lenis.animatedScroll || window.scrollY;
    const vh = window.innerHeight;

    // ---- Box Curtain (0 → 2.0vh, scrolls up to reveal hero) ----
    if (boxCurtain) {
      const boxProgress = Math.max(0, Math.min(1, scrollY / (vh * 2.0)));
      boxCurtain.style.transform = `translateY(${-boxProgress * vh * 1.05}px)`;
    }

    // Phase 1: starts after box curtain (2.0vh → 3.2vh)
    const p1 = Math.max(0, Math.min(1, (scrollY - vh * 2.0) / (vh * 1.2)));

    // Phase 2: after a 1.0vh pause showing chapter links (4.2vh → 9.2vh)
    const phase2Start = vh * 4.2;
    const phase2End   = vh * 9.2;
    let p2 = Math.max(0, Math.min(1, (scrollY - phase2Start) / (phase2End - phase2Start)));

    // ---- Phase 1 ----
    redOverlay.style.opacity = p1;

    const titleScale = 1 + (1 - p1) * 0.15;
    const titleY = -60 * p1;
    heroTitle.style.transform = `translate(-50%, calc(-50% + ${titleY}px)) scale(${titleScale})`;
    heroTitle.style.opacity = Math.max(0, 1 - p1 * 1.4);

    // Top labels: stay white through phase 2
    cornerTL.style.opacity = 1;
    cornerTC.style.opacity = Math.max(0, Math.min(1, (p1 - 0.5) / 0.5));
    cornerTR.style.opacity = 1;
    // Color transition completes early (by p1 = 0.3), so they're white before chapter links
    const cp = Math.min(1, p1 / 0.3);
    const toWhite = `rgb(255, ${Math.round(213 + 42 * cp)}, ${Math.round(255 * cp)})`;
    cornerTL.style.color = toWhite;
    cornerTC.style.color = toWhite;
    cornerTR.style.color = `rgb(${Math.round(255 * cp)}, ${Math.round(255 * cp)}, ${Math.round(255 * cp)})`;

    scrollHint.classList.toggle('faded', p1 > 0.15);

    for (let i = 0; i < chapterLinks.length; i++) {
      const start = 0.15 + i * 0.14;
      const end   = start + 0.12;
      const p = Math.max(0, Math.min(1, (p1 - start) / (end - start)));
      chapterLinks[i].classList.toggle('visible', p > 0 && p2 < 0.8);
      chapterLinks[i].style.opacity = p * Math.max(0, 1 - p2);
      chapterLinks[i].style.transform = `translateY(${(1 - p) * 24}px)`;
    }

    // Fade out chapter list container in phase 2
    chapterList.style.opacity = Math.max(0, 1 - p2);
    chapterList.style.pointerEvents = p2 > 0.3 ? 'none' : '';

    // ---- Phase 2 ----
    canvasOpacity = 1 - p2;
    redOverlay.style.opacity = p1 * (1 - p2);

    // Credits panel fade in (0→0.25 p2 range — appears early)
    const creditsProgress = Math.max(0, Math.min(1, p2 / 0.25));
    creditsPanel.style.opacity = creditsProgress;
    creditsPanel.classList.toggle('active', creditsProgress > 0.5);
  }

  lenis.on('scroll', updateScrollEffects);
  window.addEventListener('resize', updateScrollEffects, { passive: true });

  // Click box curtain → jump to cover page (end of box phase)
  if (boxCurtain) {
    boxCurtain.addEventListener('click', () => {
      lenis.scrollTo(window.innerHeight * 2.0, { duration: 1.2 });
    });
  }

  // Back to content: scroll to phase 1 end
  document.getElementById('creditsBack').addEventListener('click', (e) => {
    e.preventDefault();
    lenis.scrollTo(window.innerHeight * 3.2, { duration: 1.8 });
  });

  // 3D tilt on center image
  const imgWrap = document.querySelector('.credits-img-wrap');
  const tiltImages = imgWrap.querySelectorAll('.credits-img');

  imgWrap.addEventListener('mousemove', (e) => {
    const rect = imgWrap.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;   // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;   // -0.5 to 0.5
    const maxTilt = 30; // degrees
    tiltImages.forEach((img) => {
      img.style.transform = `rotateY(${x * maxTilt}deg) rotateX(${-y * maxTilt}deg)`;
    });
  });

  imgWrap.addEventListener('mouseleave', () => {
    tiltImages.forEach((img) => {
      img.style.transform = 'rotateY(0deg) rotateX(0deg)';
    });
  });

  // Team member hover: crossfade center image (dual overlay for smooth transitions)
  const overlayA = document.getElementById('creditsOverlayA');
  const overlayB = document.getElementById('creditsOverlayB');
  const hoverImages = {};
  for (let i = 1; i <= 5; i++) {
    const img = new Image();
    img.src = `webpics/homepld${i}.png`;
    hoverImages[i] = img;
  }

  let activeOverlay = null; // 'A' | 'B' | null
  let leaveTimer = null;

  function hideOld(el) {
    el.style.transition = 'none';
    el.style.opacity = '0';
    // Restore transition after a tick
    requestAnimationFrame(() => { el.style.transition = ''; });
  }

  document.querySelectorAll('.team-member[data-img]').forEach((member) => {
    const idx = member.dataset.img;
    member.addEventListener('mouseenter', () => {
      clearTimeout(leaveTimer);

      if (activeOverlay === null) {
        // First hover: fade in overlayA
        overlayA.src = hoverImages[idx].src;
        overlayA.style.opacity = '1';
        activeOverlay = 'A';
      } else if (activeOverlay === 'A') {
        // Fade new in on top, then instantly hide old underneath
        overlayB.src = hoverImages[idx].src;
        overlayB.style.opacity = '1';
        setTimeout(() => hideOld(overlayA), 300);
        activeOverlay = 'B';
      } else {
        overlayA.src = hoverImages[idx].src;
        overlayA.style.opacity = '1';
        setTimeout(() => hideOld(overlayB), 300);
        activeOverlay = 'A';
      }
    });
    member.addEventListener('mouseleave', () => {
      leaveTimer = setTimeout(() => {
        if (activeOverlay === 'A') overlayA.style.opacity = '0';
        if (activeOverlay === 'B') overlayB.style.opacity = '0';
        activeOverlay = null;
      }, 150);
    });
  });

  // =========================================================================
  // 5. INIT
  // =========================================================================
  async function init() {
    try {
      [imgCover, imgCoverUn] = await Promise.all([
        loadImage('webpics/cover.png'),
        loadImage('webpics/coverun.png'),
      ]);

      sizeCanvas();
      buildOffscreenCanvases();

      // Apply initial scroll state so nothing jumps on first scroll
      updateScrollEffects();

      // Jump to phase 1 end if arriving from chapter page
      if (window.location.hash === '#phase1') {
        lenis.scrollTo(window.innerHeight * 3.2, { immediate: true });
      }

      requestAnimationFrame(renderFrame);

      console.log('%c SOFT ERROR %c homepage ready ',
        'background:#e00000;color:#fff;padding:4px 8px;font-family:monospace;',
        'color:#666;font-family:monospace;');
    } catch (err) {
      console.error('Failed to load images:', err);
    }
  }

  init();
})();
