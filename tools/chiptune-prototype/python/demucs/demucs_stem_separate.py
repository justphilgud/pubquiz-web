"""Controlled offline Demucs adapter for the local PubQuiz research prototype."""

from __future__ import annotations

import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
import time

ALLOWED_MODEL = "htdemucs"
EXPECTED_STEMS = ("vocals", "bass", "drums", "other")
EXPECTED_MODEL_FILES = {
    "955717e8.safetensors": "d9fa14133cfcc034a6758923bb3a8ca9f8dfd0b582134643bbf83f72c17576dd",
    "htdemucs.yaml": "239c445d0b14454d541ad8bd9bb271c9e536d267e8a4625208744cbb2e7bb66c",
}


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--report", required=True)
    parser.add_argument("--models-dir", required=True)
    parser.add_argument("--model", required=True)
    return parser.parse_args()


def peak_rss_bytes() -> int:
    if sys.platform == "win32":
        class ProcessMemoryCounters(ctypes.Structure):
            _fields_ = [
                ("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD),
                ("PeakWorkingSetSize", ctypes.c_size_t), ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t), ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t), ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t), ("PeakPagefileUsage", ctypes.c_size_t),
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
        if get_process_memory_info(kernel32.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
            return int(counters.PeakWorkingSetSize)
        return 0
    try:
        import resource
        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return int(value if sys.platform == "darwin" else value * 1024)
    except ImportError:
        return 0


def write_json_atomic(path: Path, payload: dict[str, object]) -> None:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=path.parent, suffix=".json") as handle:
        json.dump(payload, handle, ensure_ascii=True, separators=(",", ":"))
        temporary_path = Path(handle.name)
    temporary_path.replace(path)


def model_files_are_valid(models_dir: Path) -> bool:
    for name, expected_hash in EXPECTED_MODEL_FILES.items():
        matches = list(models_dir.rglob(name))
        if len(matches) != 1 or hashlib.sha256(matches[0].read_bytes()).hexdigest() != expected_hash:
            return False
    return True


def main() -> int:
    arguments = parse_arguments()
    input_path = Path(arguments.input).resolve()
    output_dir = Path(arguments.output_dir).resolve()
    report_path = Path(arguments.report).resolve()
    models_dir = Path(arguments.models_dir).resolve()
    if arguments.model != ALLOWED_MODEL:
        return 4
    if not input_path.is_file() or not output_dir.is_dir() or report_path.parent != output_dir or not models_dir.is_dir():
        return 4
    if not model_files_are_valid(models_dir):
        return 3

    os.environ["HF_HOME"] = str(models_dir)
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
    os.environ["PYTHONHASHSEED"] = "0"

    try:
        import demucs
        from demucs.api import Separator, save_audio
        try:
            separator = Separator(model=ALLOWED_MODEL, device="cpu", shifts=1, overlap=0.25, split=True, jobs=0, progress=False)
        except Exception:
            return 3

        started = time.perf_counter()
        _origin, separated = separator.separate_audio_file(input_path)
        duration_ms = round((time.perf_counter() - started) * 1000)
        if any(name not in separated for name in EXPECTED_STEMS):
            return 6
        for name in EXPECTED_STEMS:
            save_audio(separated[name], output_dir / f"{name}.wav", separator.samplerate, clip="rescale", bits_per_sample=16)
        payload = {
            "model": ALLOWED_MODEL,
            "demucsVersion": demucs.__version__,
            "pythonVersion": ".".join(map(str, sys.version_info[:3])),
            "separationDurationMs": duration_ms,
            "peakRssBytes": peak_rss_bytes(),
            "stems": list(EXPECTED_STEMS),
            "warnings": [],
        }
        write_json_atomic(report_path, payload)
        return 0
    except MemoryError:
        return 5
    except RuntimeError as error:
        if "memory" in str(error).lower() or "allocate" in str(error).lower():
            return 5
        return 1
    except Exception:
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
