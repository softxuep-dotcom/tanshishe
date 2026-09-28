"""Build the in-game Chen Ye sprite sheet from the three Doubao videos (walk, run, idle + 3-hit combo).

Every frame is cut out of its flat background (shadow included), scaled so the head is the same size
in all three videos, anchored at a fixed foot point per video, reduced by block majority vote to a
shared palette, and packed into 128x96 cells (anchor 48,90) as ANIMATION_SPEC.md specifies.

Run:  python scripts/art/build_chen_sprites.py   (about two minutes)
Out:  game/street/sprites/chen.png  +  output/art/chen/sprites-v1/ (previews, frames.json; not tracked)
"""
from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image, ImageDraw
from chen_frames import read_video, cutout

ROOT = Path(__file__).resolve().parents[2]
GAME_SHEET = ROOT / 'game' / 'street' / 'sprites' / 'chen.png'
OUT = ROOT / 'output' / 'art' / 'chen' / 'sprites-v1'
CELL_W, CELL_H, ANCHOR_X, ANCHOR_Y = 128, 96, 48, 90
# Standing height in logical pixels for the combo's guard stance (ANIMATION_SPEC: about 64).
STAND_HEIGHT = 64
PALETTE_SIZE = 32
COLUMNS = 8

# head_px: crown to lowest face pixel, measured in each video; it normalises the three videos' scale.
VIDEOS = {
    'combo': dict(path='E:/LocalData/web/Downloads/陈野四视图生成跑步视频 (8).mp4', head_px=259, stand_px=579),
    'walk': dict(path=str(ROOT / 'output' / 'art' / 'chen' / '生成陈野像素走路循环视频 (3).mp4'), head_px=235),
    'run': dict(path='E:/LocalData/web/Downloads/陈野四视图生成跑步视频.mp4', head_px=252),
}
BASE_SCALE = STAND_HEIGHT / VIDEOS['combo']['stand_px'] * VIDEOS['combo']['head_px']

# Hand-picked source frames (zero-based). See output/art/chen/combo-v1/candidates.jpg for the reasoning.
ATTACKS = {
    'jab': [20, 22, 50, 54],        # guard -> lead hand out -> half back -> guard
    'cross': [81, 83, 114, 116],    # rear hand cocked, hips turning -> full reach -> fist back at chest -> guard
    'uppercut': [150, 200, 203, 206],  # deep crouch -> fist over head (200: same pose as 170 without the drawn swoosh) -> coming down -> guard
}
ORDER = ['idle', 'walk', 'run', 'jab', 'cross', 'uppercut']


def find_cycle(frames, masks, lo, hi, pmin, pmax):
    """Loop start and period with the most similar seam inside [lo, hi)."""
    small = [cv2.resize(np.where(m[..., None], f, 0), (80, 45), interpolation=cv2.INTER_AREA).astype(np.float32) for f, m in zip(frames, masks)]
    best = None
    for p in range(pmin, pmax + 1):
        for s in range(lo, hi - p - 1):
            score = np.mean([np.abs(small[s + d] - small[s + p + d]).mean() for d in (0, 1)])
            if best is None or score < best[0]: best = (score, s, p)
    return best[1], best[2]


def torso_x(mask):
    ys, xs = np.where(mask); top, bottom = ys.min(), ys.max(); h = bottom - top
    band = (ys > top + h * .35) & (ys < top + h * .6)
    return float(xs[band].mean())


def reference(masks, idx):
    """Fixed anchor per video: median torso x, and the ground line where the planted feet sit."""
    xs = [torso_x(masks[i]) for i in idx]
    bottoms = [np.where(masks[i])[0].max() for i in idx]
    return float(np.median(xs)), float(np.percentile(bottoms, 90))


def render(frame, mask, scale, ax, gy, palette):
    """Block majority vote into one cell. Returns RGBA uint8 (CELL_H, CELL_W, 4)."""
    step = 1 / scale
    x0, y0 = ax - ANCHOR_X * step, gy + 1 - ANCHOR_Y * step
    xe = np.floor(x0 + np.arange(CELL_W + 1) * step).astype(int)
    ye = np.floor(y0 + np.arange(CELL_H + 1) * step).astype(int)
    # Only the cell's source window is classified; the rest of the 1280x720 frame is never needed.
    cx0, cy0 = max(0, xe[0]), max(0, ye[0])
    frame, mask = frame[cy0:max(cy0, ye[-1])], mask[cy0:max(cy0, ye[-1])]
    frame, mask = frame[:, cx0:max(cx0, xe[-1])], mask[:, cx0:max(cx0, xe[-1])]
    xe, ye = xe - cx0, ye - cy0
    h, w = mask.shape
    smooth = cv2.medianBlur(np.ascontiguousarray(frame), 3).reshape(-1, 3).astype(np.float32)
    index = np.full(h * w, -1)
    solid_px = mask.ravel()
    index[solid_px] = np.argmin(((smooth[solid_px][:, None, :] - palette[None]) ** 2).sum(2), 1)
    index = index.reshape(h, w)
    out = np.zeros((CELL_H, CELL_W, 4), np.uint8)
    for j in range(CELL_H):
        ya, yb = max(0, ye[j]), min(h, ye[j + 1])
        if yb <= ya: continue
        for i in range(CELL_W):
            xa, xb = max(0, xe[i]), min(w, xe[i + 1])
            if xb <= xa: continue
            block = index[ya:yb, xa:xb].ravel()
            solid = block[block >= 0]
            if solid.size * 2 < block.size: continue
            out[j, i, :3] = palette[np.bincount(solid).argmax()]
            out[j, i, 3] = 255
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    clips, picks, meta = {}, {}, {}
    for name, v in VIDEOS.items():
        frames = read_video(v['path'])
        masks = [cutout(f) for f in frames]
        clips[name] = (frames, masks)
    # Loops: idle from the combo's closing guard, walk and run from their steady middle.
    combo_f, combo_m = clips['combo']
    s, p = find_cycle(combo_f, combo_m, 208, 241, 10, 22)
    picks['idle'] = ('combo', [s + round(k * p / 4) for k in range(4)])
    for name, lo, hi, pmin, pmax in [('walk', 2, 70, 18, 32), ('run', 2, 70, 10, 24)]:
        s, p = find_cycle(*clips[name], lo, hi, pmin, pmax)
        picks[name] = (name, [s + round(k * p / 6) for k in range(6)])
        meta[name + '_cycle'] = dict(start=s, period=p, seconds=p / 24)
    for name, idx in ATTACKS.items(): picks[name] = ('combo', idx)

    # One palette for every frame so the three videos share colours.
    samples = []
    rng = np.random.default_rng(7)
    for anim in ORDER:
        clip, idx = picks[anim]
        frames, masks = clips[clip]
        for i in idx:
            px = cv2.medianBlur(frames[i], 3)[masks[i]]
            samples.append(px[rng.choice(len(px), min(len(px), 6000), replace=False)])
    data = np.concatenate(samples).astype(np.float32)
    cv2.setRNGSeed(7)  # same palette on every rebuild
    _, _, palette = cv2.kmeans(data, PALETTE_SIZE, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, .5), 4, cv2.KMEANS_PP_CENTERS)

    anchors = {
        'combo': reference(combo_m, picks['idle'][1]),
        'walk': reference(clips['walk'][1], picks['walk'][1]),
        'run': reference(clips['run'][1], picks['run'][1]),
    }
    cells, layout = [], {}
    for anim in ORDER:
        clip, idx = picks[anim]
        frames, masks = clips[clip]
        scale = BASE_SCALE / VIDEOS[clip]['head_px']
        ax, gy = anchors[clip]
        layout[anim] = list(range(len(cells), len(cells) + len(idx)))
        for i in idx: cells.append(render(frames[i], masks[i], scale, ax, gy, palette))

    rows = (len(cells) + COLUMNS - 1) // COLUMNS
    sheet = np.zeros((rows * CELL_H, COLUMNS * CELL_W, 4), np.uint8)
    for n, cell in enumerate(cells):
        r, c = divmod(n, COLUMNS)
        sheet[r * CELL_H:(r + 1) * CELL_H, c * CELL_W:(c + 1) * CELL_W] = cell
    GAME_SHEET.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet, 'RGBA').save(GAME_SHEET, optimize=True)

    # Previews: 4x sheet on the game's street colour with anchors marked, and one GIF per animation.
    big = Image.new('RGBA', (sheet.shape[1] * 4, sheet.shape[0] * 4), (52, 57, 70, 255))
    big.alpha_composite(Image.fromarray(sheet, 'RGBA').resize(big.size, Image.NEAREST))
    d = ImageDraw.Draw(big)
    for n in range(len(cells)):
        r, c = divmod(n, COLUMNS)
        x, y = (c * CELL_W + ANCHOR_X) * 4, (r * CELL_H + ANCHOR_Y) * 4
        d.line((x - 8, y, x + 8, y), fill=(255, 120, 120)); d.line((x, y - 8, x, y + 8), fill=(255, 120, 120))
        d.rectangle((c * CELL_W * 4, r * CELL_H * 4, (c + 1) * CELL_W * 4 - 1, (r + 1) * CELL_H * 4 - 1), outline=(80, 90, 110))
    big.save(OUT / 'sheet-4x.png')
    timing = {'idle': [160] * 4, 'walk': [100] * 6, 'run': [70] * 6, 'jab': [50, 45, 90, 85], 'cross': [60, 50, 80, 80], 'uppercut': [75, 65, 100, 100]}
    for anim in ORDER:
        ims = []
        for n in layout[anim]:
            bg = Image.new('RGBA', (CELL_W * 3, CELL_H * 3), (52, 57, 70, 255))
            bg.alpha_composite(Image.fromarray(cells[n], 'RGBA').resize(bg.size, Image.NEAREST))
            ims.append(bg.convert('P', palette=Image.ADAPTIVE))
        # Attacks are slowed 4x in the preview so each pose can be seen; loops play at game speed.
        slow = 1 if anim in ('idle', 'walk', 'run') else 4
        ims[0].save(OUT / f'{anim}.gif', save_all=True, append_images=ims[1:], duration=[t * slow for t in timing[anim]], loop=0, disposal=2)
    meta.update(dict(stand_height=STAND_HEIGHT, cell=[CELL_W, CELL_H], anchor=[ANCHOR_X, ANCHOR_Y], columns=COLUMNS,
                     layout=layout, source_frames={a: dict(video=picks[a][0], frames=picks[a][1]) for a in ORDER},
                     anchors={k: [round(v[0], 1), round(v[1], 1)] for k, v in anchors.items()},
                     scales={k: BASE_SCALE / v['head_px'] for k, v in VIDEOS.items()}, palette=palette.round().astype(int).tolist()))
    (OUT / 'frames.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps({k: meta[k] for k in ('layout', 'source_frames', 'anchors', 'scales', 'walk_cycle', 'run_cycle')}, ensure_ascii=False))


if __name__ == '__main__':
    main()
