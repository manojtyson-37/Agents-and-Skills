---
name: feedback-ios-keyboard-modal
description: "iOS bottom sheet modals with fixed inset-0 don't shrink when keyboard opens — save/submit button hidden behind keyboard"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b4d351bf-5138-4889-8dcf-7a27b41bcdc2
---

Bottom sheet modals using `fixed inset-0 flex items-end` do NOT resize when the iOS soft keyboard opens. Any content at the bottom of the scrollable region (save button, submit, etc.) gets hidden behind the keyboard. Users can't scroll past the keyboard to reach it.

**Why:** iOS doesn't shrink `fixed` positioned elements when the virtual keyboard appears. `inset-0` stays full-screen but keyboard overlaps the bottom. `overflow-y-auto` doesn't help if the keyboard covers the scroll target.

**How to apply:** When building bottom sheet modals that contain forms:
1. Split the modal into header (shrink-0) + scrollable content (flex-1 overflow-y-auto) + sticky footer (shrink-0)
2. Put the primary action button in the sticky footer OUTSIDE the scroll region
3. Footer padding: `pb-[max(1.25rem,env(safe-area-inset-bottom))]`
4. Never put the submit/save button inside the scrollable content area — it will be hidden on mobile when keyboard is open
5. **z-index trap:** If the app has a fixed NavBar (z-50) rendered AFTER page routes in DOM order, it will stack on top of a modal with the same z-50, covering the save button even without a keyboard. Always set modal backdrop to z-[60] (or higher than NavBar) — confirmed bug in Expense Tracker where `<NavBar />` at line 98 in App.tsx came after `<Routes>` at line 86, so DOM order gave NavBar the win at z-50 parity.
