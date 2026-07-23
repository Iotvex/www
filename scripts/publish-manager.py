#!/usr/bin/env python3
"""Iotvex home publish/bridge manager.

Reads config/runtime.json (+ secrets) and ensures tunnels match the WWW×DB matrix:
  - local_published → expose WWW (:httpPort)
  - cloud + local DB → expose local Supabase (:54321)
  - cloud → expose agent (:7421)

Providers: cloudflare_tunnel (quick or token), pinggy (ssh), ngrok, tailscale_funnel.
State: config/publish-state.json; URLs written back into runtime.json bridge.*.
"""
from __future__ import annotations

import json
import os
import re
import signal
import subprocess
import time
from pathlib import Path
from typing import Any

ROOT = Path(os.environ.get("IOTVEX_WWW_ROOT", Path(__file__).resolve().parents[1]))
CONFIG_DIR = Path(os.environ.get("IOTVEX_CONFIG_DIR", ROOT / "config"))
RUNTIME = CONFIG_DIR / "runtime.json"
SECRETS = CONFIG_DIR / "runtime.secrets.json"
STATE = CONFIG_DIR / "publish-state.json"
RUN_DIR = Path(os.environ.get("IOTVEX_PUBLISH_RUN", "/home/xlebpushek/iotvex/www/config/publish-run"))
RUN_DIR.mkdir(parents=True, exist_ok=True)

CF_URL_RE = re.compile(r"https://[a-zA-Z0-9.-]+\.trycloudflare\.com")
PINGGY_URL_RE = re.compile(r"https://[a-zA-Z0-9.-]+\.pinggy\.link")
NGROK_URL_RE = re.compile(r"https://[a-zA-Z0-9.-]+\.ngrok(?:-free)?\.(?:app|dev|io)")


def load_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def save_json(path: Path, data: Any, mode: int = 0o644) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    os.chmod(tmp, mode)
    tmp.replace(path)


def matrix_needs(www: str, db: str) -> dict[str, bool]:
    cloud = www == "cloud"
    return {
        "www": www == "local_published",
        "db": cloud and db == "local",
        "agent": cloud,
    }


def effective_desired(rt: dict) -> dict[str, dict]:
    www = rt.get("wwwMode", "local")
    db = (rt.get("db") or {}).get("mode", "local")
    bridge = rt.get("bridge") or {}
    auto = bridge.get("autoFromMatrix", True)
    needs = matrix_needs(www, db)
    # WWW publish follows mode (local_published). Manual bridge flags OR matrix for cloud bridges.
    expose_www = www == "local_published"
    if auto:
        expose_db = needs["db"] or bool(bridge.get("exposeLocalDb"))
        expose_agent = needs["agent"] or bool(bridge.get("exposeAgent"))
    else:
        expose_db = bool(bridge.get("exposeLocalDb"))
        expose_agent = bool(bridge.get("exposeAgent"))

    pub = rt.get("publish") or {}
    http_port = int(pub.get("httpPort") or 3100)
    providers = pub.get("providers") or {}
    preferred = bridge.get("preferredProvider") or "cloudflare_tunnel"

    # pick first enabled provider that we can run; else preferred; else cloudflare quick
    enabled = [k for k, v in providers.items() if isinstance(v, dict) and v.get("enabled")]
    provider = preferred if preferred in enabled or not enabled else enabled[0]
    if preferred in enabled:
        provider = preferred
    elif enabled:
        # prefer cloudflare if enabled
        for cand in ("cloudflare_tunnel", "pinggy", "ngrok", "tailscale_funnel", "caddy_local"):
            if cand in enabled:
                provider = cand
                break
    else:
        provider = preferred

    desired: dict[str, dict] = {}
    if expose_www and provider != "caddy_local":
        desired["www"] = {"port": http_port, "provider": provider, "target": f"http://127.0.0.1:{http_port}"}
    elif expose_www and provider == "caddy_local":
        # caddy is host systemd — record LAN/WAN hint only
        desired["www"] = {"port": http_port, "provider": "caddy_local", "target": f"https://127.0.0.1:{pub.get('httpsPort', 8443)}"}
    if expose_db:
        desired["db"] = {"port": 54321, "provider": provider if provider != "caddy_local" else "cloudflare_tunnel", "target": "http://127.0.0.1:54321"}
    if expose_agent:
        desired["agent"] = {"port": 7421, "provider": provider if provider != "caddy_local" else "cloudflare_tunnel", "target": "http://127.0.0.1:7421"}
    return desired


def pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def stop_tunnel(name: str, state: dict) -> None:
    info = (state.get("tunnels") or {}).get(name) or {}
    pid = info.get("pid")
    if pid and pid_alive(int(pid)):
        try:
            os.kill(int(pid), signal.SIGTERM)
            time.sleep(0.5)
            if pid_alive(int(pid)):
                os.kill(int(pid), signal.SIGKILL)
        except OSError:
            pass
    for p in (RUN_DIR / f"{name}.pid", RUN_DIR / f"{name}.log"):
        if p.exists():
            try:
                if p.suffix == ".pid":
                    p.unlink()
            except OSError:
                pass
    state.setdefault("tunnels", {}).pop(name, None)


def read_url_from_log(log_path: Path, patterns: list[re.Pattern], timeout: float = 25.0) -> str | None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if log_path.exists():
            text = log_path.read_text(errors="ignore")
            for pat in patterns:
                m = pat.search(text)
                if m:
                    return m.group(0)
        time.sleep(0.4)
    return None


def start_cloudflared(name: str, target: str, secrets: dict, provider_cfg: dict) -> dict:
    log = RUN_DIR / f"{name}.log"
    pid_file = RUN_DIR / f"{name}.pid"
    if log.exists():
        log.write_text("")
    token = (
        (secrets.get("publish") or {}).get("cloudflare_tunnel", {}).get("tunnelToken")
        or provider_cfg.get("tunnelToken")
        or ""
    )
    if token:
        cmd = ["cloudflared", "tunnel", "--no-autoupdate", "run", "--token", token]
    else:
        cmd = ["cloudflared", "tunnel", "--protocol", "http2", "--no-autoupdate", "--url", target]
    proc = subprocess.Popen(
        cmd,
        stdout=open(log, "a"),
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    pid_file.write_text(str(proc.pid))
    url = None
    if not token:
        url = read_url_from_log(log, [CF_URL_RE])
    else:
        url = provider_cfg.get("hostname") or None
        if url and not str(url).startswith("http"):
            url = f"https://{url}"
        time.sleep(1.5)
    return {"pid": proc.pid, "provider": "cloudflare_tunnel", "target": target, "url": url, "log": str(log)}


def start_pinggy(name: str, port: int, secrets: dict, provider_cfg: dict) -> dict:
    log = RUN_DIR / f"{name}.log"
    if log.exists():
        log.write_text("")
    token = (secrets.get("publish") or {}).get("pinggy", {}).get("authtoken") or provider_cfg.get("authtoken") or ""
    # Remote forward via ssh to a.pinggy.io
    # With token: ssh -p 443 -R0:localhost:PORT token@a.pinggy.io
    user = token if token else "nokey"
    cmd = [
        "ssh",
        "-o", "StrictHostKeyChecking=no",
        "-o", "ServerAliveInterval=30",
        "-o", "ExitOnForwardFailure=yes",
        "-T",
        "-p", "443",
        "-R", f"0:127.0.0.1:{port}",
        f"{user}@a.pinggy.io",
    ]
    proc = subprocess.Popen(cmd, stdout=open(log, "a"), stderr=subprocess.STDOUT, start_new_session=True)
    (RUN_DIR / f"{name}.pid").write_text(str(proc.pid))
    url = read_url_from_log(log, [PINGGY_URL_RE, re.compile(r"https://[a-zA-Z0-9.-]+\.pinggy\.io")])
    return {"pid": proc.pid, "provider": "pinggy", "target": f"http://127.0.0.1:{port}", "url": url, "log": str(log)}


def start_ngrok(name: str, port: int, secrets: dict, provider_cfg: dict) -> dict:
    log = RUN_DIR / f"{name}.log"
    if log.exists():
        log.write_text("")
    token = (secrets.get("publish") or {}).get("ngrok", {}).get("authtoken") or provider_cfg.get("authtoken") or ""
    ngrok = "ngrok"
    if not shutil_which("ngrok"):
        raise RuntimeError("ngrok not installed")
    if token:
        subprocess.run([ngrok, "config", "add-authtoken", token], check=False, capture_output=True)
    cmd = [ngrok, "http", str(port), "--log=stdout"]
    domain = provider_cfg.get("domain") or ""
    if domain:
        cmd += ["--domain", domain]
    proc = subprocess.Popen(cmd, stdout=open(log, "a"), stderr=subprocess.STDOUT, start_new_session=True)
    (RUN_DIR / f"{name}.pid").write_text(str(proc.pid))
    url = None
    # ngrok local API
    for _ in range(40):
        try:
            import urllib.request
            with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=1) as r:
                data = json.loads(r.read().decode())
            for tun in data.get("tunnels") or []:
                pub = tun.get("public_url") or ""
                if pub.startswith("https://"):
                    url = pub
                    break
            if url:
                break
        except Exception:
            pass
        time.sleep(0.5)
    if not url:
        url = read_url_from_log(log, [NGROK_URL_RE], timeout=5)
    return {"pid": proc.pid, "provider": "ngrok", "target": f"http://127.0.0.1:{port}", "url": url, "log": str(log)}


def shutil_which(cmd: str) -> str | None:
    from shutil import which
    return which(cmd)


def start_tailscale(name: str, port: int, provider_cfg: dict) -> dict:
    if not shutil_which("tailscale"):
        raise RuntimeError("tailscale not installed")
    host = provider_cfg.get("hostname") or ""
    cmd = ["tailscale", "funnel", "--bg", str(port)]
    # funnel setup varies; record best-effort
    log = RUN_DIR / f"{name}.log"
    proc = subprocess.Popen(cmd, stdout=open(log, "a"), stderr=subprocess.STDOUT, start_new_session=True)
    (RUN_DIR / f"{name}.pid").write_text(str(proc.pid))
    time.sleep(1)
    url = f"https://{host}" if host else None
    status = subprocess.run(["tailscale", "funnel", "status"], capture_output=True, text=True)
    log.write_text((log.read_text() if log.exists() else "") + status.stdout + status.stderr)
    m = re.search(r"https://[a-zA-Z0-9.-]+", status.stdout + status.stderr)
    if m:
        url = m.group(0)
    return {"pid": proc.pid, "provider": "tailscale_funnel", "target": f"http://127.0.0.1:{port}", "url": url, "log": str(log)}


def ensure_tunnel(name: str, spec: dict, rt: dict, secrets: dict, state: dict) -> dict:
    provider = spec["provider"]
    existing = (state.get("tunnels") or {}).get(name)
    if existing and existing.get("provider") == provider and existing.get("pid") and pid_alive(int(existing["pid"])):
        if existing.get("url") or provider == "caddy_local":
            return existing
        # still starting — try read log again
    if existing:
        stop_tunnel(name, state)

    providers = ((rt.get("publish") or {}).get("providers") or {})
    pcfg = providers.get(provider) or {}

    if provider == "caddy_local":
        https_port = int((rt.get("publish") or {}).get("httpsPort") or 8443)
        info = {"pid": None, "provider": provider, "target": spec["target"], "url": f"https://<lan-or-wan-ip>:{https_port}", "log": None}
    elif provider == "cloudflare_tunnel":
        if not shutil_which("cloudflared"):
            raise RuntimeError("cloudflared not installed")
        info = start_cloudflared(name, spec["target"], secrets, pcfg)
    elif provider == "pinggy":
        info = start_pinggy(name, int(spec["port"]), secrets, pcfg)
    elif provider == "ngrok":
        info = start_ngrok(name, int(spec["port"]), secrets, pcfg)
    elif provider == "tailscale_funnel":
        info = start_tailscale(name, int(spec["port"]), pcfg)
    else:
        raise RuntimeError(f"unknown provider {provider}")

    state.setdefault("tunnels", {})[name] = info
    return info


def write_bridge_urls(rt: dict, state: dict) -> dict:
    bridge = rt.setdefault("bridge", {})
    tunnels = state.get("tunnels") or {}
    if "www" in tunnels and tunnels["www"].get("url"):
        bridge["wwwPublicUrl"] = tunnels["www"]["url"]
    if "db" in tunnels and tunnels["db"].get("url"):
        bridge["localDbPublicUrl"] = tunnels["db"]["url"]
        rt.setdefault("db", {}).setdefault("local", {})["publicUrl"] = tunnels["db"]["url"]
    if "agent" in tunnels and tunnels["agent"].get("url"):
        bridge["agentPublicUrl"] = tunnels["agent"]["url"]
    return rt


def reconcile() -> dict:
    rt = load_json(RUNTIME, {})
    secrets = load_json(SECRETS, {})
    state = load_json(STATE, {"version": 1, "tunnels": {}, "errors": []})
    desired = effective_desired(rt)
    errors: list[str] = []

    # stop obsolete
    for name in list((state.get("tunnels") or {}).keys()):
        if name not in desired:
            stop_tunnel(name, state)

    tunnels_out = {}
    for name, spec in desired.items():
        try:
            tunnels_out[name] = ensure_tunnel(name, spec, rt, secrets, state)
        except Exception as e:
            errors.append(f"{name}: {e}")
            stop_tunnel(name, state)

    state["desired"] = desired
    state["tunnels"] = tunnels_out
    state["errors"] = errors
    state["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    save_json(STATE, state)

    rt = write_bridge_urls(rt, state)
    save_json(RUNTIME, rt)
    # Env snippet for a cloud-hosted WWW instance talking to this home
    env_lines = [
        "# Generated by publish-manager — point cloud WWW at this home",
        f"IOTVEX_WWW_MODE=cloud",
        f"IOTVEX_DB_MODE={(rt.get('db') or {}).get('mode')}",
    ]
    bridge = rt.get("bridge") or {}
    if bridge.get("localDbPublicUrl"):
        env_lines += [
            f"SUPABASE_URL={bridge['localDbPublicUrl']}",
            f"NEXT_PUBLIC_SUPABASE_URL={bridge['localDbPublicUrl']}",
            f"NEXT_PUBLIC_SUPABASE_BROWSER_URL={bridge['localDbPublicUrl']}",
        ]
    if bridge.get("agentPublicUrl"):
        env_lines.append(f"IOTVEX_AGENT_URL={bridge['agentPublicUrl']}")
    if bridge.get("wwwPublicUrl"):
        env_lines.append(f"# home www public: {bridge['wwwPublicUrl']}")
    (CONFIG_DIR / "cloud-client.env").write_text("\n".join(env_lines) + "\n")
    return state


def consume_request() -> str | None:
    req = CONFIG_DIR / "publish-request"
    if not req.exists():
        return None
    try:
        raw = req.read_text().strip()
        req.exists() and req.unlink()
        if raw.startswith("{"):
            return str(json.loads(raw).get("action") or "reconcile")
        return raw or "reconcile"
    except Exception:
        try:
            req.exists() and req.unlink()
        except Exception:
            pass
        return "reconcile"


def main() -> None:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("action", choices=["reconcile", "status", "stop-all"], nargs="?", default="reconcile")
    args = ap.parse_args()
    queued = consume_request()
    if queued and args.action == "reconcile":
        args.action = queued
    if args.action == "stop-all":
        state = load_json(STATE, {"tunnels": {}})
        for name in list((state.get("tunnels") or {}).keys()):
            stop_tunnel(name, state)
        state["desired"] = {}
        state["tunnels"] = {}
        state["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        save_json(STATE, state)
        print(json.dumps(state, indent=2))
        return
    if args.action == "status":
        print(json.dumps(load_json(STATE, {}), indent=2))
        return
    state = reconcile()
    print(json.dumps(state, indent=2))


if __name__ == "__main__":
    main()
