/* Builds chapter4_standalone.html — one self-contained file that opens by
   double-click over file://, with no server and no network.

   Everything the page fetches at runtime gets inlined:
     css/style.css + css/fonts.css  -> <style>, font .ttf -> data: URIs
     js/lenis.min.js                -> inline classic <script>
     three.module.js / GLTFLoader   -> data: URIs in the import map
     chapter4/models/*.glb                   -> base64 -> loader.parseAsync()
     chapter4/models/schedule.json           -> inline JS object
*/
const fs = require('fs');
const path = require('path');

const SITE = process.argv[2];
const OUT  = path.join(SITE, 'chapter4_standalone.html');

const read = p => fs.readFileSync(path.join(SITE, p));
const b64  = p => read(p).toString('base64');
const js   = p => 'data:text/javascript;base64,' + b64(p);

// ---- 1. CSS, with the fonts folded in ------------------------------------
// only the weights the chapter page actually uses (400-700) — 800/900 are
// homepage-only and would add ~600KB for nothing
const KEEP_FONTS = [
  'LLDCL-1.ttf',
  'UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf', // Inter 400
  'UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf', // Inter 500
  'UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf', // Inter 600
  'UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf', // Inter 700
  'tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPQ.ttf',      // JetBrains Mono 400
  'tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8-qxjPQ.ttf'       // JetBrains Mono 500
];
const fontData = new Map();
for (const f of KEEP_FONTS) {
  fontData.set(f, 'data:font/ttf;base64,' + b64(path.join('fonts', f)));
}

function inlineFonts(css) {
  // rewrite url(../fonts/X.ttf) and url(fonts/X.ttf) to the data: URI,
  // and drop any @font-face whose file we deliberately left out
  css = css.replace(/url\(\s*['"]?\.{0,2}\/?fonts\/([^'")]+)['"]?\s*\)/g, (m, file) => {
    const d = fontData.get(file);
    return d ? `url(${d})` : '__DROP_FACE__';
  });
  css = css.replace(/@font-face\s*\{[^}]*__DROP_FACE__[^}]*\}/g, '');
  return css;
}

const styleCss = inlineFonts(read('css/style.css').toString('utf8'));
const fontsCss = inlineFonts(read('css/fonts.css').toString('utf8'));
const chapter4Css = read('chapter4/chapter4.css').toString('utf8');

// ---- 2. three.js as data: URIs in the import map --------------------------
// GLTFLoader reaches for '../utils/BufferGeometryUtils.js', which cannot
// resolve from a data: URL (no base to be relative to) — so make it bare and
// map it alongside the others.
const bgu = read('js/three/utils/BufferGeometryUtils.js').toString('utf8');
let gltf  = read('js/three/loaders/GLTFLoader.js').toString('utf8');
gltf = gltf.replace(
  /from\s+['"]\.\.\/utils\/BufferGeometryUtils\.js['"]/,
  "from 'three/addons/utils/BufferGeometryUtils.js'"
);

const asData = src => 'data:text/javascript;base64,' + Buffer.from(src, 'utf8').toString('base64');
const importmap = {
  imports: {
    'three': js('js/three/three.module.js'),
    'three/addons/loaders/GLTFLoader.js': asData(gltf),
    'three/addons/utils/BufferGeometryUtils.js': asData(bgu)
  }
};

// ---- 3. assemble ----------------------------------------------------------
let html = read('chapter4.html').toString('utf8');
let chapterJs = read('chapter4/chapter4.js').toString('utf8');

html = html.replace(
  '  <link rel="stylesheet" href="css/style.css">\n  <link rel="stylesheet" href="css/fonts.css">\n  <link rel="stylesheet" href="chapter4/chapter4.css">',
  `  <style>\n${fontsCss}\n${styleCss}\n${chapter4Css}\n</style>`
);

html = html.replace(
  '  <script src="js/lenis.min.js"></script>',
  `  <script>\n${read('js/lenis.min.js').toString('utf8')}\n  </script>`
);

html = html.replace(
  /<script type="importmap">[\s\S]*?<\/script>/,
  `<script type="importmap">\n${JSON.stringify(importmap)}\n  </script>\n` +
  `  <script>\n` +
  `  // the two .glb files and the deposit schedule, carried in the page itself\n` +
  `  window.__SCHEDULE__   = ${read('chapter4/models/schedule.json').toString('utf8')};\n` +
  `  window.__GLB_POINTS__ = "${b64('chapter4/models/points.glb')}";\n` +
  `  window.__GLB_SCENE__  = "${b64('chapter4/models/scene_web.glb')}";\n` +
  `  window.__GLB_FUN__    = "${b64('chapter4/models/fun.glb')}";\n` +
  `  window.__b64buf = function (s) {\n` +
  `    const bin = atob(s), len = bin.length, u8 = new Uint8Array(len);\n` +
  `    for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);\n` +
  `    return u8.buffer;\n` +
  `  };\n` +
  `  </script>`
);

// runtime loads: parse the inlined buffers instead of fetching files
const loadBlock = /Promise\.all\(\[\s*fetch\('chapter4\/models\/schedule\.json'\)[\s\S]*?loader\.loadAsync\('chapter4\/models\/fun\.glb'\)\s*\]\)/;
if (!loadBlock.test(chapterJs)) throw new Error('load block not found — chapter4/chapter4.js shape changed');
chapterJs = chapterJs.replace(
  loadBlock,
  `Promise.all([\n` +
  `      Promise.resolve(window.__SCHEDULE__),\n` +
  `      loader.parseAsync(window.__b64buf(window.__GLB_POINTS__), ''),\n` +
  `      loader.parseAsync(window.__b64buf(window.__GLB_SCENE__), ''),\n` +
  `      loader.parseAsync(window.__b64buf(window.__GLB_FUN__), '')\n` +
  `    ])`
);

// inline the (now patched) print-sequence module back into the page
html = html.replace(
  '  <script type="module" src="chapter4/chapter4.js"></script>',
  `  <script type="module">\n${chapterJs}\n  </script>`
);

// the "run a local server" branch no longer applies to this build
html = html.replace(
  /if \(location\.protocol === 'file:'\) \{[\s\S]*?\} else \{[\s\S]*?\}\s*\}/,
  `loadingEl.textContent = 'Could not build the scene — ' + msg;\n    }`
);

html = html.replace(
  '<title>Chapter 4 — Digital Platform Development</title>',
  '<title>Chapter 4 — Digital Platform Development (standalone)</title>'
);

// sanity: nothing should still point at a file we did not inline
const leftovers = [...html.matchAll(/(?:src|href)="(?!data:|#|http)([^"]+)"/g)]
  .map(m => m[1])
  .filter(u => !/^chapter\d\.html|^index\.html/.test(u));

fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB');
console.log('remaining external refs:', leftovers.length ? leftovers.join(', ') : '(none but page links)');
