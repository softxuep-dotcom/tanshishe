"""Shared helpers: read a Doubao video, cut the character out of its flat gray-blue background."""
import cv2, numpy as np
from scipy import ndimage

def read_video(path):
    cap = cv2.VideoCapture(str(path)); frames = []
    while True:
        ok, bgr = cap.read()
        if not ok: break
        frames.append(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    cap.release(); return frames

def cutout(rgb):
    """Boolean character mask. Background and its drop shadow are the same hue at different brightness."""
    f = rgb.astype(np.float32)
    border = np.concatenate([f[:30].reshape(-1, 3), f[-30:].reshape(-1, 3), f[:, :40].reshape(-1, 3), f[:, -40:].reshape(-1, 3)])
    bg = np.median(border, 0)
    k = (f @ bg) / (bg @ bg)
    residual = np.linalg.norm(f - k[..., None] * bg, axis=2)
    bg_like = (residual < 16) & (k > .5) & (k < 1.15)
    labels, _ = ndimage.label(bg_like)
    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
    background = np.isin(labels, edge[edge > 0])
    fg = ~background
    fg = ndimage.binary_opening(fg, iterations=1)
    labels, n = ndimage.label(fg)
    if n == 0: return fg
    sizes = ndimage.sum(fg, labels, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    ys, xs = np.where(labels == main)
    x0, x1, y0, y1 = xs.min() - 30, xs.max() + 30, ys.min() - 30, ys.max() + 30
    keep = np.zeros(n + 1, bool); keep[main] = True
    # Detached bits (a fist between frames, loose hair) stay if they sit on the body; watermark corners do not.
    for i in range(1, n + 1):
        if sizes[i - 1] < 40 or i == main: continue
        yy, xx = np.where(labels == i)
        if x0 <= xx.mean() <= x1 and y0 <= yy.mean() <= y1: keep[i] = True
    return keep[labels]
