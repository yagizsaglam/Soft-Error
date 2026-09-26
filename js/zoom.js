// Image zoom — shared module for chapter pages.
//
// Shows a fixed circular "+" button (right side of the content area) while a
// stack card is selected, and opens a white overlay that displays the selected
// image edge-to-edge (excluding the fixed left sidebar on desktop, full-screen
// on mobile). Close by clicking anywhere in the overlay or pressing Escape.
(function () {
  'use strict';

  var stack = document.querySelector('.chapter-main:not(.library-main) .image-stack');
  if (!stack) return; // chapter 4 (print) / library / other pages are unaffected

  // --- Zoom button (circle + plus) ---
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'zoom-btn';
  btn.setAttribute('aria-label', 'Enlarge image');
  btn.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" ' +
    'aria-hidden="true"><path d="M8 2.5v11M2.5 8h11"/></svg>';
  document.body.appendChild(btn);

  // --- Scroll-down hint (thin bottom chevron, prompts to scroll to the detail) ---
  var hint = document.createElement('div');
  hint.className = 'scroll-down-hint';
  hint.setAttribute('aria-hidden', 'true');
  hint.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" ' +
    'aria-hidden="true"><path d="M3 5 L8 11 L13 5"/></svg>';
  document.body.appendChild(hint);

  var cardSelected = false;
  var atBottom = false;

  function updateHint() {
    hint.classList.toggle('is-visible', cardSelected && !atBottom);
  }

  // Hide the hint once the page is scrolled to (near) the bottom — the detail it
  // points to is then in view, so the prompt is no longer needed.
  function onScroll() {
    var doc = document.scrollingElement || document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    atBottom = max > 0 && window.scrollY >= max - 40;
    updateHint();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  // --- Overlay (white, image contained, close button) ---
  var overlay = document.createElement('div');
  overlay.className = 'zoom-overlay';
  var figure = document.createElement('img');
  figure.className = 'zoom-img';
  figure.alt = '';
  var close = document.createElement('button');
  close.type = 'button';
  close.className = 'zoom-close';
  close.setAttribute('aria-label', 'Close');
  close.innerHTML =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" ' +
    'aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>';
  overlay.appendChild(figure);
  overlay.appendChild(close);
  document.body.appendChild(overlay);

  function activeCard() {
    if (!stack.classList.contains('selected')) return null;
    return stack.querySelector('.stack-card.active');
  }

  function sync() {
    var card = activeCard();
    cardSelected = !!card;
    if (card) {
      btn.classList.add('is-visible');
      btn._src = card.currentSrc || card.src;
    } else {
      btn.classList.remove('is-visible');
      btn._src = null;
    }
    updateHint();
  }

  // Track selection no matter how it changes (click, Library deep-link #image=,
  // view toggle, deselect) — the MutationObserver watches the .selected /
  // .active class toggles on the stack and its cards.
  var mo = new MutationObserver(sync);
  mo.observe(stack, { attributes: true, attributeFilter: ['class'], subtree: true });

  function open() {
    if (!btn._src) return;
    figure.src = btn._src;
    overlay.classList.add('is-open');
    document.documentElement.classList.add('zoom-open');
  }

  function closeZoom() {
    overlay.classList.remove('is-open');
    document.documentElement.classList.remove('zoom-open');
    // Release the image after the fade-out so the next open re-triggers a paint.
    setTimeout(function () {
      if (!overlay.classList.contains('is-open')) figure.removeAttribute('src');
    }, 300);
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    e.preventDefault();
    open();
  });

  // Clicking anywhere in the overlay (backdrop, image, or the × button) closes it.
  overlay.addEventListener('click', closeZoom);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') closeZoom();
  });

  sync();
})();
