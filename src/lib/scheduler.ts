// convivium — every dish, done at the same time
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only
//
// Backward list scheduling with cumulative resource constraints.
//
// Model
// -----
// Time is discretized to whole minutes, measured relative to serve time
// (serve = 0, earlier = negative). Every dish is an ordered chain of steps:
// step i must END no later than step i+1 STARTS, and the final step of every
// dish must end no later than serve time.
//
// Three renewable resources are tracked per minute:
//   hands   — 'active' steps each occupy one cook for their full duration
//   burners — 'stove' steps each occupy one burner for their full duration
//   ovens   — 'oven' steps occupy an oven AT A TEMPERATURE; any number of
//             steps at the same temperature share one oven, but the number of
//             DISTINCT temperatures in use at any minute cannot exceed the
//             number of ovens.
//
// Algorithm
// ---------
// Classic backward list scheduling: repeatedly take, across all dishes, the
// not-yet-scheduled step whose deadline (its successor's scheduled start, or
// serve time) is latest, and place it as LATE as the resource profile allows,
// sliding earlier minute by minute until the whole interval fits. Placing a
// step tightens the deadline of its predecessor. Ties prefer longer steps,
// then hands-on steps, since those are the hardest to fit.
//
// The result is always feasible (there is no lower bound on how early you can
// start), and any contention shows up honestly as "hold" gaps — e.g. with one
// cook, two dishes that both want a hands-on finish at serve time will have
// one of them finish early and hold. The greedy latest-deadline-first rule is
// a well-known heuristic for this problem class (P|prec,res|Lmax is NP-hard
// in general); for meal-sized inputs it produces tight, natural timelines.

import type {
  Dish,
  Kitchen,
  Meal,
  ScheduledStep,
  ScheduleIssue,
  ScheduleResult,
  Step,
} from './types';

/** Widest window we will ever search: one full day before serve. */
const HORIZON_MIN = 24 * 60;

const DEFAULT_OVEN_TEMP = 350;

interface Occupancy {
  hands: Map<number, number>;
  burners: Map<number, number>;
  /** minute -> set of distinct oven temperatures in use */
  ovenTemps: Map<number, Set<number>>;
}

function stepFitsAt(
  t: number,
  step: Step,
  kitchen: Kitchen,
  occ: Occupancy,
): boolean {
  if (step.attention === 'active') {
    if ((occ.hands.get(t) ?? 0) >= kitchen.cooks) return false;
  }
  if (step.resource === 'stove') {
    if ((occ.burners.get(t) ?? 0) >= kitchen.burners) return false;
  }
  if (step.resource === 'oven') {
    const temp = step.ovenTemp ?? DEFAULT_OVEN_TEMP;
    const temps = occ.ovenTemps.get(t);
    if (temps && !temps.has(temp) && temps.size >= kitchen.ovens) return false;
    if (!temps && kitchen.ovens < 1) return false;
  }
  return true;
}

function occupy(
  fromInclusive: number,
  toExclusive: number,
  step: Step,
  occ: Occupancy,
  skip: { hands: boolean; burners: boolean; oven: boolean },
): void {
  for (let t = fromInclusive; t < toExclusive; t++) {
    if (step.attention === 'active' && !skip.hands) {
      occ.hands.set(t, (occ.hands.get(t) ?? 0) + 1);
    }
    if (step.resource === 'stove' && !skip.burners) {
      occ.burners.set(t, (occ.burners.get(t) ?? 0) + 1);
    }
    if (step.resource === 'oven' && !skip.oven) {
      const temp = step.ovenTemp ?? DEFAULT_OVEN_TEMP;
      let temps = occ.ovenTemps.get(t);
      if (!temps) {
        temps = new Set<number>();
        occ.ovenTemps.set(t, temps);
      }
      temps.add(temp);
    }
  }
}

interface Cursor {
  dish: Dish;
  dishIndex: number;
  /** Index of the next (i.e. latest unscheduled) step in this dish. */
  index: number;
  /** Deadline for that step: start of its already-scheduled successor. */
  latestEnd: number;
}

function pickNext(cursors: Cursor[]): Cursor | null {
  let best: Cursor | null = null;
  for (const c of cursors) {
    if (c.index < 0) continue;
    if (!best) {
      best = c;
      continue;
    }
    const s = c.dish.steps[c.index];
    const b = best.dish.steps[best.index];
    if (c.latestEnd > best.latestEnd) {
      best = c;
    } else if (c.latestEnd === best.latestEnd) {
      if (s.minutes > b.minutes) best = c;
      else if (
        s.minutes === b.minutes &&
        s.attention === 'active' &&
        b.attention !== 'active'
      )
        best = c;
    }
  }
  return best;
}

/**
 * Schedule a meal backward from serve time (t = 0) against the kitchen's
 * resource capacities. Always returns a schedule; genuine impossibilities
 * (e.g. a stove step with zero burners) are reported in `issues` and that
 * constraint is waived for the offending step so the timeline still renders.
 */
export function scheduleMeal(meal: Meal, kitchen: Kitchen): ScheduleResult {
  const issues: ScheduleIssue[] = [];
  const occ: Occupancy = {
    hands: new Map(),
    burners: new Map(),
    ovenTemps: new Map(),
  };

  const k: Kitchen = {
    cooks: Math.max(0, Math.floor(kitchen.cooks)),
    burners: Math.max(0, Math.floor(kitchen.burners)),
    ovens: Math.max(0, Math.floor(kitchen.ovens)),
  };

  const cursors: Cursor[] = meal.dishes
    .map((dish, dishIndex) => ({ dish, dishIndex }))
    .filter(({ dish }) => dish.steps.length > 0)
    .map(({ dish, dishIndex }) => ({
      dish,
      dishIndex,
      index: dish.steps.length - 1,
      latestEnd: 0,
    }));

  const placed: ScheduledStep[] = [];

  let cursor = pickNext(cursors);
  while (cursor) {
    const step = cursor.dish.steps[cursor.index];
    const dur = Math.max(1, Math.round(step.minutes));

    // Constraints that can never be satisfied at any time: report and waive.
    const skip = {
      hands: step.attention === 'active' && k.cooks < 1,
      burners: step.resource === 'stove' && k.burners < 1,
      oven: step.resource === 'oven' && k.ovens < 1,
    };
    if (skip.hands)
      issues.push({
        message: `“${step.name}” (${cursor.dish.name}) is hands-on but the kitchen has 0 cooks — scheduled anyway.`,
      });
    if (skip.burners)
      issues.push({
        message: `“${step.name}” (${cursor.dish.name}) needs a burner but the kitchen has 0 — scheduled anyway.`,
      });
    if (skip.oven)
      issues.push({
        message: `“${step.name}” (${cursor.dish.name}) needs an oven but the kitchen has 0 — scheduled anyway.`,
      });

    const probe: Step = {
      ...step,
      attention: skip.hands ? 'passive' : step.attention,
      resource:
        (skip.burners && step.resource === 'stove') ||
        (skip.oven && step.resource === 'oven')
          ? 'none'
          : step.resource,
    };

    let start = cursor.latestEnd - dur;
    let fitted = false;
    while (start >= -HORIZON_MIN) {
      let free = true;
      for (let t = start; t < start + dur; t++) {
        if (!stepFitsAt(t, probe, k, occ)) {
          free = false;
          break;
        }
      }
      if (free) {
        fitted = true;
        break;
      }
      start--;
    }
    if (!fitted) {
      start = cursor.latestEnd - dur;
      issues.push({
        message: `Couldn't fit “${step.name}” (${cursor.dish.name}) within 24 hours of serve — placed at its deadline, ignoring conflicts.`,
      });
    }

    occupy(start, start + dur, step, occ, skip);
    placed.push({
      dishId: cursor.dish.id,
      dishName: cursor.dish.name,
      dishIndex: cursor.dishIndex,
      step,
      start,
      end: start + dur,
      slackAfter: cursor.latestEnd - (start + dur),
    });

    cursor.latestEnd = start;
    cursor.index--;
    cursor = pickNext(cursors);
  }

  placed.sort((a, b) => a.start - b.start || a.end - b.end);
  const earliestStart = placed.length
    ? Math.min(...placed.map((p) => p.start))
    : 0;
  const activeMinutes = placed
    .filter((p) => p.step.attention === 'active')
    .reduce((sum, p) => sum + (p.end - p.start), 0);

  return { steps: placed, issues, earliestStart, activeMinutes };
}
