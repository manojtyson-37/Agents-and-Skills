---
name: feedback-mobile-ui-verification
description: Mobile UI fixes must be verified at 390px viewport with a real screenshot — deploy status and DOM inspection are not verification
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b4d351bf-5138-4889-8dcf-7a27b41bcdc2
---

For any mobile UI fix, verification means: resize browser to 390px wide, open the feature, take a screenshot and show it. Checking Vercel deploy status ("state: success") is NOT verification. DOM inspection via JS (querying class names) is NOT verification. Both were done this session and both failed to catch that the NavBar was covering the modal save button.

**Why:** Desktop Chrome has no NavBar covering issue. DOM inspection only checks structure, not visual rendering. PWA cache may serve old JS to the user's device even after deploy succeeds. The only proof that counts is a pixel-level screenshot at mobile dimensions on the actual prod URL.

**How to apply:**
1. For any mobile UI bug fix: use `mcp__Claude_in_Chrome__resize_window` to set 390x844 before taking screenshot
2. Navigate to the real prod URL (not localhost) — confirm with `HashRouter` apps that the URL uses `/#/route` not `/route`
3. Open the specific UI element (click the button, open the modal)
4. Take a screenshot with `mcp__Claude_in_Chrome__computer` action=screenshot, save_to_disk=true
5. Only call the fix verified after seeing the screenshot confirms it
6. When pushing: remind user to hard-reload on mobile (PWA caches old SW — clear site data or use Settings > Update in the app)

Related: [[feedback_ios_keyboard_modal]]
