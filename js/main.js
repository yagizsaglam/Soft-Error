/**
 * SOFT ERROR — Interactive main.js
 * Lenis smooth scroll + 3D tilt + glitch + fullscreen viewer + dynamic typography
 */

(async function () {
  // =========================================================================
  // 0. LOAD CHAPTER DATA & POPULATE IMAGE GRIDS
  // =========================================================================
  let allImages = []; // flat array of all image wrappers for viewer navigation

  try {
    // Use inline data (works offline with file:// protocol)
    const chapters = window.__CHAPTERS__ || {};

    for (const [key, info] of Object.entries(chapters)) {
      if (key === 'front' || key === 'back') continue;
      const chapterNum = key.replace('chapter', '');
      const grid = document.getElementById(`grid-chapter${chapterNum}`);
      if (!grid) continue;

      let html = '';
      for (let p = info.start; p <= info.end; p++) {
        const filename = `page_${String(p).padStart(3, '0')}.webp`;
        const isCover = (p === info.coverPage);
        const extraClass = isCover ? ' is-cover' : '';

        html += `
          <div class="image-card${extraClass} reveal-stagger" data-page="${p}">
            <div class="image-card-inner">
              <img src="images/pages/${filename}" alt="Page ${p}" loading="lazy" decoding="async">
            </div>
          </div>`;
      }
      grid.innerHTML = html;
    }

    // Collect all image cards for viewer navigation
    allImages = Array.from(document.querySelectorAll('.image-card'));
  } catch (e) {
    console.error('Failed to populate images:', e);
    return;
  }

  // =========================================================================
  // 1. LENIS SMOOTH SCROLL
  // =========================================================================
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // =========================================================================
  // 2. CHAR-SPLITTING FOR TITLES
  // =========================================================================
  function charSplit(el) {
    const text = el.textContent.trim();
    el.textContent = '';
    const chars = [];
    for (const ch of text) {
      const span = document.createElement('span');
      span.className = 'char';
      span.textContent = ch === ' ' ? ' ' : ch;
      span.setAttribute('data-char', ch);
      el.appendChild(span);
      chars.push(span);
    }
    return chars;
  }

  // Split hero title and chapter titles
  const heroTitle = document.querySelector('.hero-title');
  const heroChars = heroTitle ? charSplit(heroTitle) : [];

  const chapterDividers = document.querySelectorAll('.chapter-divider');
  const chapterTitleChars = [];
  for (const divider of chapterDividers) {
    const title = divider.querySelector('.chapter-title');
    if (title) {
      chapterTitleChars.push({ divider, chars: charSplit(title) });
    }
  }

  // =========================================================================
  // 3. SCROLL-LINKED TYPOGRAPHY EFFECTS
  // =========================================================================
  function updateTypography() {
    const scrollY = lenis.animatedScroll || window.scrollY;
    const vh = window.innerHeight;

    // Hero title: skew on scroll-away
    if (heroChars.length > 0) {
      const heroProgress = Math.max(0, Math.min(1, scrollY / (vh * 0.8)));
      for (const ch of heroChars) {
        ch.style.transform = `skewX(${heroProgress * -12}deg)`;
        ch.style.opacity = Math.max(0, 1 - heroProgress * 1.6);
      }
    }

    // Chapter titles: letter-spacing oscillation based on viewport position
    for (const { divider, chars } of chapterTitleChars) {
      const rect = divider.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const progress = 1 - Math.abs(center - vh * 0.5) / (vh * 0.6);
      const clamped = Math.max(0, Math.min(1, progress));

      // Map progress to letter-spacing: tight at center, looser at edges
      const spacing = -0.03 + (clamped * 0.06); // -0.03em → 0.03em
      for (const ch of chars) {
        ch.style.letterSpacing = spacing + 'em';
        ch.style.transform = `skewX(${(1 - clamped) * 5}deg)`;
      }
    }

    // Scroll indicator
    const pct = document.getElementById('scrollPct');
    const line = document.querySelector('.scroll-line');
    if (pct && line) {
      const docHeight = document.documentElement.scrollHeight - vh;
      const progress = docHeight > 0 ? Math.min(100, Math.round((scrollY / docHeight) * 100)) : 0;
      pct.textContent = String(progress).padStart(2, '0');
      const afterEl = line.querySelector('::after');
      // Update the scroll-line fill via CSS custom property
      line.style.setProperty('--fill', progress + '%');
    }
  }

  // Update scroll-line fill via a style rule
  const scrollStyle = document.createElement('style');
  scrollStyle.textContent = `
    .scroll-line::after { height: var(--fill, 0%); }
  `;
  document.head.appendChild(scrollStyle);

  // =========================================================================
  // 4. SCROLL REVEAL (Intersection Observer)
  // =========================================================================
  const revealObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

  // Stagger for image cards
  const staggerObserver = new IntersectionObserver((entries) => {
    let delay = 0;
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('revealed');
        staggerObserver.unobserve(el);
        delay += 80;
      }
    }
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

  for (const el of document.querySelectorAll('.reveal')) {
    revealObserver.observe(el);
  }
  for (const el of document.querySelectorAll('.reveal-stagger')) {
    staggerObserver.observe(el);
  }

  // =========================================================================
  // 5. 3D TILT + GLITCH ON IMAGE CARDS
  // =========================================================================
  function rgbSplit(imageEl, canvasEl, intensity) {
    // intensity: 0 = normal, 1 = max split (~4px)
    const maxShift = Math.round(intensity * 4);
    if (maxShift === 0) {
      // No split: just draw normally
      const ctx = canvasEl.getContext('2d');
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      return;
    }

    const w = canvasEl.width;
    const h = canvasEl.height;
    const ctx = canvasEl.getContext('2d');

    // Create an offscreen canvas to get image data
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(imageEl, 0, 0, w, h);
    const imageData = offCtx.getImageData(0, 0, w, h);
    const src = imageData.data;

    // Create output buffer
    const outData = ctx.createImageData(w, h);
    const dst = outData.data;

    // RGB channel separation
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = (y * w + x) * 4;

        // R channel: shift right
        const rx = Math.min(w - 1, Math.max(0, x + maxShift));
        const rIdx = (y * w + rx) * 4;

        // B channel: shift left
        const bx = Math.min(w - 1, Math.max(0, x - maxShift));
        const bIdx = (y * w + bx) * 4;

        // G channel: center (no shift)
        const gIdx = srcIdx;

        const dstIdx = (y * w + x) * 4;
        dst[dstIdx] = src[rIdx];       // R
        dst[dstIdx + 1] = src[gIdx + 1]; // G
        dst[dstIdx + 2] = src[bIdx + 2]; // B
        dst[dstIdx + 3] = src[srcIdx + 3]; // A
      }
    }

    ctx.putImageData(outData, 0, 0);
  }

  function setupTiltCard(card) {
    const inner = card.querySelector('.image-card-inner');
    const img = card.querySelector('img');
    if (!inner || !img) return;

    let canvas = null;
    let glitchTimeout = null;
    let glitchIntensity = 0;

    // Create glitch canvas
    function ensureCanvas() {
      if (canvas) return canvas;
      canvas = document.createElement('canvas');
      canvas.className = 'glitch-canvas';
      const iw = img.naturalWidth || img.offsetWidth;
      const ih = img.naturalHeight || img.offsetHeight;
      canvas.width = iw;
      canvas.height = ih;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      inner.appendChild(canvas);
      return canvas;
    }

    // Trigger glitch burst
    function triggerGlitch() {
      const cvs = ensureCanvas();
      // Resize canvas to match current image display
      const rect = img.getBoundingClientRect();
      const innerRect = inner.getBoundingClientRect();
      cvs.width = rect.width;
      cvs.height = rect.height;
      cvs.style.width = rect.width + 'px';
      cvs.style.height = rect.height + 'px';

      // Quick glitch: ramp up then down
      glitchIntensity = 0;
      cvs.classList.add('active');

      const duration = 250; // total glitch duration
      const start = performance.now();

      function animateGlitch(now) {
        const elapsed = now - start;
        const t = elapsed / duration;

        if (t >= 1) {
          glitchIntensity = 0;
          rgbSplit(img, cvs, 0);
          cvs.classList.remove('active');
          return;
        }

        // Parabolic: 0 → 1 → 0
        glitchIntensity = Math.sin(t * Math.PI);
        // Add some noise to intensity for "glitchy" feel
        const noisy = glitchIntensity * (0.5 + 0.5 * Math.random());
        rgbSplit(img, cvs, noisy);
        requestAnimationFrame(animateGlitch);
      }

      requestAnimationFrame(animateGlitch);
    }

    // Mouse move: 3D tilt
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      const maxAngle = 8;
      inner.style.transform = `rotateY(${x * maxAngle}deg) rotateX(${-y * maxAngle}deg)`;
    });

    // Mouse enter: glitch burst
    card.addEventListener('mouseenter', () => {
      triggerGlitch();
    });

    // Mouse leave: reset
    card.addEventListener('mouseleave', () => {
      inner.style.transform = 'rotateY(0deg) rotateX(0deg)';
      if (canvas) {
        canvas.classList.remove('active');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
  }

  // Set up all image cards
  for (const card of allImages) {
    const isSpread = card.classList.contains('spread');
    if (!isSpread) setupTiltCard(card);
  }

  // =========================================================================
  // 6. FULLSCREEN VIEWER
  // =========================================================================
  const viewer = document.getElementById('viewer');
  const viewerImg = document.getElementById('viewerImg');
  const viewerCounter = document.getElementById('viewerCounter');
  const viewerClose = document.getElementById('viewerClose');
  const viewerPrev = document.getElementById('viewerPrev');
  const viewerNext = document.getElementById('viewerNext');
  let viewerIndex = -1;
  let viewerScrollTimeout = null;

  function openViewer(index) {
    if (index < 0 || index >= allImages.length) return;
    viewerIndex = index;
    const card = allImages[index];
    const img = card.querySelector('img');
    viewerImg.src = img.src;
    viewerImg.alt = img.alt;
    const page = card.dataset.page;
    viewerCounter.textContent = `page_${String(page).padStart(3, '0')}  [${index + 1}/${allImages.length}]`;
    viewer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeViewer() {
    viewer.classList.remove('open');
    document.body.style.overflow = '';
    viewerIndex = -1;
  }

  function viewerNextImg() {
    if (viewerIndex < allImages.length - 1) {
      openViewer(viewerIndex + 1);
    }
  }

  function viewerPrevImg() {
    if (viewerIndex > 0) {
      openViewer(viewerIndex - 1);
    }
  }

  // Click on image cards
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.image-card');
    if (!card) return;
    const idx = allImages.indexOf(card);
    if (idx >= 0) openViewer(idx);
  });

  // Viewer controls
  viewerClose.addEventListener('click', closeViewer);
  viewer.addEventListener('click', (e) => {
    if (e.target === viewer) closeViewer();
  });
  viewerNext.addEventListener('click', viewerNextImg);
  viewerPrev.addEventListener('click', viewerPrevImg);

  // Keyboard: arrows + escape
  document.addEventListener('keydown', (e) => {
    if (!viewer.classList.contains('open')) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowRight') viewerNextImg();
    if (e.key === 'ArrowLeft') viewerPrevImg();
  });

  // Scroll wheel in viewer
  viewer.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (viewerScrollTimeout) return;
    viewerScrollTimeout = setTimeout(() => { viewerScrollTimeout = null; }, 600);
    if (e.deltaY > 0) viewerNextImg();
    else viewerPrevImg();
  }, { passive: false });

  // Touch swipe in viewer
  let touchStartY = 0;
  viewer.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  });
  viewer.addEventListener('touchend', (e) => {
    const diff = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) viewerNextImg();
      else viewerPrevImg();
    }
  });

  // =========================================================================
  // 7. NAVIGATION: HAMBURGER + DRAWER
  // =========================================================================
  const hamburger = document.getElementById('hamburger');
  const drawer = document.getElementById('drawer');
  const drawerOverlay = document.getElementById('drawerOverlay');
  const drawerClose = document.getElementById('drawerClose');
  const drawerLinks = document.querySelectorAll('[data-drawer-link]');

  function openDrawer() {
    drawer.classList.add('open');
    drawerOverlay.classList.add('open');
    hamburger.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Glitch-in animation on drawer links
    let delay = 0;
    for (const link of drawerLinks) {
      setTimeout(() => {
        link.classList.add('glitch-in');
        setTimeout(() => link.classList.remove('glitch-in'), 300);
      }, delay);
      delay += 80;
    }
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawerOverlay.classList.remove('open');
    hamburger.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', openDrawer);
  drawerClose.addEventListener('click', closeDrawer);
  drawerOverlay.addEventListener('click', closeDrawer);

  // Drawer link clicks: scroll to section
  for (const link of drawerLinks) {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.getAttribute('href').slice(1);
      const target = document.getElementById(targetId);
      if (target) {
        closeDrawer();
        lenis.scrollTo(target, { offset: 0, duration: 1.2 });
      }
    });
  }

  // =========================================================================
  // 8. CONTINUOUS UPDATES
  // =========================================================================
  // Update typography and scroll indicator on each Lenis scroll event
  lenis.on('scroll', updateTypography);

  // Also update on resize
  window.addEventListener('resize', updateTypography, { passive: true });

  // Initial update
  updateTypography();

  console.log('%c SOFT ERROR %c interactive ready ',
    'background:#111;color:#fff;padding:4px 8px;font-family:monospace;',
    'color:#666;font-family:monospace;');
})();
