# SOFT ERROR — UCL Bartlett RC6

Multi-page architecture portfolio website for UCL Bartlett RC6 Material Architecture Lab.

## Quick Start
- Open `index.html` directly in browser (no server needed for static pages, fully offline)
- Chapter 4's 3D print sequence needs a local server (see below)
- All assets local: fonts in `fonts/`, scripts in `js/`, images in `webpics/`

## File Structure

```
code/
├── index.html             ← Main homepage (canvas lens + scroll phases)
├── chapter1.html          ← Chapter 1: Foundational Research
├── chapter2.html          ← Chapter 2: Material Language + Interaction Studies
├── chapter3.html          ← Chapter 3: Scaling + Structural Test
├── chapter4.html          ← Chapter 4: Digital Platform Development
├── chapter5.html          ← Chapter 5: Large-Scale Prototype Production
├── chapter6.html          ← Chapter 6: Future Development
├── chapter4/              ← Chapter 4 isolated (editable independently of other chapters)
│   ├── chapter4.css       ← Print-sequence styles (own stylesheet, not in style.css)
│   ├── chapter4.js        ← Three.js print-sequence module
│   └── models/            ← scene_web.glb, points.glb, fun.glb, schedule.json
├── css/
│   ├── style.css          ← Shared styles (design system, homepage, chapters)
│   └── fonts.css          ← Local @font-face declarations (Inter, JetBrains Mono)
├── js/
│   ├── home.js            ← Homepage canvas lens, scroll effects, credits interactivity
│   ├── lenis.min.js       ← Lenis smooth scroll v1.3.25 (local copy)
│   ├── main.js            ← Legacy (original SPA, not used)
│   └── three/             ← three.js (shared: chapter1 oyster.glb + chapter4 print)
├── fonts/
│   ├── LLDCL-1.ttf        ← Letterform Variations (Nigel Cottier) — custom stencil font
│   └── *.ttf              ← Inter (400-900) + JetBrains Mono (400,500)
├── webpics/
│   ├── cover.png          ← Hero image (5184×3456)
│   ├── coverun.png        ← Hidden image revealed by mouse lens
│   ├── homepld.png        ← Default credits panel image
│   ├── homepld1-5.png     ← Per-team-member hover images
│   ├── homepld.psd        ← Source PSD
│   └── font.jpg           ← Font specimen reference
└── images/pages/          ← 53 WebP pages (page_001.webp to page_053.webp) from original project
```

## Design System

| Token | Value |
|-------|-------|
| `--red` | `#e00000` |
| `--font-stencil` | `'Letterform Variations'` (LLDCL-1.ttf) |
| `--font-sans` | `'Inter'` |
| `--font-mono` | `'JetBrains Mono'` |
| `--yellow` | `#ffd500` (SOFT ERROR title, hover states) |

- Black background in phase 2 (credits panel), white text
- Crosshair cursor (white SVG) on credits panel
- All transitions use cubic-bezier easing

## Homepage Architecture (index.html + home.js)

### Phase 0: Hero (scrollY = 0)
- Full-screen canvas showing `cover.png`
- Mouse lens: irregular blob (~155px radius) reveals `coverun.png` underneath
- Decaying persistence trail (destination-out on offscreen canvas, DECAY_RATE = 0.035)
- Blob morphs via multi-octave sine noise (90 segments, 0.58–1.12× radius)
- "SOFT ERROR" title: yellow, LLDCL font, centered
- Top-left: "BSA" (yellow), Top-right: "RC6" (black), both LLDCL font
- Top-center: "SOFT ERROR" (hidden initially, appears with chapters)

### Phase 1: Scroll Reveal (scrollY 0 → 0.8vh)
- Red overlay (multiply blend) fades in: `p1 = scrollY / (vh * 0.8)`
- Hero title fades out + moves up slightly
- BSA/RC6 labels transition to white (complete by p1=0.3)
- Chapter links reveal sequentially (staggered by 0.14 each)
- Top-center SOFT ERROR label fades in (p1 0.5→1.0)
- Scroll hint fades out

### Phase 2: Credits Reveal (scrollY 1.5vh → 4.5vh)
- Canvas fades out via `canvasOpacity` (globalAlpha)
- Red overlay fades with `(1-p2)` multiplier
- Chapter list + links fade out
- Credits panel fades in (black background, p2 0→0.4 range)
- At bottom: force p2=1

### Credits Panel
- Three-column layout: TUTORS (left) | Image (center) | TEAM (right)
- Team members: Jiaxuan Zhou, Kyle Feuer, Xiaoyue Li, Fiza Salim, Yagiz Saglam
- Team member hover: name gets white bg + black text, email slides out (Xiaoyue Li: good_eric@163.com)
- Center image: crossfades between homepld1-5.png on team hover (dual overlay technique)
- Center image: 3D tilt on mouse move (max 30°, perspective 800px)
- "BACK TO CONTENT" link scrolls to phase 1 end via Lenis
- Top labels (BSA, SOFT ERROR, RC6) stay visible at z-index 6

### Phase 1 End (0.8vh) — Chapter Link State
- Chapter links visible, clickable → navigate to chapter1-6.html
- Red overlay at full, BSA/RC6/SOFT ERROR all white
- Chapter pages link back via `index.html#phase1`

## Chapter Pages (chapter1-6.html)
- Header: "SOFT ERROR" logo (links to index.html#phase1) + chapter number
- Hero section: chapter title in LLDCL font
- Chapter content area (some chapters still empty, ready for content)
- Bottom nav: Previous/Next chapter links (Chapter 1: next only, Chapter 6: prev only)
- Each has independent Lenis instance
- Chapter 4 is the exception: its print-sequence CSS/JS/models live in `chapter4/`, not the shared files

## Key Technical Details

### Canvas Lens System (home.js)
- Two offscreen canvases: `offCover` (cover.png) and `offCoverUn` (coverun.png)
- `persistCanvas`: accumulates white blob drawings, decays via destination-out each frame
- `blurCanvas`: blurred version of persistCanvas for soft edges (BLUR_RADIUS=24)
- `tempCanvas`: composite — cover.png with blurred mask punched out via destination-out
- Final render: coverun.png base + tempCanvas on top, both at globalAlpha = canvasOpacity
- Lens stops rendering when canvasOpacity ≤ 0.005
- Continuous render loop merged with Lenis RAF

### Scroll Mechanics
- Scroll spacer: 400vh
- Phase 1 range: 0 → 0.8vh (red overlay + title fade + chapter reveal)
- Phase 2 range: 1.5vh → 4.5vh (canvas fade + credits reveal)
- Lenis duration: 1.2s, custom easing
- atBottom detection forces p2=1 within 5px of document bottom

### Crossfade System (dual overlay)
- Two overlay images stacked on base image with position:absolute
- On name hover: dormant overlay gets new src + fades in, after 300ms old overlay hides instantly
- Transitions between names toggle overlay A/B for true crossfade
- Mouseleave uses 150ms delay to prevent flicker between adjacent names

### Chapter 4 Print Sequence (chapter4/)
- `chapter4/chapter4.js`: scroll-driven Three.js build (deposition + formwork release)
- Loads `chapter4/models/*.glb` + `chapter4/models/schedule.json`
- Requires a local server (fetch() blocked over file://); rebuild the single-file offline version with `node tools/build_standalone.js .`
- `chapter4/chapter4.css`: all print-sequence styles (isolated from shared style.css)

### Font Loading
- Letterform Variations: `fonts/LLDCL-1.ttf` (@font-face in style.css)
- Inter + JetBrains Mono: local files in `fonts/`, declared in `css/fonts.css`
- All fonts loaded locally — no CDN dependencies

## Navigation Flow
```
index.html (hero)
  ↓ scroll
index.html (phase 1 end — chapter links)
  ↓ click chapter
chapterN.html
  ↓ click "SOFT ERROR" logo
index.html#phase1 (back to chapter links state)
  ↓ scroll further
index.html (phase 2 — credits)
  ↓ click "BACK TO CONTENT"
index.html (phase 1 end)
```

## Collaboration Note (Chapter 4 isolation)
Chapter 4's CSS, JS, and models are isolated in `chapter4/` so it can be edited
independently of the other chapters. Editing Chapter 4 touches only
`chapter4.html` + `chapter4/`; editing other chapters touches `chapter1-3,5,6.html`
+ `css/style.css` + `index.html`. The two sets of files don't overlap, so
simultaneous GitHub pushes won't conflict.
