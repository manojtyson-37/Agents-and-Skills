---
name: feedback-universal-editability
description: "Expense Tracker — all data items must support inline edit, not just add/delete. User requested as pattern."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 75283598-f5cc-4afa-915a-b54082dbaf64
---

Every item type (Expense, Subscription, Loan, Category, Account) must be editable inline after creation.

**Why:** User feedback from 2026-07-02 — add-only UI is incomplete. Editability is expected as a universal pattern across item management.

**How to apply:** When building item-list or form UI, include edit mode in initial spec. Don't ship add/delete without edit. Check Expense Tracker modals for completeness.
