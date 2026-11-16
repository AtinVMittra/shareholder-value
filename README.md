# Shareholder Value

A satirical 3D office action game that runs in the browser. You are a new hire at a 2026 tech company.
Battle stakeholders, close tickets (which creates more tickets), get promoted, and drive Shareholder Value
to $1B before the quarter ends. Then face the Chief Vision Officer on the Executive Floor.

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Aim |
| Left click | Hard No (melee) |
| Right click | Reply-All (ranged) |
| J, K, L, U, I | Skills: Out of Office, Calendar Block, Delegate, Synergy Blast, Strategic Pause (unlock them with Tab). Space also triggers Out of Office. |
| Tab | Skill tree |
| Left / Right arrows | Rotate the camera |
| Scroll | Zoom |
| Esc or P | Pause |
| M | Mute |

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
