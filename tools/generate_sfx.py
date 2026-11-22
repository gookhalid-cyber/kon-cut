"""Generate small original WAV sound effects for Montaj Cut."""
import math
import os
import struct
import wave

OUT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "sfx")
os.makedirs(OUT, exist_ok=True)
SR = 44100


def write_wav(name, samples):
    path = os.path.join(OUT, name + ".wav")
    peak = max(1e-6, max(abs(s) for s in samples))
    data = b"".join(struct.pack("<h", int(max(-1, min(1, s / peak)) * 26000)) for s in samples)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)
    print(name, len(samples) / SR)


def env(i, n, attack=0.02, release=0.5):
    t = i / n
    a = min(1.0, t / attack) if attack else 1.0
    r = min(1.0, (1 - t) / release) if release else 1.0
    return a * r


# whoosh: filtered noise sweep
n = int(SR * 0.7)
s = []
prev = 0.0
for i in range(n):
    noise = math.sin(i * 12.9898) * 43758.5453
    noise = (noise - math.floor(noise)) * 2 - 1
    cutoff = 0.04 + 0.5 * (i / n)
    prev = prev * (1 - cutoff) + noise * cutoff
    s.append(prev * env(i, n, 0.08, 0.5) * 1.6)
write_wav("whoosh", s)

# pop: short pitched blip
n = int(SR * 0.18)
s = []
for i in range(n):
    t = i / SR
    f = 700 - 400 * (i / n)
    s.append(math.sin(2 * math.pi * f * t) * math.exp(-t * 22) * env(i, n, 0.005, 0.6))
write_wav("pop", s)

# click: tiny tick
n = int(SR * 0.06)
s = []
for i in range(n):
    t = i / SR
    s.append((math.sin(2 * math.pi * 1800 * t) * 0.7 + (math.sin(i * 7.0) * 0.3)) * math.exp(-t * 70))
write_wav("click", s)

# impact: low thump + noise
n = int(SR * 0.5)
s = []
for i in range(n):
    t = i / SR
    thump = math.sin(2 * math.pi * (90 - 50 * t) * t) * math.exp(-t * 9)
    noise = (math.sin(i * 3.7) * 43758.5) % 1 * 2 - 1
    s.append((thump + noise * math.exp(-t * 25) * 0.4) * env(i, n, 0.003, 0.7))
write_wav("impact", s)

# riser: rising tone + noise
n = int(SR * 1.0)
phase = 0.0
s = []
for i in range(n):
    t = i / n
    f = 180 + 900 * t * t
    phase += 2 * math.pi * f / SR
    s.append((math.sin(phase) * 0.6 + math.sin(phase * 1.5) * 0.2) * (t ** 1.5) * env(i, n, 0.1, 0.08))
write_wav("riser", s)

# ding: bell
n = int(SR * 0.9)
s = []
for i in range(n):
    t = i / SR
    v = (math.sin(2 * math.pi * 880 * t) + 0.5 * math.sin(2 * math.pi * 1320 * t) + 0.25 * math.sin(2 * math.pi * 1760 * t))
    s.append(v * math.exp(-t * 5) * env(i, n, 0.005, 0.9))
write_wav("ding", s)
