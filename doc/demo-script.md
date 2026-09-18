# Demo video script — VeriShield (2:00–3:00)

Recorded against the **current live build**: the three-portal web app driving the
compiled Compact circuits through the in-browser circuit simulator.

> **Honesty rule (Phase 5):** every line below matches what the app does *today*.
> Any narration that would claim "on Midnight Preprod", a live on-chain address,
> or "real SNARK" is written out of the script. Three lines are marked
> `[WHEN REAL PREPROD + PUBLIC URL EXIST]` — swap them in later without touching
> the rest.

---

## Setup for recording (30 seconds, not part of the video)

- Machine: Node 22 + pnpm, `pnpm install`, run `pnpm dev` → http://localhost:3000
- Window 1: browser (app). Window 2: terminal running `pnpm test:e2e-crypto` (only used in the revoke beat)
- Recommended: 1080p screen capture, cursor ring off, browser devtools closed

---

## 0:00–0:20 — Problem statement

**Visual:** landing page (headline "VeriShield", the three-portal cards).

> "Today, proving one fact costs you your whole certificate. A job portal only
> needs to know you graduated — yet you hand over your degree, your marks, your
> date of birth. VeriShield swaps that for a zero-knowledge proof: the verifier
> gets exactly one boolean — `{ proofValid: true }` — and nothing else."

**Don't say:** anything about a live Midnight network yet. The landing page has
no network claim.

---

## 0:20–0:50 — Issuer: register + issue

**Visual:** Issuer console (*Issuer* portal).

1. Click into the **Issuer** portal. The registry card is visible: Issuer ID,
   verifying key, credential count, and the contract line `<addr>…` *(this is the
   in-memory simulator ledger address — do NOT narrate it as on-chain)*.

> "The issuer engine is running — operating as Pune University. You can see its
> registered issuer id and verifying key. That verifying key is what every proof
> will be checked against."

2. Click **Issue credential**. Fill: holder *Anjali Verma*, degree *Bachelor in
   Computer Science*, CGPA *8.5*, DOB *2002-08-19*. Click **Issue**.

> "We issue a degree for Anjali. Only a commitment — a hash — gets anchored into
> the shielded registry. Her name, CGPA and date of birth never appear."

3. The "Anchoring on chain" modal spins, then "Credential issued" shows the
   **Credential ID** and **Commitment**.

> "Here's the commitment that was anchored, and here's its credential id. The
> issuer signs the commitment with its JubJub key — that signature is what
> proves *this* issuer, not a random claimant, created it."

**Don't say:** "broadcast to Preprod", "mined", "5 confirmations". It is an
in-browser circuit-runtime transaction.

---

## 0:50–1:30 — Holder: disclosure preview + proof

**Visual:** Holder wallet (*Holder* portal), proof modal.

1. Open the **Holder** portal — Anjali's degree is in the vault.

> "The credential lands in the holder's wallet. Private fields — name, grade,
> DOB — are hidden behind masked rows: they never leave this browser."

2. Click **Generate proof**. The claim chooser appears (CGPA ≥ 7.5, Degree equals,
   Holds a valid credential, Not expired). Point at the **"What the verifier receives"**
   panel: `{ proofValid: boolean }`, and Name / Degree / CGPA / DOB all `[PRIVATE]`.

> "Before proving, the wallet previews exactly what will be shared: one boolean.
> Not the name. Not the CGPA — not even the DOB. The verifier will learn whether
> the claim is true, and nothing else."

3. Pick **"CGPA is at least 7.5"**, click **Prove in circuit**.

> "We prove: CGPA ≥ 7.5, without revealing the exact 8.5. That's the whole point."

4. The result card appears: `{ proofValid: true }`, engine **circuit-simulator**,
   `zk-proven: false`, circuit `~30 ms`.

> "The circuit answers: `{ proofValid: true }`, in around thirty milliseconds.
> Note the engine label — circuit-simulator. These are real circuit transcripts,
> not yet a proof-server SNARK. The app tells you this explicitly rather than
> hiding it."

---

## 1:30–2:05 — Verifier: reveal + redaction

**Visual:** Verifier console (*Verifier* portal), then Issuer revoke, then terminal.

1. Click **Verify it** → lands in the **Verifier** console. Select the artifact,
   click **Verify**.

> "The verifier console runs the check against the issuer's registered key."

2. Result card springs up: `{ proofValid: true }` → **"Claim verified"**. The
   **"Not transmitted"** panel lists Full name, Roll number, Marks / CGPA,
   Date of birth, Issuer details — every row `[REDACTED]`.

> "And here's the reveal. `{ proofValid: true }`. And the redacted-data panel: all
> five personal fields, marked not-transmitted. The entire payload the verifier
> received was one boolean."

3. (Amber warning visible.) Zoom on the line:
   *"Circuit-simulator transcript. A proof server is required for a real SNARK."*

> "The app is honest about this warning — the simulator transcript isn't a real
> SNARK yet. That's a stated gap on the road to production."

4. **Live revoke.** Go to **Issuer** → click **Revoke** on Anjali's degree. Badge
   flips to **Revoked**.

> "Now we revoke the credential. One click in the issuer console — the credential
> is now in the revocation set. Watch what happens to new proofs."

5. Back to **Holder**: the "Generate proof" button on that credential is now
   disabled. Cut to terminal window:

```text
6. Revocation
  ✓ revoked credential can no longer be proven  failed assert: Credential has been revoked
```

> "Any new proof attempt is rejected in-circuit — the assertion is literally
> 'Credential has been revoked'. A revoked credential can't be proven, period."

**Don't say:** "re-verifying the old proof now fails" — the current verifier does
a structural check, so a previously minted artifact still reads valid. New proof
generation is what the circuit gates.

---

## 2:05–2:30 — Close

**Visual:** app landscape (or issuer console), then a simple end card.

> "VeriShield: prove a claim, not a certificate. The contract keeps the issuer
> registry and commitments; the holder's data stays private; the verifier learns
> one boolean. Live demo — link in the README. Contract on Midnight Preprod —
> address in the README. [Show whichever of the two now exist.]"

**End card (mirrors README):**
- Live app: `[WHEN DEPLOYED — replace with the Vercel URL]`
- GitHub: `github.com/pratikshakalbhor/verishield`
- Contract (Preprod): `[REPLACE with the real address once deployed]`

---

## Accuracy notes (do not cut these)

1. Everything runs in-browser on the **circuit-simulator engine** (`zk-proven: false`).
   Never say "on-chain", "broadcast", "mined" or "SNARK" about the current build.
2. The contract address shown in the Issuer card is the in-memory simulator address.
3. After revocation, proof **generation** is blocked; verification of previously
   minted artifacts stays structural (still valid). The script demonstrates the
   circuit rejection via the e2e terminal output.
4. Expected per-proof circuit time ≈ 25–40 ms (varies by claim/CPU) — quote "about
   thirty milliseconds", not an exact number.