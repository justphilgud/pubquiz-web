"""Small JSON adapter around Spotify Basic Pitch for the local prototype."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys
import tempfile
import ctypes
from ctypes import wintypes

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
os.environ.setdefault("PYTHONHASHSEED", "0")


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def peak_rss_bytes() -> int:
    if sys.platform == "win32":
        class ProcessMemoryCounters(ctypes.Structure):
            _fields_ = [
                ("cb", wintypes.DWORD),
                ("PageFaultCount", wintypes.DWORD),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
                ("PrivateUsage", ctypes.c_size_t),
            ]
        counters = ProcessMemoryCounters()
        counters.cb = ctypes.sizeof(counters)
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        kernel32.GetCurrentProcess.restype = wintypes.HANDLE
        get_process_memory_info = psapi.GetProcessMemoryInfo
        get_process_memory_info.argtypes = [wintypes.HANDLE, ctypes.POINTER(ProcessMemoryCounters), wintypes.DWORD]
        get_process_memory_info.restype = wintypes.BOOL
        handle = kernel32.GetCurrentProcess()
        if get_process_memory_info(handle, ctypes.byref(counters), counters.cb):
            return int(counters.PeakWorkingSetSize)
        return 0
    try:
        import resource

        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return int(value if sys.platform == "darwin" else value * 1024)
    except ImportError:
        return 0


def main() -> int:
    arguments = parse_arguments()
    input_path = Path(arguments.input).resolve()
    output_path = Path(arguments.output).resolve()
    if not input_path.is_file() or not output_path.parent.is_dir():
        return 2

    try:
        from basic_pitch import ICASSP_2022_MODEL_PATH
        from basic_pitch.inference import Model, predict

        model = Model(ICASSP_2022_MODEL_PATH)
        _, midi_data, note_events = predict(str(input_path), model)
        notes = []
        for event in note_events:
            start_seconds, end_seconds, pitch, amplitude, _pitch_bends = event
            notes.append(
                {
                    "startSeconds": float(start_seconds),
                    "endSeconds": float(end_seconds),
                    "midi": int(pitch),
                    "confidence": max(0.0, min(1.0, float(amplitude))),
                }
            )
        midi_event_count = sum(len(instrument.notes) for instrument in midi_data.instruments)
        payload = {
            "notes": notes,
            "midiEventCount": midi_event_count,
            "runtime": ICASSP_2022_MODEL_PATH.suffix.removeprefix("."),
            "peakRssBytes": peak_rss_bytes(),
        }
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=output_path.parent, suffix=".json") as temporary:
            json.dump(payload, temporary, ensure_ascii=True, separators=(",", ":"))
            temporary_path = Path(temporary.name)
        temporary_path.replace(output_path)
        return 0
    except Exception:
        print(json.dumps({"ok": False, "code": "BASIC_PITCH_FAILED"}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
