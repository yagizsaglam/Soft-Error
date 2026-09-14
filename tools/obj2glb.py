#!/usr/bin/env python3
"""F.U.N.obj (Rhino) -> chapter4/models/fun.glb

Keeps the OBJ's own vertex normals (the file pairs them 1:1 with positions),
de-duplicates on the (position, normal) pair, and recentres the result so the
model's origin sits at the centre of its own footprint, on its base. That way
the page can place it with a plain scale + y-offset.
"""
import json, struct, sys
import numpy as np

SRC = sys.argv[1]
DST = sys.argv[2]

pos, nrm, tri = [], [], []
with open(SRC, 'r') as fh:
    for line in fh:
        if line.startswith('v '):
            pos.append(line.split()[1:4])
        elif line.startswith('vn '):
            nrm.append(line.split()[1:4])
        elif line.startswith('f '):
            corners = []
            for tok in line.split()[1:]:
                bits = tok.split('/')
                vi = int(bits[0])
                ni = int(bits[2]) if len(bits) > 2 and bits[2] else vi
                corners.append((vi, ni))
            # fan-triangulate anything with more than 3 corners
            for k in range(1, len(corners) - 1):
                tri.append((corners[0], corners[k], corners[k + 1]))

pos = np.array(pos, dtype=np.float64)
nrm = np.array(nrm, dtype=np.float64) if nrm else None
print(f"parsed  {len(pos)} positions, {0 if nrm is None else len(nrm)} normals, {len(tri)} triangles")

# --- de-duplicate on the (position index, normal index) pair ----------------
corner_list = [c for t in tri for c in t]
uniq, inverse = np.unique(np.array(corner_list, dtype=np.int64), axis=0, return_inverse=True)
P = pos[uniq[:, 0] - 1]
N = nrm[uniq[:, 1] - 1] if nrm is not None else None
idx = inverse.astype(np.uint32)
print(f"welded  {len(P)} verts, {len(idx)//3} tris")

# --- recentre: x/z on the footprint centre, y so the base sits at 0 ---------
lo, hi = P.min(axis=0), P.max(axis=0)
P = P - np.array([(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2])
lo2, hi2 = P.min(axis=0), P.max(axis=0)
print(f"extent  {hi2 - lo2}")
print(f"origin  x/z centred, base at y=0  ->  lo {lo2}  hi {hi2}")

if N is not None:
    ln = np.linalg.norm(N, axis=1, keepdims=True)
    N = N / np.where(ln == 0, 1, ln)

# --- bake vertex colours ---------------------------------------------------
# The real panel is not one colour: it is banded, because the deposition
# alternates dark rubber-heavy layers with pale perlite/cement ones, and it is
# speckled on top of that. A flat fill reads as a black blob, so approximate
# the photograph with layered noise baked straight into COLOR_0.
DARK  = (0x14, 0x13, 0x12)   # near black
LIGHT = (0xe8, 0xe5, 0xde)   # near white
PATCH_FREQ = 0.014   # patch size — lower is bigger blobs (model is 1442 tall)
PATCH_OCT  = 3       # octaves; more makes the patch outlines more ragged
EDGE  = 0.045        # width of the black/white transition — smaller is harder
PALE  = 0.48         # fraction of the surface that comes out white


def fbm(pts, seed, base_freq, octaves=5, dirs=3):
    """Sum-of-sines value noise — no lattice needed, and deterministic."""
    rng = np.random.default_rng(seed)
    out = np.zeros(len(pts))
    amp, norm = 1.0, 0.0
    for k in range(octaves):
        f = base_freq * (2.0 ** k)
        for _ in range(dirs):
            v = rng.normal(size=3)
            v /= np.linalg.norm(v)
            out += amp * np.sin(pts @ v * f + rng.uniform(0, 2 * np.pi))
        norm += amp * dirs
        amp *= 0.55
    return out / norm                      # ~ -1 .. 1


def srgb_to_linear(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


# One low-frequency field, hard-thresholded. No height banding and no
# normal-based shading term — those produced the layered, flowy gradient. A
# single threshold gives flat regions of pure white and pure black with a
# definite line between them, and the extra octaves make that line ragged
# rather than a smooth blob outline.
n = fbm(P, 5, PATCH_FREQ, PATCH_OCT, 3)

# threshold at the quantile, so PALE is the exact share of the surface that
# turns white regardless of how the noise happens to be distributed
thresh = np.quantile(n, 1.0 - PALE)
w = EDGE * n.std()
t = np.clip((n - thresh) / (2 * w) + 0.5, 0, 1)
t = t * t * (3 - 2 * t)                    # smoothstep, but over a tiny span

lin_dark, lin_light = srgb_to_linear(DARK), srgb_to_linear(LIGHT)
C = np.clip(lin_dark + (lin_light - lin_dark) * t[:, None], 0, 1)
edge_frac = ((t > 0.02) & (t < 0.98)).mean() * 100
print(f"colour  {(t > 0.5).mean() * 100:.0f}% white, "
      f"{edge_frac:.1f}% of verts in transition (the rest is flat black or white)")

# --- pack GLB --------------------------------------------------------------
P32 = P.astype(np.float32)
buf, views, accs = bytearray(), [], []

def add(data, target):
    while len(buf) % 4:
        buf.append(0)
    off = len(buf)
    buf.extend(data.tobytes())
    views.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data.tobytes()), 'target': target})
    return len(views) - 1

vi = add(P32, 34962)
accs.append({'bufferView': vi, 'componentType': 5126, 'count': len(P32), 'type': 'VEC3',
             'min': P32.min(axis=0).tolist(), 'max': P32.max(axis=0).tolist()})
attrs = {'POSITION': 0}
if N is not None:
    ni = add(N.astype(np.float32), 34962)
    accs.append({'bufferView': ni, 'componentType': 5126, 'count': len(N), 'type': 'VEC3'})
    attrs['NORMAL'] = len(accs) - 1
ci = add(C.astype(np.float32), 34962)   # linear, per the glTF spec for COLOR_0
accs.append({'bufferView': ci, 'componentType': 5126, 'count': len(C), 'type': 'VEC3'})
attrs['COLOR_0'] = len(accs) - 1
ii = add(idx, 34963)
accs.append({'bufferView': ii, 'componentType': 5125, 'count': len(idx), 'type': 'SCALAR'})

gltf = {
    'asset': {'version': '2.0', 'generator': 'obj2glb (soft error)'},
    'scene': 0,
    'scenes': [{'nodes': [0]}],
    'nodes': [{'mesh': 0, 'name': 'FUN'}],
    'meshes': [{'name': 'FUN', 'primitives': [{'attributes': attrs, 'indices': len(accs) - 1}]}],
    'accessors': accs,
    'bufferViews': views,
    'buffers': [{'byteLength': len(buf)}],
}

js = json.dumps(gltf, separators=(',', ':')).encode('utf8')
js += b' ' * ((4 - len(js) % 4) % 4)
bn = bytes(buf) + b'\0' * ((4 - len(buf) % 4) % 4)

with open(DST, 'wb') as fh:
    fh.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bn)))
    fh.write(struct.pack('<II', len(js), 0x4E4F534A)); fh.write(js)
    fh.write(struct.pack('<II', len(bn), 0x004E4942)); fh.write(bn)

import os
print(f"wrote   {DST}  {os.path.getsize(DST)/1048576:.2f} MB")
