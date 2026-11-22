"""Generate original grayscale mask PNGs for Montaj Cut / Kon Cut."""
import math
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "masks")
os.makedirs(OUT, exist_ok=True)
S = 512
C = S // 2


def new():
    return Image.new("L", (S, S), 0)


def save(name, img):
    img.save(os.path.join(OUT, name + ".png"))
    print("mask", name)


# circle
img = new(); ImageDraw.Draw(img).ellipse([40, 40, S - 40, S - 40], fill=255); save("circle", img)

# rectangle
img = new(); ImageDraw.Draw(img).rectangle([60, 90, S - 60, S - 90], fill=255); save("rectangle", img)

# heart
img = new(); d = ImageDraw.Draw(img)
d.ellipse([70, 110, 256, 330], fill=255)
d.ellipse([256, 110, 442, 330], fill=255)
d.polygon([(70, 235), (442, 235), (256, 470)], fill=255)
save("heart", img)

# star
img = new(); pts = []
for i in range(10):
    a = -math.pi / 2 + i * math.pi / 5
    r = 230 if i % 2 == 0 else 98
    pts.append((C + r * math.cos(a), C + r * math.sin(a)))
ImageDraw.Draw(img).polygon(pts, fill=255); save("star", img)

# triangle
img = new(); ImageDraw.Draw(img).polygon([(C, 50), (S - 50, S - 70), (50, S - 70)], fill=255); save("triangle", img)

# diamond
img = new(); ImageDraw.Draw(img).polygon([(C, 30), (S - 40, C), (C, S - 30), (40, C)], fill=255); save("diamond", img)

# linear (top revealed, soft bottom edge)
img = Image.new("L", (S, S))
px = img.load()
for y in range(S):
    v = int(255 * max(0.0, min(1.0, (S * 0.78 - y) / (S * 0.42))))
    for x in range(S):
        px[x, y] = v
save("linear", img)

# mirror (two side circles)
img = new(); d = ImageDraw.Draw(img)
d.ellipse([30, 130, 250, 382], fill=255)
d.ellipse([262, 130, 482, 382], fill=255)
save("mirror", img)
