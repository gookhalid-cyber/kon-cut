#!/usr/bin/env python3
"""Local Arabic transcription with faster-whisper. Prints JSON to stdout."""
import argparse
import json
import os
import sys

import av

# faster-whisper passes metadata_errors= to av.open(), but PyAV 19+ removed
# that keyword. The WAV we feed it is produced locally by FFmpeg and has no
# broken metadata, so dropping the argument is safe on newer PyAV releases.
_orig_av_open = av.open


def _compat_av_open(*args, **kwargs):
    if "metadata_errors" in kwargs:
        try:
            return _orig_av_open(*args, **kwargs)
        except TypeError as exc:
            if "metadata_errors" not in str(exc):
                raise
            kwargs.pop("metadata_errors")
    return _orig_av_open(*args, **kwargs)


av.open = _compat_av_open

from faster_whisper import WhisperModel  # noqa: E402  (patch must come first)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("wav")
    ap.add_argument("--model", default="small")
    args = ap.parse_args()

    root = os.environ.get("KONCUT_MODELS_DIR")
    kwargs = dict(device="cpu", compute_type="int8")
    if root:
        os.makedirs(root, exist_ok=True)
        kwargs["download_root"] = root
    model = WhisperModel(args.model, **kwargs)
    segments, info = model.transcribe(
        args.wav, language="ar", vad_filter=True, beam_size=5
    )
    result = []
    for seg in segments:
        text = (seg.text or "").strip()
        if not text:
            continue
        result.append({
            "start": round(float(seg.start), 2),
            "end": round(float(seg.end), 2),
            "text": text,
        })
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise
