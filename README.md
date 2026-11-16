# Shareholder Value

A satirical 3D office action game that runs in the browser. You are a new hire at a 2026 tech company.
Battle stakeholders, close tickets (which creates more tickets), get promoted, and drive Shareholder Value
to $1B before the quarter ends. Then face the Chief Vision Officer on the Executive Floor.

## Controls

Attacks auto-aim at the nearest stakeholder you can see. You pick an attack, then fire it.
Hard No also lunges you into range.

### Keyboard and mouse

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Aim (used when nothing is in sight) |
| Left click (hold to repeat) | Fire the selected attack |
| Right click | Reply-All, whatever is selected |
| 1 to 7, or click the icon bar | Select an attack |
| J, K, L, U, I | Cast a skill instantly: Out of Office, Calendar Block, Delegate, Synergy Blast, Strategic Pause (unlock them with Tab). Space also triggers Out of Office. |
| Tab | Skill tree |
| Left / Right arrows | Rotate the camera |
| Scroll | Zoom |
| Esc or P | Pause |
| M | Mute |

Every time you press Clock In, a four-step tutorial (move, fire, skills, burnout) runs first. It cannot be skipped. You can reopen it from "How to play" on the pause screen.

### Phone and tablet

| Input | Action |
| --- | --- |
| Left thumb: joystick icon at the bottom left, or drag anywhere on the left side | Move |
| Right thumb, hold FIRE | Use the selected attack |
| Tap the round selector button above FIRE | Open the quick menu, then tap an attack to select it |
| Star button, next to the attack selector | Skill tree. It pulses and shows a count when you have a point to spend. |
| II button | Pause |

A skill fires once and then your selection returns to your last basic attack. The game works in portrait,
but landscape is better. Add `?touch` to the URL to force the phone layout on a desktop browser.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5183.

## Build and deploy

Every push to `main` builds the game and publishes it to GitHub Pages through
`.github/workflows/deploy.yml`. The game has no server and makes no network calls.

To build it yourself, run `npm run build`. This writes a static site to `dist/` that any static host can serve.

## Where things live

- `src/data/quips.js`: every joke, rank title and ending. Edit this to change the writing.
- `src/enemies/types.js` and `src/enemies/boss.js`: stakeholder stats and behaviour.
- `src/skills.js`: the five unlockable skills.
- `src/economy.js`: Shareholder Value, promotions, the backlog and the quarter timer.
- `src/world/office.js`: the floor plan and furniture.
