"""Smart-home bridge — talks to the Iotvex www strip API.

Voice pipeline expects:
  lights_on / lights_off / set_brightness / set_color / set_effect
each returning ActionResult(success, backend, detail).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Must match shared/lib/home/actions.ts EFFECT_NAME_TO_ID
EFFECT_IDS: dict[str, int] = {
    "solid": 0,
    "rainbow": 1,
    "chase": 2,
    "pulse": 3,
    "sparkle": 4,
    "theater": 5,
    "fire": 6,
    "comet": 7,
    "wave": 8,
    "scanner": 9,
    "twinkle": 10,
    "gradient": 11,
    "color_loop": 12,
    "snow": 13,
    # aliases
    "breathing": 3,
    "breathe": 3,
    "blink": 10,
}


@dataclass
class ActionResult:
    success: bool
    backend: str = "www"
    detail: str = ""
    data: Optional[dict[str, Any]] = None


def _headers() -> dict[str, str]:
    settings = get_settings()
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    token = (settings.iotvex_token or "").strip()
    if token:
        h["Authorization"] = f"Bearer {token}"
        h["X-Iotvex-Token"] = token
    return h


def _base() -> str:
    return get_settings().iotvex_www_url.rstrip("/")


def _timeout() -> float:
    return float(get_settings().home_timeout or 5.0)


async def _get(path: str) -> Any:
    async with httpx.AsyncClient(timeout=_timeout()) as client:
        r = await client.get(f"{_base()}{path}", headers=_headers())
        r.raise_for_status()
        return r.json()


async def _post(path: str, body: dict[str, Any]) -> Any:
    async with httpx.AsyncClient(timeout=_timeout()) as client:
        r = await client.post(f"{_base()}{path}", headers=_headers(), json=body)
        r.raise_for_status()
        return r.json()


async def list_strips() -> list[dict[str, Any]]:
    """Prefer /api/iotvex/strips; fall back to decoding /api/iotvex/nodes."""
    try:
        data = await _get("/api/iotvex/strips")
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(data, dict) and isinstance(data.get("strips"), list):
            return [x for x in data["strips"] if isinstance(x, dict)]
    except Exception as exc:  # noqa: BLE001
        logger.warning("strips list failed, falling back to nodes: %s", exc)

    data = await _get("/api/iotvex/nodes")
    nodes = data.get("nodes") if isinstance(data, dict) else None
    if not isinstance(nodes, list):
        return []
    out: list[dict[str, Any]] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node_id = node.get("node_id")
        for s in node.get("strips") or []:
            if not isinstance(s, dict):
                continue
            idx = int(s.get("index", len(out)))
            out.append(
                {
                    "id": f"light.strip_{node_id}_{idx}",
                    "name": "Left Strip" if idx == 0 else "Right Strip" if idx == 1 else f"Strip {idx}",
                    "index": idx,
                    "node_id": node_id,
                    "on": bool(s.get("on")),
                    "brightness": int(s.get("brightness", 255)),
                    "r": int(s.get("r", 255)),
                    "g": int(s.get("g", 255)),
                    "b": int(s.get("b", 255)),
                    "effect": int(s.get("effect", 0)),
                    "speed": int(s.get("speed", 128)),
                }
            )
    return out


def _pick_strips(strips: list[dict[str, Any]], target: str) -> list[dict[str, Any]]:
    if not strips:
        return []
    t = (target or "all").lower().strip()
    if t in {"all", "lights", "свет", "огни", "ленты", ""}:
        return strips

    def match(s: dict[str, Any], keys: tuple[str, ...]) -> bool:
        blob = f"{s.get('name', '')} {s.get('id', '')} {s.get('index', '')}".lower()
        return any(k in blob for k in keys)

    if t in {"left", "левая", "левую", "левой"}:
        hit = [s for s in strips if match(s, ("left", "лев", "0")) or int(s.get("index", -1)) == 0]
        return hit or strips[:1]
    if t in {"right", "правая", "правую", "правой"}:
        hit = [s for s in strips if match(s, ("right", "прав", "1")) or int(s.get("index", -1)) == 1]
        return hit or strips[1:2] or strips[:1]

    # Fuzzy name match
    hit = []
    for s in strips:
        blob = f"{s.get('name', '')} {s.get('id', '')}".lower()
        if t in blob or blob in t:
            hit.append(s)
    return hit or strips[:1]


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return 255, 255, 255
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _pct_to_bri(pct: int) -> int:
    """UI/NLU brightness is 0–100%; firmware expects 0–255."""
    pct = max(0, min(100, int(pct)))
    return max(0, min(255, round(pct * 255 / 100)))


async def apply_strip(
    strip: dict[str, Any],
    *,
    on: bool | None = None,
    brightness: int | None = None,
    r: int | None = None,
    g: int | None = None,
    b: int | None = None,
    effect: str | int | None = None,
    speed: int | None = None,
) -> dict[str, Any]:
    index = int(strip.get("index", 0))
    node_id = strip.get("node_id")
    body: dict[str, Any] = {
        # Always send a coherent full body so fields stay independent.
        "on": bool(strip.get("on", True) if on is None else on),
        "brightness": int(strip.get("brightness", 255) if brightness is None else brightness),
        "r": int(strip.get("r", 255) if r is None else r),
        "g": int(strip.get("g", 255) if g is None else g),
        "b": int(strip.get("b", 255) if b is None else b),
        "effect": int(strip.get("effect", 0)),
        "speed": int(strip.get("speed", 128) if speed is None else speed),
    }
    if node_id is not None and str(node_id).strip() != "":
        try:
            body["node_id"] = int(node_id)
        except (TypeError, ValueError):
            body["node_id"] = node_id

    if on is not None:
        body["on"] = bool(on)
    if brightness is not None:
        body["brightness"] = max(0, min(255, int(brightness)))
    if r is not None:
        body["r"] = max(0, min(255, int(r)))
    if g is not None:
        body["g"] = max(0, min(255, int(g)))
    if b is not None:
        body["b"] = max(0, min(255, int(b)))
    if effect is not None:
        if isinstance(effect, int) or (isinstance(effect, str) and effect.isdigit()):
            body["effect"] = int(effect)
        else:
            body["effect"] = EFFECT_IDS.get(str(effect).strip().lower(), 0)
    if speed is not None:
        body["speed"] = max(1, min(255, int(speed)))

    return await _post(f"/api/iotvex/strips/{index}", body)


async def _run_on_targets(
    target: str,
    **kwargs: Any,
) -> ActionResult:
    try:
        strips = await list_strips()
        picked = _pick_strips(strips, target)
        if not picked:
            return ActionResult(success=False, detail="no_strips")
        last: dict[str, Any] | None = None
        for s in picked:
            last = await apply_strip(s, **kwargs)
            # Keep local snapshot coherent for multi-strip loops
            s.update({k: kwargs[k] for k in ("on", "brightness", "r", "g", "b") if k in kwargs})
            if "effect" in kwargs and kwargs["effect"] is not None:
                eff = kwargs["effect"]
                s["effect"] = (
                    int(eff)
                    if isinstance(eff, int) or (isinstance(eff, str) and str(eff).isdigit())
                    else EFFECT_IDS.get(str(eff).lower(), 0)
                )
        names = ", ".join(str(s.get("name") or s.get("id") or s.get("index")) for s in picked)
        return ActionResult(success=True, detail=names, data=last if isinstance(last, dict) else None)
    except Exception as exc:  # noqa: BLE001
        logger.exception("home action failed target=%s kwargs=%s", target, kwargs)
        return ActionResult(success=False, detail=str(exc))


async def lights_on(strip: str = "all") -> ActionResult:
    return await _run_on_targets(strip, on=True)


async def lights_off(strip: str = "all") -> ActionResult:
    return await _run_on_targets(strip, on=False)


async def set_brightness(value: int, strip: str = "all") -> ActionResult:
    """value is 0–100 percent from NLU."""
    return await _run_on_targets(strip, on=True, brightness=_pct_to_bri(value))


async def set_color(hex_color: str, strip: str = "all") -> ActionResult:
    r, g, b = _hex_to_rgb(hex_color)
    return await _run_on_targets(strip, on=True, r=r, g=g, b=b, effect="solid")


async def set_effect(effect: str, strip: str = "all") -> ActionResult:
    return await _run_on_targets(strip, on=True, effect=effect)
