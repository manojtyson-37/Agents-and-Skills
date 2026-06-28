---
name: ui-ux-pro-max
description: >
  AI-powered design intelligence with 67 UI styles, 161 color palettes, 57 font pairings,
  99 UX guidelines, and 25 chart types. Use this skill whenever: the user asks about UI design,
  color schemes, typography, UX best practices, accessibility, dark mode, responsive design,
  component styling, design systems, or says things like "make it look better", "fix the design",
  "what colors should I use", "improve UX", "review the UI", "choose a font". Also use when
  building any new page, component, or doing a design overhaul. Triggers on ANY design-related
  work — even if the user doesn't explicitly ask for design help.
---

# UI/UX Pro Max

Design intelligence engine. Searches a database of styles, colors, fonts, UX guidelines,
and chart types to generate data-driven design recommendations.

## Quick Start

```bash
# Generate full design system for a project
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<product keywords>" --design-system -p "Project Name"

# Search specific domain
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>

# Stack-specific guidelines
python3 ~/.claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack <stack>
```

## When to Use

| Scenario | Command |
|----------|---------|
| New project/page | `--design-system -p "Name"` |
| Choose colors | `--domain color "<product type>"` |
| Choose fonts | `--domain typography "<mood>"` |
| UI style options | `--domain style "<keywords>"` |
| UX review | `--domain ux "<issue>"` |
| Chart/data viz | `--domain chart "<type>"` |
| Landing page structure | `--domain landing "<type>"` |
| React/Next.js perf | `--domain react "<issue>"` |

## Domains

`product`, `style`, `typography`, `color`, `landing`, `chart`, `ux`, `react`, `web`, `prompt`

## Stacks

`react`, `nextjs`, `vue`, `svelte`, `astro`, `swiftui`, `react-native`, `flutter`, `html-tailwind`, `shadcn`, `angular`, `laravel`, `javafx`

## Workflow

1. **Analyze** — extract product type, audience, style keywords, stack
2. **Generate design system** — `--design-system` for full recommendations
3. **Deep dive** — `--domain` searches for specific needs
4. **Stack guidelines** — `--stack` for implementation best practices
5. **Pre-delivery checklist** — verify contrast, touch targets, safe areas, a11y

## Key Rules

- No emojis as structural icons — use Lucide/Heroicons SVGs
- Touch targets >= 44x44pt
- Text contrast >= 4.5:1 (light and dark)
- 4/8dp spacing rhythm
- Test both light and dark modes independently
- Respect safe areas and reduced motion
