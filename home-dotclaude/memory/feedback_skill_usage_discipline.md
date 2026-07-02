---
name: feedback-skill-usage-discipline
description: Skills in the routing table must actually be invoked — user called out that superpowers/verify/cso-learn were not being used effectively despite being mandatory
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b4d351bf-5138-4889-8dcf-7a27b41bcdc2
---

User explicitly flagged (2026-07-01) that superpowers, headroom, and all skills are "not being used effectively." The routing table lists them as mandatory/auto-invoke, but under task pressure they get skipped. This is the same problem that required a Stop hook to enforce — prose rules alone don't survive task pressure.

**Why:** When executing quickly (fixing a bug, pushing a commit), the natural flow is: find it → fix it → push it → done. Skills feel like overhead. But `superpowers:verification-before-completion` exists exactly to catch the class of bugs that slipped through this session (missing z-index check, wrong URL format, no mobile viewport test).

**How to apply:**
- **Before any "CSO: Complete."**: `/cso-learn` MUST run (enforced by Stop hook), AND `superpowers:verification-before-completion` MUST be invoked if code was shipped
- **After any code push to prod**: invoke `/verify` skill with a specific claim ("button is visible at 390px mobile without NavBar overlap") — not "check deployment status"
- **The `/verify` skill protocol**: resize to 390px → navigate to prod `/#/route` → open the UI → screenshot → show proof. DOM inspection alone fails; screenshot is the gate.
- **`superpowers:verification-before-completion`**: maps to running the app + observing behavior before calling done. Use it as a checklist gate, not a formality.
- **Skill invocation is binary**: either the skill ran (tool call visible in transcript) or it didn't. Claiming a skill "informed the approach" without the tool call is not invocation.

Related: [[feedback_unused_routing_table]], [[feedback_hook_hard_enforcement]], [[feedback_mobile_ui_verification]]
