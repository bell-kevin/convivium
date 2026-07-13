<a name="readme-top"></a>

# convivium

https://cooktime.org

**Every dish, done at the same time.**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Built with Vite](https://img.shields.io/badge/built_with-Vite_+_React_+_TypeScript-1F4D3F.svg)](https://vitejs.dev)

Cooking one dish is easy. Cooking four dishes that all need to be hot at 6:30
is a scheduling problem — and most of us solve it badly, in our heads, while
holding a whisk. **convivium** solves it properly: describe each dish as a
list of steps, tell it what your kitchen actually has (how many cooks, how
many burners, how many ovens), pick a serve time, and it computes a single
conflict-free, minute-by-minute plan working *backward* from the moment food
hits the table.

![p](https://github.com/bell-kevin/convivium/blob/main/docs/shot.png)

It knows that hands-on steps need a cook and hands-off steps don't. It knows
a pot of rice occupies a burner even while you ignore it. It knows two dishes
at 425 °F can share one oven, but 425 °F and 350 °F cannot. When something
genuinely can't finish at serve time — one cook can't carve the chicken and
make the gravy simultaneously — it doesn't lie to you; it schedules the loser
earlier and shows the "hold" honestly on the timeline.

Everything runs in your browser. There is no backend, no account, no
analytics. Meals persist in `localStorage`, and sharing works by encoding the
whole meal into the URL *fragment* (`#m=…`), which is never transmitted to
any server.

## Features

- **Backward constraint scheduler** — plans every step so all dishes end at
  serve time, respecting cooks (hands), burner count, oven count, and oven
  *temperature* sharing.
- **Timeline view** — a Gantt-style "stovetop timeline": solid bars are
  hands-on, dashed bars are hands-off, dotted tails are holds, and a yolk-gold
  line marks the one deadline that matters.
- **The ticket** — a printable, chronological checklist of every move with
  clock times, equipment, and durations.
- **Cook mode** — a live countdown with *now / up next / done*, optional
  browser notifications at each step's start, and a screen wake lock so your
  phone doesn't sleep mid-sauté.
- **Sample dinners** — three built-in meals (weeknight salmon, Sunday roast
  chicken, taco night) that exercise the interesting constraints.
- **Meal library & share links** — save meals locally; share them as
  self-contained URLs with zero server involvement.
- **No runtime dependencies beyond React.** The production bundle is ~54 kB
  gzipped.

## How the scheduler works

Time is discretized to whole minutes relative to serve time (serve = 0,
earlier = negative). Each dish is an ordered chain: a step must end before the
next one starts, and the final step must end by serve time. Three renewable
resources are tracked per minute:

| Resource | Consumed by | Rule |
| --- | --- | --- |
| Hands | `active` steps | at most `cooks` concurrent |
| Burners | `stove` steps | at most `burners` concurrent |
| Ovens | `oven` steps | number of **distinct temperatures** in use ≤ `ovens`; same-temperature steps share freely |

The algorithm is classic **backward list scheduling**: repeatedly take, across
all dishes, the unscheduled step with the latest deadline (its successor's
scheduled start, or serve time) and place it as *late* as the resource profile
allows, sliding earlier minute by minute until the whole interval fits.
Placing a step tightens its predecessor's deadline. Ties prefer longer steps,
then hands-on steps, because those are hardest to fit.

The general problem (precedence + cumulative resources, minimize lateness) is
NP-hard, but meal-sized instances are tiny and this greedy heuristic produces
tight, natural timelines. Crucially it is *always feasible* — there's no lower
bound on how early you can start — so contention never fails; it just surfaces
as an honest hold ("green beans finish 17 min early and keep warm") instead of
a physically impossible plan. The whole scheduler is ~200 lines in
[`src/lib/scheduler.ts`](src/lib/scheduler.ts) with a Vitest suite proving the
resource guarantees in
[`src/lib/scheduler.test.ts`](src/lib/scheduler.test.ts).

## Quick start

```bash
npm install
npm run dev      # local dev server
npm test         # scheduler test suite
npm run build    # type-check + production build to dist/
```

Requires Node 18+. The app is a fully static Vite build — host `dist/`
anywhere.

## Using with bolt.new

This project is deliberately shaped for [bolt.new](https://bolt.new): a pure
Vite + React static app with no server, no database, no native binaries, and a
tiny dependency tree, so it runs cleanly in WebContainers and publishes with
one click.

1. Push this repository to GitHub (public).
2. On the Bolt homepage, click the **GitHub icon** below the prompt box,
   connect your GitHub account, then **Import from URL** and paste the repo
   URL.
3. Bolt loads the project; `npm install && npm run dev` just works.
4. Click **Publish** to put it live (Bolt hosting / Netlify integration).

Because Bolt syncs commits back to GitHub, you can keep editing in Bolt, in
your local editor, or both.

## Project structure

```
src/
  lib/
    scheduler.ts       backward list scheduler (the interesting part)
    scheduler.test.ts  resource-guarantee test suite
    types.ts           domain model
    samples.ts         built-in sample dinners
    share.ts           URL-fragment share links
    storage.ts         localStorage persistence
    time.ts            clock/duration formatting
    colors.ts          dish lane palette
  components/
    Editor.tsx         plan view: dishes, steps, kitchen, library
    Timeline.tsx       gantt + printable ticket
    CookMode.tsx       live countdown, notifications, wake lock
  App.tsx              shell, tabs, serve-time control
```

## Roadmap ideas

Cross-dish dependencies ("gravy needs the chicken's drippings"), per-step
hold tolerance ("rice holds fine, seared steak doesn't"), drag-to-reorder,
calendar (`.ics`) export of the ticket, recipe import, i18n, and an
installable offline PWA. Issues and PRs welcome.

## License

Copyright © 2026 Kevin Bell.

This program is free software: you can redistribute it and/or modify it under
the terms of the **GNU Affero General Public License, version 3**, as
published by the Free Software Foundation. See [`LICENSE`](LICENSE) for the
full text.

convivium is client-side software, but the AGPL's network provision still
matters: if you run a modified version for others to use over a network, offer
them the source. The app's footer links back to this repository for exactly
that reason — if you fork and deploy, point that link at *your* source.

--------------------------------------------------------------------------------------------------------------------------

## Automated architecture diagram

This template now includes an automated architecture diagram process:

- `scripts/generate_architecture_diagram.py` scans source files and docs and writes `docs/architecture.mmd`.
- `.github/workflows/update-architecture-diagram.yml` regenerates and commits `docs/architecture.mmd` on every push.
- `.github/workflows/check-architecture-diagram.yml` ensures pull requests have an up-to-date architecture diagram.

### Local usage

```bash
python scripts/generate_architecture_diagram.py
python scripts/generate_architecture_diagram.py --check
```

--------------------------------------------------------------------------------------------------------------------------
== We're Using GitHub Under Protest ==

This project is currently hosted on GitHub.  This is not ideal; GitHub is a
proprietary, trade-secret system that is not Free and Open Souce Software
(FOSS).  We are deeply concerned about using a proprietary system like GitHub
to develop our FOSS project. I have a [website](https://bellKevin.me) where the
project contributors are actively discussing how we can move away from GitHub
in the long term.  We urge you to read about the [Give up GitHub](https://GiveUpGitHub.org) campaign 
from [the Software Freedom Conservancy](https://sfconservancy.org) to understand some of the reasons why GitHub is not 
a good place to host FOSS projects.

If you are a contributor who personally has already quit using GitHub, please
email me at **kevinBell@Linux.com** for how to send us contributions without
using GitHub directly.

Any use of this project's code by GitHub Copilot, past or present, is done
without our permission.  We do not consent to GitHub's use of this project's
code in Copilot.

![Logo of the GiveUpGitHub campaign](https://sfconservancy.org/img/GiveUpGitHub.png)

<p align="right"><a href="#readme-top">back to top</a></p>
