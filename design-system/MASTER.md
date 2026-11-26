# Sunil Motors – Design System (admin dashboard)

Source of truth for how the admin app looks and moves. Built with the **ui-ux-pro-max** skill (flat, minimal, Inter) and tuned to the owner's taste: Apple-like, calm, shades of blue.

## Tokens
| Role | Value |
|---|---|
| Canvas | `#f5f5f7` |
| Surface (cards) | `#ffffff`, radius 20px, shadow `0 0 0 1px rgba(0,0,0,.045), 0 1px 3px rgba(0,0,0,.04)` |
| Ink / secondary / muted | `#1d1d1f` / `#6e6e73` / `#86868b` |
| Primary (blue) | `#0071e3`, light end `#5ac8fa`, tint `rgba(0,113,227,.10)` |
| Status | out `#ff453a` on `#fdecea` · low `#ff9f0a` on `#fff3dc` · ok `#30d158` on `#e6f6ea` |
| Radius | 10 (controls) · 14 (rows) · 20 (cards) · 999 (primary buttons) |
| Spacing | 4/8 scale (4, 8, 12, 16, 24, 32) |
| Type | Inter (SF on Apple). Numbers use tabular figures. SKUs in mono, never wrap |

## Motion (one rhythm everywhere)
- Press: scale 0.97, 150 ms. Hover lift: 3 px. Enter: 400–450 ms ease-out-expo. Exit: ~60% of enter.
- Lists/tiles stagger 50 ms. Page switch: 200 ms cross-fade. Selection (sidebar pill, tile ring) glides with a spring.
- Motion must mean something: tiles count up, bars fill on scroll, an icon nudges once when stock needs attention.
- Always honour `prefers-reduced-motion`.

## Feedback (every action answers back within 100 ms)
- Success/error/info **toasts** (aria-live, auto-dismiss 4.5 s, errors 8 s, optional action such as Undo).
- Buttons show a busy state ("Saving…") and are disabled while working.
- Loading uses skeleton shapes, not bare text. Empty states say what to do next.
- Errors say what happened and how to recover.
- **Share feedback** sheet in the sidebar (stars + note) saves to `app_feedback`; admins read it in Settings.

## UX laws applied
- **Fitts** – large targets (≥44 px), primary action is the obvious pill. **Hick** – filters grouped, few choices per screen.
- **Miller** – four stat tiles, not twelve. **Jakob** – familiar sidebar + table patterns.
- **Doherty** – instant feedback, skeletons, no blank waits. **Von Restorff** – only problems (low/out) get colour and a nudge.
- **Aesthetic–usability** – calm spacing and one accent make it feel easier. **Peak–end** – a small animated check after a save.
- **Law of proximity / similarity** – related items share a card; same kind of thing always looks the same.

## Rules
One primary action per screen · semantic colours, not raw hex in new code · no emoji as icons · visible focus ring · colour never the only signal.
