# Deployment Authorization & Licensing — DESIGN DRAFT

> **ADR assigné : ADR-047** (proposé) dans `docs/DECISIONS.md` — revient sur ADR-010. Toute mention interne de « ADR-045 » dans ce brouillon est remplacée par **ADR-047**. Référencé dans `docs/BACKLOG.md` (batch 2026-06-02).
>
> **Status**: DRAFT for lead-engineer review. No application code written yet.
> The only artifact produced so far is this document.
>
> **Author intent**: respond to the product owner's request to prevent
> *unauthorized application deployments* — specifically, a field technician who
> has the jar/installer reusing it for other cabinets without the vendor's
> approval.
>
> **Scope change flag**: `CLAUDE.md` and `ADR-010` state v1 has **"no license
> module"** and that the monthly subscription is **managed manually**. This
> request **reverses that stance**. It must therefore land as a deliberate ADR
> (proposed **ADR-045** below, superseding ADR-010), not as a quiet feature.
>
> Related precedent: **ADR-042 / `docs/adr/ADR-042-source-code-protection.md`**
> already establishes the project's honest position that *no software protection
> is unbreakable on hardware the client controls — the goal is to raise the bar
> and back it with contract*. This document applies the same philosophy to a
> different problem: not "can they read the code" but "can they run a copy we
> didn't authorize".

---

## 1. Problem & threat model

### 1.1 What we are protecting

careplus ships **on-premise**: one Spring Boot fat-jar that serves the React
bundle (ADR-020), running as a Windows service next to a local PostgreSQL, one
install per cabinet (ARCHITECTURE.md → *Deployment shape*). The same jar also
runs in the cloud (Fly.io `careplusv2`, Neon Postgres) for staging. The
commercial model is a **monthly subscription, one cabinet = one paying
install** (ADR-010).

### 1.2 The adversary

The product owner's words:

> « Un technicien peut intervenir pour faire des deploiements et il peut le
> faire pour d'autres clients sans notre avis. »

So the primary adversary is **not** an anonymous internet attacker. It is a
**semi-trusted insider** — a field/integration technician who:

- legitimately holds the installer / jar (we gave it to them to deploy at
  cabinet A);
- has admin rights on the target Windows machine (they install services);
- is **not** especially motivated to decompile or patch bytecode — they want
  to *re-run our working software* at cabinet B, C, D and pocket the install
  fee or undercut us, **not** to reverse-engineer it.

Secondary adversaries, lower priority:

- a cabinet that stops paying but keeps using the install;
- a cabinet that clones its VM/disk to a second site to avoid a second
  subscription.

### 1.3 What "unauthorized deployment" means

A **running careplus instance that the vendor did not issue an authorization
for**, i.e. an install whose cabinet identity / machine is not on a
vendor-signed list.

### 1.4 What we MUST prevent (in-scope)

- **Trivial cloning**: copy the jar + DB to a new machine and have it boot and
  serve patients with zero vendor involvement.
- **Silent fan-out**: the same authorization being reused across N machines
  without us being able to detect or refuse it.
- **Indefinite use after subscription ends** without *some* enforcement point.

### 1.5 What we accept we CANNOT prevent (out-of-scope — be honest)

Per the ADR-042 doctrine, on **hardware the client controls** there is a hard
ceiling. A determined attacker can, given enough effort:

- **decompile** the jar (Java bytecode → readable source) and **patch out** the
  license check entirely (`if (valid) ...` → `if (true) ...`), then repackage;
- **extract the embedded public key** — but that buys them nothing on its own,
  since they cannot forge a vendor signature without the *private* key (which
  never leaves our infrastructure);
- **freeze the system clock / set the date back** to dodge an expiry;
- **spoof hardware signals** in a VM to mimic an authorized fingerprint.

> **The honest bottom line, stated up front (mirrors ADR-042):** software alone,
> on a machine we do not own, cannot make unauthorized deployment *impossible*.
> What it **can** do is make it cost real, deliberate, technical, and
> **legally-evidenced** effort — turning a 10-minute copy-paste by a technician
> into a tampering act that (a) requires bypassing crypto, (b) leaves the
> instance unable to pass our online revocation check, and (c) is an explicit
> breach of the subscription contract. The technical layer **raises the bar and
> produces evidence**; the **contract** is the real deterrent. We design for
> "expensive and detectable", not "impossible".

---

## 2. Requirements

| # | Requirement | Rationale |
|---|---|---|
| R1 | **Works fully offline at boot.** A cabinet with no internet must still start and serve patients. | Moroccan on-prem reality: intermittent / no connectivity (ADR-006). Internet is *not* on the critical path of patient care. |
| R2 | **Never lock out a paying customer because OUR server is unreachable.** | A vendor outage must never stop a cabinet from treating patients. Liability + reputation. |
| R3 | **Grace periods, not hard cliffs.** Expiry / unreachable-vendor degrades gracefully (warn → read-only) before any hard stop. | Patient safety + goodwill. |
| R4 | **Hard for a technician to clone to another machine.** Copying jar+DB to a new box should not yield a working, authorized instance. | The core ask. |
| R5 | **Bound to a vendor authorization that only WE can mint.** No vendor private key on any client machine, ever. | Asymmetric crypto: clients verify, only we sign. |
| R6 | **Auditable.** Every license-state decision (valid / grace / blocked) is logged locally and, when online, reported to the vendor. | ADR-042 "produce evidence"; supports billing disputes. |
| R7 | **Renewable without a site visit.** Monthly subscription → renewal must be a remote, low-friction operation (drop a new file / one online call). | We sell monthly; we cannot drive to every cabinet each month. |
| R8 | **No new heavy dependency / no broker.** On-prem single process (ADR-020). Use JDK crypto. Front-end deps still bound by ADR-015/016/017. | Project constraints. |
| R9 | **Same codebase, mode-gated.** Cloud (`prod-cloud`) and dev profiles must not be hobbled by on-prem licensing. | One jar, three modes (ARCHITECTURE.md). |
| R10 | **Tamper-evident clock handling.** Detect obvious clock roll-back without making a legitimately-offline cabinet a false positive. | R1/R3 vs. clock-attack tension. |

---

## 3. Options analysis

### Option (a) — Offline signed license file + machine binding

Vendor issues a **license file** signed with the **vendor private key**, bound
to a cabinet id and a machine/cabinet fingerprint. The app embeds the **vendor
public key** and verifies the signature at boot; refuses to start (or drops to
read-only) if the signature is invalid, the fingerprint mismatches, or the
license is expired.

- **Pros**
  - Fully offline (R1, R2): no network at boot, ever.
  - Only the vendor can mint a valid license (R5): asymmetric crypto.
  - Machine binding (R4): a copied license fails the fingerprint check on the
    new box.
  - Tiny: JDK `Signature` (Ed25519 / RSA-PSS), no new dependency (R8).
- **Cons**
  - **Revocation is weak**: once issued, an offline-only license is valid until
    its expiry. A leaked/abused license can't be killed mid-term without an
    online channel.
  - Renewal = ship a new file every month (R7 OK but operationally chatty).
  - Clock roll-back can extend an expired license offline (R10).

### Option (b) — Online activation + periodic heartbeat, with offline grace

App **activates** against a vendor activation server on first run (machine
fingerprint → server returns an entitlement), then **heartbeats** periodically
to stay alive. If the server is unreachable, an **offline grace window** keeps
it running.

- **Pros**
  - **Strong revocation** (R6): vendor can refuse activation / stop renewing
    heartbeats instantly for an abusive install.
  - Vendor sees a live fleet (audit, billing reconciliation).
  - Per-machine activation naturally enforces one-install-per-authorization
    (R4): a clone phones home with the same fingerprint → server detects the
    duplicate.
- **Cons**
  - **Violates R1/R2 if mandatory**: a cabinet that is *born* offline can never
    activate. A long vendor outage eventually expires every cabinet → exactly
    the lock-out we forbid.
  - Requires us to **run and keep up** a highly-available activation service —
    operational cost and a single point of failure for the whole fleet.
  - Grace window is a guess: too short → false lock-outs; too long → toothless.

### Option (c) — Hybrid: offline signed license for boot + OPTIONAL online revocation check  ✅ recommended

Boot is governed by an **offline signed license** (Option a) — so the cabinet
**always starts offline** within the license validity (satisfies R1/R2). Layered
on top, **when** the internet is available, the app makes a **best-effort,
non-blocking online check** against the vendor for **revocation** and to **pull
the next renewal** automatically.

- **Pros**
  - Boots offline (R1/R2) **and** gets revocation + auto-renewal when online
    (R6/R7) — the best of (a) and (b).
  - Online check is **advisory, not gating**: vendor outage → cabinet keeps
    running on its valid offline license (R2).
  - Machine binding from (a) blocks trivial clones (R4); the online check is the
    second net that catches a clone that *does* reach the internet.
  - Auto-renewal turns the monthly subscription into a background refresh, not a
    monthly file-drop (R7).
- **Cons**
  - Two code paths (offline verify + online refresh) to build and test.
  - Revocation only bites **when the abusive instance is online** — an
    air-gapped pirate copy escapes revocation until its offline license expires.
    Accepted: bounded by license TTL, and air-gapped careplus is degraded
    anyway (no backup, no updates, no support).

### Why pure obfuscation / a bare kill-switch is weak (rejected as a standalone)

- **Obfuscation** (ADR-042 étapes B/C) hides *source*, not *behaviour*. It does
  nothing to stop a technician from *running* a faithful copy — the program
  works exactly the same; there is no authorization gate to obfuscate.
- A **bare kill-switch** (a boolean the vendor flips) needs an online channel to
  flip → fails R1/R2, and if it's offline it's just a config flag the technician
  edits. A kill-switch is only meaningful **on top of** signed authorization
  (which is what the online revocation layer of Option (c) is).
- Neither produces the **cryptographic binding** that makes "deploy elsewhere"
  actually fail. They are complements, not the mechanism.

**Decision direction → Option (c).** Justification under §5.

---

## 4. Machine / cabinet fingerprint

The fingerprint is the anti-clone anchor (R4). Its central tension:

> **Stable across legitimate change (reboots, OS updates, jar upgrades,
> disk-imaging-as-backup) ↔ Hard to reproduce on a *different* machine.**

Too strict → a NIC swap or Windows reinstall falsely invalidates a paying
cabinet (a worse failure than a missed clone). Too loose → a `cp -r` clone
inherits it.

### 4.1 Components (combine, don't rely on one)

1. **Install UUID (the anchor).** Generated once at first boot, stored in the
   **database** (`license_install` row, see §8) **and** mirrored to a file
   outside the jar. This is *ours*, not a hardware signal — it survives OS/jar
   updates and is what the vendor actually binds the license to.
2. **Hardware signals (the anti-clone salt).** A small bag of OS-readable,
   reasonably-stable values, e.g. on Windows:
   - machine GUID (`HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid`),
   - primary volume serial,
   - motherboard/BIOS UUID (WMI `Win32_ComputerSystemProduct.UUID`).
   Hashed together into a `hardwareDigest`.
3. **Cabinet identity** (cabinet id from `configuration_clinic_settings`) — ties
   the license to *who*, for audit/billing, not for anti-clone.

`fingerprint = SHA-256( installUuid ‖ hardwareDigest )`, with the **individual
hardware signals also reported** so the vendor can do **fuzzy / N-of-M**
matching rather than exact match.

### 4.2 Stability strategy (avoid false lock-outs)

- **N-of-M tolerance**: bind to several hardware signals; require *most* (e.g.
  2 of 3) to still match. A single component changing (new disk, NIC) does **not**
  invalidate.
- **Install UUID dominates**: as long as the DB (or its mirror file) is intact,
  the install is recognized. A clone that copies the DB *also* copies the UUID —
  which is exactly why the UUID alone is insufficient and must be **salted with
  hardware** that the clone won't reproduce.
- **Re-binding ("license repair")**: a legitimate hardware change (machine
  replacement after a crash) is handled by a vendor-side **re-issue** of the
  license to the new fingerprint — a support operation, not a customer dead-end.

### 4.3 Honest limit

A **full VM/disk image** clone reproduces *both* the install UUID *and* most
hardware signals (virtualized motherboard UUID etc.), so the fingerprint check
alone won't catch a perfect image clone. That residual is exactly what the
**online revocation/heartbeat** layer of Option (c) is for: two identical
fingerprints both phoning home is a detectable duplicate. And it remains a
**contract** breach regardless (ADR-042 doctrine).

---

## 5. Recommended design (Option c — offline signed license + machine binding + optional online revocation)

Chosen because it is the only option that satisfies **R1 + R2 simultaneously**
(boot offline, never lock out on vendor outage) **while** providing revocation
and auto-renewal (R6/R7) for cabinets that *do* have intermittent connectivity —
the exact Morocco on-prem profile in ADR-006. It also reuses existing project
patterns (fail-fast config validation à la `JwtSecretValidator`,
`@TransactionalEventListener`, JDBC-only persistence) and adds **zero runtime
dependency** (JDK crypto), respecting R8 / ADR-015–017.

### 5.1 License issuance flow (vendor side)

```
Cabinet onboarding / first boot
      │  app generates installUuid + reports fingerprint (offline: shown in UI / logs;
      │  online: posted to vendor) 
      ▼
Vendor signing CLI  (holds PRIVATE key, NEVER on a client machine)
      │  inputs: cabinetId, plan, issuedAt, expiresAt (e.g. now + 35 days), fingerprint
      │  output: license.jwt-like token  (payload + Ed25519 signature)
      ▼
Delivered to cabinet  (online auto-pull, OR emailed file dropped next to the jar)
      ▼
App verifies at boot with EMBEDDED PUBLIC key → runs
```

### 5.2 What the license contains

A compact signed token (JWS / Ed25519-signed JSON — Nimbus is already a
dependency for JWT, so no new lib):

```jsonc
{
  "v": 1,
  "cabinetId": "uuid",          // who
  "installUuid": "uuid",        // the anchor this is bound to
  "fingerprint": "sha256-hex",  // machine binding (N-of-M components also listed)
  "plan": "STANDARD|PREMIUM",
  "issuedAt":  "2026-06-02T00:00:00Z",
  "expiresAt": "2026-07-07T00:00:00Z",   // monthly + grace headroom
  "graceDays": 14,                        // soft-fail window after expiry
  "revocationUrl": "https://license.careplus.ma/v1/check", // optional online layer
  "licenseId": "uuid"           // for revocation lists / audit
}
// + detached Ed25519 signature by the vendor private key
```

### 5.3 Where it's stored

- **Primary**: a file `license.careplus` in the external config directory
  **next to the jar**, *not inside* it (so renewal = replace the file, no
  rebuild; mirrors how secrets already live outside the jar per ADR-042 étape A).
- **Mirror**: license metadata + the install UUID also persisted in the DB
  (`license_install`, §8) so a lost file can be diagnosed and so audit has a
  record. The **public key** ships **inside** the jar (§6).

### 5.4 Boot-time verification (the gate)

A fail-aware validator (pattern: `JwtSecretValidator`) runs at startup and
classifies the instance into a **state** (§7), *not* a naive boolean:

1. Load `license.careplus`. Missing → state `MISSING`.
2. Verify Ed25519 signature with the embedded public key. Bad → `INVALID`.
3. Recompute fingerprint; compare N-of-M to the license. Fail → `FINGERPRINT_MISMATCH`.
4. Check `expiresAt` vs. *trusted now* (§7 clock handling). Past → `EXPIRED`
   (then sub-classify within / beyond `graceDays`).
5. All good → `VALID`.

The validator **only gates the on-prem profile** (R9): in `dev`/`test`/`prod-cloud`
it logs and passes (cloud instances are vendor-operated; dev must never need a
license).

### 5.5 Behaviour on expiry / mismatch — graded, never an abrupt cliff (R3)

- `VALID` → run normally.
- `EXPIRED` but **within grace** → run normally + **persistent banner**
  ("Abonnement à renouveler — N jours restants") + nag the online refresh.
- `EXPIRED` **beyond grace** → **read-only mode**: existing data fully
  *readable/exportable* (patients can still be seen, PDFs printed, data
  exported), but **writes blocked** with a clear "abonnement expiré" message.
  **Never** delete or hide patient data. This is the hard-but-humane stop.
- `FINGERPRINT_MISMATCH` / `INVALID` / `MISSING` → see §7 table. Clone case
  (`FINGERPRINT_MISMATCH`) is the strictest because it is the actual threat,
  but **still** lands in a recoverable state (contact vendor to re-bind), not a
  data-destroying one.

### 5.6 Online revocation + auto-renewal (the optional layer)

A **scheduled, best-effort, non-blocking** task (`@Scheduled`, e.g. daily) —
running through the same `@TransactionalEventListener(AFTER_COMMIT)` /
out-of-request-path discipline as notifications (ADR-040):

- POSTs `{licenseId, cabinetId, fingerprint}` to `revocationUrl`.
- **Revoked** → schedule transition to read-only at next boot (with grace +
  banner first); logged + audited.
- **Renewal available** → download the new signed license, atomically replace
  `license.careplus`. The monthly subscription thus **auto-renews silently**
  while the cabinet has occasional connectivity (R7).
- **Server unreachable / offline** → **do nothing** (R2). The offline license
  alone keeps the cabinet alive until its own expiry+grace.

### 5.7 Renewal model for the monthly subscription

- Default issued TTL = **~35 days** (one month + headroom) with **14 grace
  days** — so a cabinet that pays monthly and is online even occasionally never
  notices a renewal. A cabinet that goes silent (stopped paying *or* extended
  outage) glides: warn → grace → read-only, over ~7 weeks total. That window is
  a knob for the lead to set (open question OQ3).

---

## 6. Key management

- **Vendor keypair**: **Ed25519** (small, fast, JDK-native via
  `KeyPairGenerator.getInstance("Ed25519")` on JDK 21). RSA-PSS acceptable
  fallback. **Private key lives only on vendor infrastructure** (a password
  manager / HSM / the signing CLI's secured host) — **never** in the repo, the
  jar, CI, or any client machine (R5).
- **Public key in the jar**: shipped as a resource (`license/careplus-pub.ed25519`)
  on the classpath. Embedding it is fine — a public key cannot mint licenses.
  An attacker who replaces it must also re-sign the jar's own integrity (and is
  now squarely in "patched the binary" territory = contract breach + fails
  online check).
- **Key rotation**: support **a list of trusted public keys** (`keyId` in the
  license header → match against bundled keys). To rotate: ship a new jar
  carrying both old and new public keys, start issuing licenses under the new
  `keyId`, retire the old key once all licenses have rolled over. This avoids a
  flag-day. Compromise of the **private** key = rotate immediately + revoke all
  licenses signed under it via the online layer.

---

## 7. Failure & grace behaviour (explicit)

"Trusted now" = `max(systemClock, lastSeenTimestampPersistedInDB)`. We persist a
monotonic "high-water" timestamp on each boot/heartbeat; the clock can't be
*rolled back* below it without being caught (R10). We do **not** hard-fail on
clock skew alone, to avoid punishing a legitimately-offline cabinet whose RTC
drifted.

| Situation | Online? | App behaviour | Data | Audit |
|---|---|---|---|---|
| **License VALID** | n/a | Run normally | full r/w | log `VALID` at boot |
| **License MISSING** | offline | Start in **read-only** + prominent "licence absente, contacter l'éditeur" banner; allow data export | read-only, never wiped | local audit `MISSING` |
| **License MISSING** | online | Same read-only, but auto-attempt activation/pull; if vendor issues → flip to VALID without restart | read-only → r/w on success | report to vendor |
| **EXPIRED, within grace** | either | Run **normally** + countdown banner; nag renewal | full r/w | `EXPIRED_GRACE` + days left |
| **EXPIRED, beyond grace** | either | **Read-only**; writes blocked w/ "abonnement expiré"; export allowed | read-only, intact | `EXPIRED_HARD` |
| **FINGERPRINT_MISMATCH** (suspected clone) | offline | **Read-only** + "installation non autorisée sur cette machine — contacter l'éditeur"; no data destruction | read-only, intact | `FINGERPRINT_MISMATCH` — high-severity local log |
| **FINGERPRINT_MISMATCH** | online | Same + report duplicate fingerprint to vendor (clone detection) | read-only | vendor-side duplicate alert |
| **INVALID signature** (tampered/corrupt license) | either | **Refuse writes** (read-only) + "licence invalide"; treat as serious | read-only | `INVALID` high-severity |
| **Clock rolled back** (now < high-water) | either | Use high-water as trusted now (so a past-dated expiry still expires); banner "horloge incohérente" | per resulting state | `CLOCK_ROLLBACK` flagged |
| **Vendor server down** | online attempt fails | **No effect** — keep running on offline license (R2) | unchanged | `VENDOR_UNREACHABLE` (info) |

Design rule across the whole table: **the worst outcome is read-only, never
data loss and never a silent dead service.** A cabinet always retains access to
its own patient records; what we withhold is the *right to keep operating an
unauthorized/expired install for new work*.

---

## 8. Implementation sketch (high level)

Module `ma.careplus.licensing` (follows the standard module layout;
JDBC-only persistence like dashboard/chat/assistant — no JPA entity needed for
a single-row-ish concern).

**Where it hooks in Spring Boot startup**

- `LicenseVerifier` — a `@Component` with `@PostConstruct` (exactly the
  `JwtSecretValidator` pattern) **or** an `ApplicationRunner`. It computes the
  fingerprint, loads + verifies `license.careplus`, and resolves a
  `LicenseState`. It is **profile-gated**: active only when the deployment mode
  is `ON_PREMISE` (read `careplus.deployment-mode`); a no-op bean in
  `dev`/`test`/`prod-cloud` (R9).
- Decision: **fail-fast vs. degrade.** We do **not** `throw` to abort the JVM on
  expiry/mismatch (that would be a "silent dead service", forbidden by §7).
  Instead the verifier publishes the resolved `LicenseState` into a singleton
  `LicenseStateHolder` bean, and:
  - a `LicenseWriteGuard` (a small `HandlerInterceptor` or a method-level
    `@PreAuthorize`-style check) **blocks mutating endpoints** (POST/PUT/PATCH/
    DELETE under `/api/**`, except auth + the license/export endpoints) when the
    state is read-only.
  - the SPA reads `GET /api/license/status` and renders the banner / read-only
    chrome.
  - **Truly hard-fail only** on a *grossly* invalid state if the lead prefers
    (e.g. `INVALID` signature in `ON_PREMISE`) — kept as a config knob, default
    = read-only.

**New migration (state we store)**

- `Vxxx__licensing_install.sql` — `license_install` table:
  `id`, `install_uuid` (UNIQUE), `cabinet_id`, `fingerprint`,
  `license_id`, `plan`, `issued_at`, `expires_at`, `grace_days`,
  `last_state`, `clock_high_water TIMESTAMPTZ`, `last_vendor_check_at`,
  plus the standard audit columns (`created_at/updated_at`, ARCHITECTURE.md).
  Single logical install row; history of state changes can go to the existing
  `identity_audit_log` rather than a new table.

**Online layer**

- `LicenseRefreshTask` — `@Scheduled` daily, `RestClient` (already used by the
  assistant module, ADR-039 — no new dep), best-effort, swallows network
  failures into a `VENDOR_UNREACHABLE` audit line. Mirrors the notification
  module's "never block the business path" discipline (ADR-040).

**Vendor-side tooling (separate, NOT shipped to clients)**

- A tiny **signing CLI** (`tools/license-cli/`, a standalone Java main or a
  Maven `exec` goal) that:
  - generates/holds the keypair (key kept in vendor secret store);
  - takes `cabinetId, fingerprint, plan, ttlDays, graceDays` → emits a signed
    `license.careplus`;
  - optionally maintains a revocation list served by `revocationUrl`.
- A minimal **activation/revocation endpoint** (could even be a static
  signed-file host + a small function) for the online layer. Deliberately
  lightweight so vendor-side availability is not a fleet-wide SPOF (the offline
  license is the real backstop).

**No new client runtime dependency** — JDK `KeyPairGenerator`/`Signature`
(Ed25519) + Nimbus (already present) cover signing/verification. Front-end gets
only a status hook + banner (no new lib → ADR-015/016/017 satisfied).

---

## 9. ADR draft (ready to paste into `docs/DECISIONS.md`)

> Append at the bottom of `docs/DECISIONS.md`. **Chosen number: ADR-045**
> (sequential max in the file is ADR-044; note the file already contains a
> duplicate `ADR-040` — *Notifications* and *SUPER_ADMIN* — which the lead may
> want to renumber separately; this draft does not reuse 040).

---

### ADR-045 — Deployment authorization & licensing: offline signed license + machine binding + optional online revocation (supersedes ADR-010)

**Date**: 2026-06-02
**Status**: proposed (supersedes **ADR-010** "Commercial model: monthly subscription, managed manually in v1 — no license module")

**Context**: ADR-010 deferred any licensing, betting flag-based enablement was
enough while we sold to <5 cabinets. Product-owner request reverses that: a
field technician who holds the installer can re-deploy careplus for **other**
cabinets without vendor approval. We need each running on-prem install to be
**cryptographically bound to a vendor-issued authorization**. Constraints are
the Morocco on-prem reality (ADR-006): intermittent/no internet, one Windows
service per cabinet (ADR-020), and the ADR-042 doctrine that nothing is
unbreakable on client hardware — the realistic goal is to **raise the bar and
produce evidence**, backed by the subscription contract.

**Decision**: Introduce a `ma.careplus.licensing` module implementing a
**hybrid** scheme:
- **Offline signed license** (`license.careplus`, Ed25519-signed by a
  vendor-only private key, verified at boot with a public key embedded in the
  jar) governs startup — so a cabinet **always boots offline** within validity.
- **Machine binding** via `fingerprint = SHA-256(installUuid ‖ N-of-M hardware
  signals)` so a copied license/jar fails on a different machine.
- **Optional, best-effort online layer** (`@Scheduled`) for **revocation** and
  **auto-renewal** of the monthly subscription — **non-blocking**: vendor
  outage never affects a cabinet (R2).
- **Graded enforcement, never a cliff and never data loss**: VALID → r/w;
  EXPIRED-within-grace → r/w + banner; EXPIRED-beyond-grace / clone / invalid →
  **read-only** (data fully readable & exportable, writes blocked).
- **On-prem profile only**; `dev`/`test`/`prod-cloud` are no-ops.
- **No vendor private key on any client machine**; public-key list supports
  rotation by `keyId`. **No new client runtime dependency** (JDK crypto +
  Nimbus + RestClient already present).
- Vendor-side: a standalone **signing CLI** (not shipped to clients) and a
  lightweight activation/revocation endpoint.

**Consequences**:
- New module + `Vxxx__licensing_install` migration (`license_install` +
  `clock_high_water` for roll-back detection); state-change audit via existing
  `identity_audit_log`; `GET /api/license/status` + a write-guard interceptor;
  SPA banner/read-only chrome.
- We now **operate vendor key material and (optionally) a revocation service** —
  new ops responsibility; mitigated by the offline license being the backstop
  so the service is not a fleet SPOF.
- **Honest limit (carried from ADR-042)**: a determined attacker can decompile
  and patch out the check, or VM-clone a full image; we do **not** claim
  unbreakability. We make unauthorized deployment *expensive, detectable
  (duplicate fingerprints online), and a contract breach*. The **contract clause**
  (ADR-042 étape D) remains the primary legal deterrent; this ADR is the
  technical layer that gives it teeth and evidence.
- Supersedes ADR-010; manual subscription handling is replaced by
  auto-renewing signed licenses for on-prem installs.

---

## 10. Open questions for the lead

- **OQ1 — Enforcement hardness.** On `EXPIRED-beyond-grace` and
  `FINGERPRINT_MISMATCH`, is **read-only** the right floor, or do you want a
  full hard-stop (refuse boot) for the clone case specifically? (Draft default:
  read-only everywhere; data never lost.)
- **OQ2 — Fingerprint strictness.** Which hardware signals, and what N-of-M
  threshold? How do we want to handle a legitimate machine swap — a vendor
  re-issue (support ticket) only, or a self-service "transfer" with limits?
- **OQ3 — TTL & grace knobs.** Confirm license TTL (~35 d?) and grace (~14 d?).
  These set how long a non-paying / long-offline cabinet keeps full function.
- **OQ4 — Do we build the online layer in v1, or ship offline-license-only
  first?** Offline-only is far simpler and already blocks the technician-clone
  case (R4); revocation/auto-renewal can be a fast-follow. (Draft leans:
  offline license in phase 1, online layer phase 2.)
- **OQ5 — Vendor key custody.** Where does the Ed25519 private key live (pass
  manager? HSM? air-gapped signing host?) and who can run the signing CLI?
- **OQ6 — Activation UX.** First-boot offline: how does the cabinet get its
  fingerprint to us (display-in-UI + email? printed onboarding sheet?) so we can
  mint the first license before they have connectivity?
- **OQ7 — Cloud instances.** Confirm `prod-cloud` (Fly.io staging) stays
  un-licensed (vendor-operated). Any future *cloud-sold* cabinet would need a
  different entitlement model — out of scope here?
- **OQ8 — ADR-040 duplicate.** The licensing ADR is **ADR-045**; separately,
  do you want me to renumber the existing duplicate `ADR-040`
  (Notifications vs SUPER_ADMIN) so future numbering stays clean?
- **OQ9 — Contract clause.** Confirm Legal will add the
  non-redeployment / one-cabinet-per-license clause (ADR-042 étape D) — the
  technical scheme assumes it as the real deterrent.
