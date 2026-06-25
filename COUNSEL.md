# Counsel review required — HOKU acquisition funnel

> **Status: NOT cleared for live sending.** The outbound acquisition funnel
> (Phases A–D) is built in this repo as software, but its legal and regulatory
> posture has **not** been reviewed. Do not run it against real businesses until
> the items below are signed off by qualified counsel. The code reflects the
> spec's stated guardrails, but per the operator's direction those guardrails
> are currently **minimal stubs flagged for review**, not hardened invariants.

The funnel discovers local businesses, generates a **provisional** website using
the business's name (and brand-derived tokens), screenshots it, and mails a
postcard inviting the owner to claim the site. This touches several areas of law
that vary by jurisdiction and by data-provider contract.

## Open items for counsel

1. **Trademark / right of publicity.** Provisional sites use the business's name
   and may imply affiliation. The spec keeps these private/`noindex` pre-claim,
   but the use of marks — even privately, even in mailed images — should be
   reviewed (Lanham Act, state unfair-competition, dilution, right of publicity).
   *Code posture:* provisional tenants are flagged private; enforcement of
   "never public pre-claim" is a TODO to be hardened (see `lib/acq/`).

2. **Direct-mail regulation.** The postcard must not read as a bill or invoice.
   Federal (e.g. FTC Act §5 deceptive practices; the "negative option" / unordered
   merchandise rules) and **state** solicitation-disclosure statutes (several
   states regulate solicitations that resemble invoices) apply. Required copy:
   sender identity + physical address, an explicit "this is not a bill / you owe
   nothing" statement, and an opt-out path. *Code posture:* template carries this
   copy; there is no automated test asserting the absence of amount-due language
   yet (flagged).

3. **Data-source licensing.** Discovery must use a **licensed** API (Google
   Places) under its terms — no Maps UI/HTML scraping, and content generated from
   provider data must respect caching/attribution/derived-content terms. Confirm
   the Places Terms of Service permit this use (provisional-site generation,
   storing place data, mailing).

4. **Suppression / do-not-contact.** A documented opt-out and suppression list,
   honored before every send, and a defined retention/erasure policy (incl.
   state privacy laws — CCPA/CPRA and similar). *Code posture:* suppression check
   exists in the pipeline; opt-out intake endpoint is a stub.

5. **Ownership verification before transfer.** Claiming must require a second
   factor (verified business email or phone OTP) so a competitor cannot claim a
   site. *Code posture:* verification is modeled but currently minimal.

6. **Privacy / CAN-SPAM-adjacent.** Physical mail is outside CAN-SPAM, but any
   email enrichment or email-based claim verification brings CAN-SPAM and state
   email laws into scope.

## What "minimal, flag for counsel" means in this codebase

Per the operator's explicit direction, the acquisition phases are implemented to
demonstrate the pipeline and data model **without** hard-enforcing every §5
compliance gate. Guardrails appear as clearly-marked `TODO(counsel)` stubs and
this document, rather than as fail-closed, fully-tested invariants. Before any
production use, each item above must be (a) reviewed by counsel and (b) promoted
from stub to enforced-and-tested invariant.

_This file is engineering documentation, not legal advice._
