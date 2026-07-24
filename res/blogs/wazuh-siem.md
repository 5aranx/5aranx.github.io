# Wazuh SIEM Lab — Building a Home SOC from Scratch

> 📅 Portfolio date: **January 8, 2026**

---

## Why Build a Home SOC?

Every detection engineer needs a place to break things. A home SOC lab lets you deploy agents, write rules, trigger alerts, and tune detection logic — all without a production outage or a compliance ticket.

This guide walks through setting up Wazuh (the open-source SIEM fork of OSSEC + Elastic) in Docker, writing custom detection rules, and simulating attacks to validate coverage.

---

## Architecture Overview

```
[Attacker VM] ──→ [Network] ──→ [Windows/Linux Agents]
                                      │
                                      │  (agent forwarding)
                                      ▼
                         ┌─────────────────────┐
                         │   Wazuh Manager     │
                         │   (Docker)          │
                         │   Port 55000/UDP    │
                         └─────────┬───────────┘
                                   │
                         ┌─────────▼───────────┐
                         │   Wazuh Indexer     │
                         │   (Elasticsearch)   │
                         └─────────┬───────────┘
                                   │
                         ┌─────────▼───────────┐
                         │   Wazuh Dashboard   │
                         │   (Kibana + UI)     │
                         └─────────────────────┘
                                   │
                         ┌─────────▼───────────┐
                         │   Alert Pipeline    │
                         │   (Python/Slack)    │
                         └─────────────────────┘
```

The stack breaks into four containers:

| Component | Role | Ports |
|-----------|------|-------|
| wazuh-manager | Central management + rule engine | 55000/UDP (agents), 1514–1516/TCP |
| wazuh-indexer | Log storage + search (Elasticsearch) | 9200/TCP |
| wazuh-dashboard | Kibana + Wazuh UI | 443/TCP |
| alert-pipeline | Custom Python notifier | internal |

---

## Deployment

### docker-compose.yml (abridged)

```yaml
version: '3.7'
services:
  wazuh-manager:
    image: wazuh/wazuh-manager:4.10
    hostname: wazuh-manager
    ports:
      - "55000:55000/udp"
      - "1514:1514/tcp"
    volumes:
      - ./config/ossec.conf:/var/ossec/etc/ossec.conf
      - ./config/rules:/var/ossec/ruleset/custom

  wazuh-indexer:
    image: wazuh/wazuh-indexer:4.10
    environment:
      - "OPENSEARCH_JAVA_OPTS=-Xms1g -Xmx1g"
    volumes:
      - indexer-data:/var/lib/wazuh-indexer

  wazuh-dashboard:
    image: wazuh/wazuh-dashboard:4.10
    ports:
      - "443:5601"
    depends_on:
      - wazuh-indexer
      - wazuh-manager
```

Skip the full config boilerplate here — the official Wazuh Docker repo has a production-ready `generate-indexer-certs.sh` and config templates. Key customisation is in the rules.

---

## Detection Rules — MITRE ATT&CK Mapping

All custom rules go in `./config/rules/`. Each rule file targets a specific technique.

### Rule 1: Process Injection Detection (T1055)

```xml
<group name="sysmon, process_injection,">
  <!-- Sysmon Event ID 8: CreateRemoteThread -->
  <rule id="100001" level="12">
    <if_sid>92050</if_sid>
    <field name="win.eventdata.sourceProcessName"
           type="osregex">.*(mimikatz|psexec|powershell\.exe)$</field>
    <field name="win.eventdata.startModule"
           type="osregex">.*(ntdll|kernel32)\.dll$</field>
    <description>Process injection detected from
                 $(win.eventdata.sourceProcessName)
                 into $(win.eventdata.targetProcessName)</description>
    <mitre>
      <id>T1055.001</id>
      <tactic>defense-evasion,privilege-escalation</tactic>
    </mitre>
    <options>no_full_log</options>
  </rule>
</group>
```

Level 12 triggers an immediate alert. The rule fires when a known suspect binary creates a remote thread in another process — the hallmark of process injection.

### Rule 2: Kerberoasting Detection (T1558.003)

```xml
<group name="windows, kerberos, credential_access,">
  <rule id="100015" level="10">
    <if_sid>90000</if_sid>
    <field name="win.system.eventID">^4769$</field>
    <!-- RC4 encryption type indicates Kerberoasting attempt -->
    <field name="win.eventdata.ticketEncryptionType">^0x17$</field>
    <field name="win.eventdata.serviceName" type="osregex">.*\$</field>
    <!-- More than 10 requests per minute triggers this -->
    <description>Possible Kerberoasting:
                 multiple TGS-REP with RC4 encryption
                 for $(win.eventdata.serviceName)</description>
    <mitre>
      <id>T1558.003</id>
      <tactic>credential-access</tactic>
    </mitre>
  </rule>
</group>
```

The key signal: Kerberoasting requests use RC4 encryption (0x17) instead of the modern AES (0x12). A burst of 4769 events with RC4 from a single IP is nearly diagnostic.

---

## Alert Pipeline

Raw Wazuh alerts are noisy. The custom pipeline enriches, deduplicates, and routes.

```python
import json
import sys
import requests
from datetime import datetime, timedelta

# Dedup window: suppress identical alerts within 5 minutes
DEDUP_WINDOW = timedelta(minutes=5)
alert_cache = {}

def process_alert(raw):
    alert = json.loads(raw)

    # Extract key fields
    rule_id = alert['rule']['id']
    agent_name = alert['agent']['name']
    description = alert['rule']['description']
    alert_key = f"{rule_id}:{agent_name}"

    # Dedup
    now = datetime.now()
    if alert_key in alert_cache:
        if now - alert_cache[alert_key] < DEDUP_WINDOW:
            return  # suppressed
    alert_cache[alert_key] = now

    # MITRE enrichment from rule metadata
    mitre = alert['rule'].get('mitre', {})
    tactic = mitre.get('tactic', 'unknown')

    # Route to Slack
    severity = int(alert['rule']['level'])
    colour = "#ff0000" if severity >= 12 else "#ffa500"

    slack_payload = {
        "attachments": [{
            "colour": colour,
            "title": f"[{severity}] {description}",
            "fields": [
                {"title": "Agent", "value": agent_name, "short": True},
                {"title": "MITRE Tactic", "value": tactic, "short": True},
                {"title": "Rule ID", "value": rule_id, "short": True},
                {"title": "Timestamp", "value": alert['timestamp'], "short": True}
            ],
            "footer": "Wazuh Sentinel Alert Pipeline"
        }]
    }

    requests.post(SLACK_WEBHOOK_URL, json=slack_payload)

if __name__ == "__main__":
    for line in sys.stdin:
        process_alert(line.strip())
```

The pipeline reads from Wazuh's `alerts.json` socket, deduplicates within a 5-minute sliding window, enriches with MITRE context, and posts to Slack with colour-coded severity.

---

## Simulating Attacks

To validate the rules fire correctly, run atomic tests:

```powershell
# PowerShell injection simulation (T1055.001)
$bytes = [System.Text.Encoding]::Unicode.GetBytes('calc.exe')
$encoded = [Convert]::ToBase64String($bytes)
powershell -EncodedCommand $encoded
```

```bash
# Kerberoasting simulation (requires domain joined)
impacket-GetUserSPNs -request -dc-ip 192.168.1.10 lab.local/john:Password1
```

Each simulation should produce an alert visible in the Wazuh dashboard within 30 seconds. If it doesn't, check the rule syntax with `wazuh-logtest`:

```bash
docker exec -it wazuh-manager /var/ossec/bin/wazuh-logtest
# Paste a sample log line, verify the rule matches
```

---

## What I Learned

**False positives are the real problem.** It's easy to write a rule that fires. It's hard to write one that only fires on actual malice. The Kerberoasting rule needed a count threshold because domain controllers legitimately issue RC4 tickets for legacy services.

**The MITRE ATT&CK mapping is worth the overhead.** When an alert arrives with `T1055.001` in the metadata, the response playbook is unambiguous. Without it, every alert requires manual context gathering.

**Wazuh's FIM (File Integrity Monitoring) is surprisingly good.** Combined with the SCA (Security Configuration Assessment), it catches configuration drift and unauthorised file changes with minimal tuning.

**The pipeline matters more than the rules.** A SIEM with perfect rules and no notification routing is a storage system, not a detection system. The dedup + enrichment + Slack routing turned Wazuh from a dashboard I checked daily into a system that pages me when it matters.

---
*Originally published on [saranx.hashnode.dev/wazuh-siem](https://saranx.hashnode.dev/wazuh-siem) on **July 24, 2026***
