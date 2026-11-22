#!/usr/bin/env python3
"""Generate a grayscale alpha matte with rembg.

Video mode reads raw RGB frames from stdin and writes raw gray frames to stdout.
Image mode reads one image and saves a grayscale PNG matte.
"""
import argparse
import sys

from PIL import Image
from rembg import new_session, remove


def read_exact(stream, size):
    parts = []
    left = size
    while left > 0:
        chunk = stream.read(left)
        if not chunk:
            break
        parts.append(chunk)
        left -= len(chunk)
    return b"".join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--width", type=int, default=0)
    ap.add_argument("--height", type=int, default=0)
    ap.add_argument("--image")
    ap.add_argument("--output")
    args = ap.parse_args()

    session = new_session(args.model)

    if args.image:
        im = Image.open(args.image).convert("RGBA")
        if args.width and args.height:
            im = im.resize((args.width, args.height), Image.LANCZOS)
        cut = remove(im, session=session)
        cut.getchannel("A").save(args.output)
        print("ok", file=sys.stderr)
        return

    if not args.width or not args.height:
        raise SystemExit("--width and --height are required for video mode")
    frame_size = args.width * args.height * 3
    out = sys.stdout.buffer
    count = 0
    while True:
        raw = read_exact(sys.stdin.buffer, frame_size)
        if len(raw) < frame_size:
            break
        im = Image.frombytes("RGB", (args.width, args.height), raw)
        cut = remove(im, session=session)
        out.write(cut.getchannel("A").tobytes())
        out.flush()
        count += 1
    print(f"frames={count}", file=sys.stderr)


if __name__ == "__main__":
    main()
