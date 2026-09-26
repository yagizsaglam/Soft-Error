import os, sys, shutil
from PIL import Image, ImageStat

SRC = r"G:\RC6Term4\Term4\code\webpics\portfolio"
BAK = r"G:\RC6Term4\Term4\code\webpics\portfolio_spreads"

ANALYZE = "--analyze" in sys.argv
EXECUTE = "--execute" in sys.argv

files = sorted(f for f in os.listdir(SRC) if f.lower().endswith(".jpg"))
print(f"found {len(files)} spread images")

def stats(im):
    g = im.convert("L").resize((120, 120))
    s = ImageStat.Stat(g)
    return round(s.mean[0], 1), round(s.stddev[0], 1)

report = []
blank_threshold = 8.0  # stddev below this ~ uniform (blank/black) half

for f in files:
    im = Image.open(os.path.join(SRC, f))
    W, H = im.size
    left = im.crop((0, 0, W // 2, H))
    right = im.crop((W // 2, 0, W, H))
    lm, ls = stats(left)
    rm, rs = stats(right)
    lblank = ls < blank_threshold
    rblank = rs < blank_threshold
    report.append((f, W, H, lm, ls, lblank, rm, rs, rblank))

if ANALYZE:
    print(f"\n{'file':<14}{'WxH':<12}{'L mean/std':<14}{'Lblank':<8}{'R mean/std':<14}{'Rblank'}")
    for f, W, H, lm, ls, lb, rm, rs, rb in report:
        print(f"{f:<14}{W}x{H:<6}{str(lm)+'/'+str(ls):<14}{str(lb):<8}{str(rm)+'/'+str(rs):<14}{rb}")
    nb = sum(1 for r in report if r[5] or r[8])
    print(f"\nspreads with >=1 near-blank half: {nb}")
    sys.exit(0)

if EXECUTE:
    # Read every spread from the untouched backup (never read+write the same dir).
    bak_files = sorted(f for f in os.listdir(BAK) if f.lower().endswith(".jpg"))
    if len(bak_files) != len(files):
        print("backup count mismatch; run again to re-backup", file=sys.stderr)
        sys.exit(1)

    # Clear the destination directory, then write 222 halves from the backup.
    for f in os.listdir(SRC):
        os.remove(os.path.join(SRC, f))

    # page naming: spread i -> left=page_{2i-1}, right=page_{2i}
    for idx, f in enumerate(bak_files, start=1):
        im = Image.open(os.path.join(BAK, f))
        W, H = im.size
        left = im.crop((0, 0, W // 2, H))
        right = im.crop((W // 2, 0, W, H))
        left.save(os.path.join(SRC, f"page_{2*idx-1:03d}.jpg"), quality=92)
        right.save(os.path.join(SRC, f"page_{2*idx:03d}.jpg"), quality=92)

    newfiles = sorted(os.listdir(SRC))
    print(f"wrote {len(newfiles)} single-page images; first={newfiles[0]} last={newfiles[-1]}")
    sys.exit(0)

print("usage: pass --analyze or --execute")
