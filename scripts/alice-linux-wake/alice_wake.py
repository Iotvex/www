#!/usr/bin/env python3
"""
Linux companion: continuous «Алиса» hotword → open Yandex Browser Alice mic.

Honest limitation (Yandex docs, 2025–2026):
  Voice activation by phrase is available ONLY in Yandex Browser for Windows.
  On Linux the in-browser always-listen does nothing even when the setting is on.

This service listens on the USB mic (PipeWire/Pulse), runs a light Whisper STT
pass when energy VAD fires, and on wake «Алиса» / «Слушай Алиса» focuses
Yandex Browser and triggers Alice listen (xdotool + optional deep link).

Reuse assistant Whisper venv if present:
  IOTVEX_ASSISTANT_VENV=/home/xlebpushek/iotvex/assistant/.venv
"""

from __future__ import annotations

import io
import json
import logging
import os
import re
import shutil
import signal
import struct
import subprocess
import sys
import threading
import time
import wave
from pathlib import Path
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("iotvex.alice-wake")

RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2
BYTES_PER_S = RATE * SAMPLE_WIDTH * CHANNELS
WAKE_SECONDS = float(os.environ.get("ALICE_WAKE_SECONDS", "3.2") or "3.2")
SPEECH_RMS = float(os.environ.get("SPEECH_RMS", "0.038") or "0.038")
COOLDOWN_S = float(os.environ.get("ALICE_WAKE_COOLDOWN", "4.0") or "4.0")
PREROLL_S = float(os.environ.get("WAKE_PREROLL_S", "1.2") or "1.2")
STATUS_PATH = Path(os.environ.get("ALICE_WAKE_STATUS", "/tmp/iotvex-alice-wake-status.json"))
DISPLAY = os.environ.get("DISPLAY", ":0")

_WAKE_RE = re.compile(
    r"(?:^|[^\wа-яё])("
    r"алиса|alis[ay]?|"
    r"слушай\s+алиса|слушай\s+яндекс|hello\s+alice"
    r")(?=[^\wа-яё]|$)",
    re.IGNORECASE | re.UNICODE,
)

_stop = False
_whisper_model = None


def _pcm_rms(pcm: bytes) -> float:
    if len(pcm) < 4:
        return 0.0
    n = len(pcm) // 2
    acc = 0.0
    count = 0
    for i in range(0, n, 4):
        (s,) = struct.unpack_from("<h", pcm, i * 2)
        acc += float(s) * float(s)
        count += 1
    if not count:
        return 0.0
    return (acc / count) ** 0.5 / 32768.0


def _wav_bytes(pcm: bytes) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(CHANNELS)
        w.setsampwidth(SAMPLE_WIDTH)
        w.setframerate(RATE)
        w.writeframes(pcm)
    return buf.getvalue()


def _resolve_source() -> str:
    env = os.environ.get("ALICE_MIC_SOURCE") or os.environ.get("PULSE_SOURCE")
    if env:
        return env
    try:
        out = subprocess.check_output(["pactl", "get-default-source"], text=True).strip()
        if out:
            return out
    except Exception:
        pass
    return "@DEFAULT_SOURCE@"


class PcmTap:
    def __init__(self, source: str) -> None:
        self.source = source
        self._proc: Optional[subprocess.Popen] = None
        self._buf = bytearray()
        self._lock = threading.Lock()
        self._err: Optional[str] = None
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._proc = self._spawn()
        if not self._proc:
            raise RuntimeError(self._err or "no capture backend")
        self._thread = threading.Thread(target=self._reader, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        if self._proc and self._proc.poll() is None:
            try:
                self._proc.terminate()
                self._proc.wait(timeout=2)
            except Exception:
                try:
                    self._proc.kill()
                except Exception:
                    pass
        self._proc = None

    def _spawn(self) -> Optional[subprocess.Popen]:
        cmds = []
        if shutil.which("pw-record"):
            cmds.append(
                [
                    "pw-record",
                    "--rate",
                    str(RATE),
                    "--channels",
                    "1",
                    "--format",
                    "s16",
                    "--target",
                    self.source if self.source != "@DEFAULT_SOURCE@" else "",
                    "-",
                ]
            )
            # empty target confuses pw-record — drop flag
            if not cmds[-1][cmds[-1].index("--target") + 1]:
                i = cmds[-1].index("--target")
                del cmds[-1][i : i + 2]
        if shutil.which("parec"):
            cmds.append(
                [
                    "parec",
                    "--rate",
                    str(RATE),
                    "--channels=1",
                    "--format=s16le",
                    f"--device={self.source}",
                    "--raw",
                ]
            )
        for cmd in cmds:
            try:
                return subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                )
            except Exception as e:
                self._err = str(e)
        self._err = "no capture backend (pw-record/parec)"
        return None

    def _reader(self) -> None:
        assert self._proc and self._proc.stdout
        max_keep = int(BYTES_PER_S * (PREROLL_S + WAKE_SECONDS + 1))
        while not _stop and self._proc and self._proc.poll() is None:
            chunk = self._proc.stdout.read(4096)
            if not chunk:
                break
            with self._lock:
                self._buf.extend(chunk)
                if len(self._buf) > max_keep:
                    del self._buf[: len(self._buf) - max_keep]

    def read_seconds(self, seconds: float) -> bytes:
        need = int(BYTES_PER_S * seconds)
        deadline = time.time() + seconds + 1.5
        while time.time() < deadline:
            with self._lock:
                if len(self._buf) >= need:
                    # take last `need` bytes (includes preroll if buffer was full)
                    data = bytes(self._buf[-need:])
                    self._buf.clear()
                    return data
            time.sleep(0.05)
        with self._lock:
            data = bytes(self._buf)
            self._buf.clear()
            return data

    def peek_rms(self, seconds: float = 0.25) -> float:
        n = int(BYTES_PER_S * seconds)
        with self._lock:
            if len(self._buf) < n:
                return 0.0
            return _pcm_rms(bytes(self._buf[-n:]))


def _load_whisper():
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model
    try:
        import whisper  # type: ignore
    except ImportError:
        logger.error("whisper not installed in this Python — use assistant .venv")
        raise
    model_name = os.environ.get("WHISPER_MODEL", "tiny")
    logger.info("Loading Whisper model=%s", model_name)
    _whisper_model = whisper.load_model(model_name)
    return _whisper_model


def _transcribe(pcm: bytes) -> str:
    model = _load_whisper()
    import tempfile

    wav = _wav_bytes(pcm)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as f:
        f.write(wav)
        f.flush()
        result = model.transcribe(
            f.name,
            language="ru",
            fp16=False,
            condition_on_previous_text=False,
        )
    return str(result.get("text") or "").strip()


def _has_wake(text: str) -> bool:
    t = text.lower().replace("ё", "е")
    return bool(_WAKE_RE.search(f" {t} "))


def _write_status(**kwargs) -> None:
    try:
        STATUS_PATH.write_text(json.dumps({"ts": time.time(), **kwargs}, ensure_ascii=False))
    except Exception:
        pass


def _browser_bin() -> Optional[str]:
    for c in ("yandex-browser-stable", "yandex-browser", "/usr/bin/yandex-browser-stable"):
        if shutil.which(c) or (c.startswith("/") and Path(c).exists()):
            return shutil.which(c) or c
    return None


def trigger_alice() -> None:
    """Best-effort: focus Yandex Browser and start Alice listening."""
    env = {**os.environ, "DISPLAY": DISPLAY}
    browser = _browser_bin()
    # 1) Focus existing window
    try:
        wins = subprocess.check_output(
            ["xdotool", "search", "--class", "yandex_browser|Yandex|chromium"],
            env=env,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip().splitlines()
    except Exception:
        wins = []
    if not wins:
        try:
            wins = subprocess.check_output(
                ["xdotool", "search", "--name", "Яндекс|Yandex"],
                env=env,
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip().splitlines()
        except Exception:
            wins = []

    if not wins and browser:
        # Open NTP so Alice mic is available in smartbox
        subprocess.Popen(
            [browser, "--new-window", "chrome://newtab"],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        time.sleep(1.8)
        try:
            wins = subprocess.check_output(
                ["xdotool", "search", "--class", "yandex_browser"],
                env=env,
                text=True,
                stderr=subprocess.DEVNULL,
            ).strip().splitlines()
        except Exception:
            wins = []

    if wins:
        wid = wins[-1]
        try:
            subprocess.run(["xdotool", "windowactivate", "--sync", wid], env=env, check=False)
            time.sleep(0.25)
            # Common shortcuts / NTP focus then click approximate mic region (top-right smartbox).
            # Ctrl+L focuses omnibox; Tab may reach mic — fragile. Prefer Alice side panel shortcut if any.
            # Yandex Linux: open Alice chat URL which arms push-to-talk UI.
            subprocess.run(["xdotool", "key", "--window", wid, "ctrl+t"], env=env, check=False)
            time.sleep(0.2)
            subprocess.run(
                ["xdotool", "type", "--window", wid, "--clearmodifiers", "https://alice.yandex.ru/"],
                env=env,
                check=False,
            )
            subprocess.run(["xdotool", "key", "--window", wid, "Return"], env=env, check=False)
            time.sleep(1.2)
            # Click near bottom center (typical voice button on alice.yandex.ru)
            geo = subprocess.check_output(
                ["xdotool", "getwindowgeometry", "--shell", wid], env=env, text=True
            )
            props = dict(line.split("=", 1) for line in geo.strip().splitlines() if "=" in line)
            x = int(props.get("X", "100"))
            y = int(props.get("Y", "100"))
            w = int(props.get("WIDTH", "1280"))
            h = int(props.get("HEIGHT", "800"))
            cx = x + w // 2
            cy = y + int(h * 0.88)
            subprocess.run(["xdotool", "mousemove", "--sync", str(cx), str(cy)], env=env, check=False)
            subprocess.run(["xdotool", "click", "1"], env=env, check=False)
            logger.info("Triggered Alice UI (window=%s click=%s,%s)", wid, cx, cy)
            _notify("Алиса", "Слушаю…")
            return
        except Exception as e:
            logger.warning("xdotool trigger failed: %s", e)

    # Fallback: just launch alice web
    if browser:
        subprocess.Popen(
            [browser, "https://alice.yandex.ru/"],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        _notify("Алиса", "Открыл Алису (нажмите микрофон)")
        logger.info("Opened alice.yandex.ru (manual mic may be needed)")
    else:
        logger.error("Yandex Browser not found")


def _notify(title: str, body: str) -> None:
    if not shutil.which("notify-send"):
        return
    try:
        subprocess.Popen(
            ["notify-send", "-a", "Iotvex", title, body],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except Exception:
        pass


def main() -> int:
    global _stop

    def _sig(*_a):
        global _stop
        _stop = True

    signal.signal(signal.SIGINT, _sig)
    signal.signal(signal.SIGTERM, _sig)

    source = _resolve_source()
    logger.info(
        "Alice Linux wake companion source=%s display=%s (browser wake is Windows-only)",
        source,
        DISPLAY,
    )
    _load_whisper()
    tap = PcmTap(source)
    tap.start()
    last_fire = 0.0
    _write_status(running=True, source=source)

    while not _stop:
        try:
            rms = tap.peek_rms(0.2)
            if rms < SPEECH_RMS:
                time.sleep(0.08)
                continue
            pcm = tap.read_seconds(WAKE_SECONDS)
            if _pcm_rms(pcm) < SPEECH_RMS * 0.7:
                continue
            text = _transcribe(pcm)
            logger.info("Heard: %r rms=%.3f", text, rms)
            _write_status(running=True, last_heard=text, rms=rms)
            if not _has_wake(text):
                continue
            if time.time() - last_fire < COOLDOWN_S:
                logger.info("Wake cooldown")
                continue
            last_fire = time.time()
            logger.info("Wake «Алиса» → trigger browser")
            trigger_alice()
            time.sleep(COOLDOWN_S)
        except Exception:
            logger.exception("wake loop error")
            time.sleep(1.0)

    tap.stop()
    _write_status(running=False)
    logger.info("Alice wake stopped")
    return 0


if __name__ == "__main__":
    # Prefer assistant venv whisper if invoked via system python
    venv = os.environ.get("IOTVEX_ASSISTANT_VENV", "/home/xlebpushek/iotvex/assistant/.venv")
    vpy = Path(venv) / "bin" / "python"
    if Path(sys.executable).resolve() != vpy.resolve() and vpy.exists():
        os.execv(str(vpy), [str(vpy), __file__, *sys.argv[1:]])
    raise SystemExit(main())
