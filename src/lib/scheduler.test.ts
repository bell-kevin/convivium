// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest';
import { scheduleMeal } from './scheduler';
import type {
  Attention,
  Dish,
  Kitchen,
  Meal,
  Resource,
  ScheduledStep,
  Step,
} from './types';

let n = 0;
const step = (
  name: string,
  minutes: number,
  attention: Attention = 'passive',
  resource: Resource = 'none',
  ovenTemp?: number,
): Step => ({ id: `s${n++}`, name, minutes, attention, resource, ovenTemp });

const dish = (name: string, steps: Step[]): Dish => ({
  id: `d${n++}`,
  name,
  steps,
});

const meal = (...dishes: Dish[]): Meal => ({ name: 'test', dishes });

const kitchen = (cooks = 1, burners = 4, ovens = 1): Kitchen => ({
  cooks,
  burners,
  ovens,
});

/** Max number of scheduled steps matching `pred` overlapping any one minute. */
function maxConcurrency(
  steps: ScheduledStep[],
  pred: (s: ScheduledStep) => boolean,
): number {
  const counts = new Map<number, number>();
  for (const s of steps.filter(pred)) {
    for (let t = s.start; t < s.end; t++) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Math.max(0, ...counts.values());
}

describe('scheduleMeal', () => {
  it('schedules a single dish back-to-back, ending exactly at serve', () => {
    const m = meal(
      dish('Rice', [
        step('Rinse', 3, 'active'),
        step('Simmer', 18, 'passive', 'stove'),
        step('Fluff', 2, 'active'),
      ]),
    );
    const { steps, issues } = scheduleMeal(m, kitchen());
    expect(issues).toHaveLength(0);
    expect(steps).toHaveLength(3);
    const byName = Object.fromEntries(steps.map((s) => [s.step.name, s]));
    expect(byName['Fluff'].end).toBe(0);
    expect(byName['Simmer'].end).toBe(byName['Fluff'].start);
    expect(byName['Rinse'].end).toBe(byName['Simmer'].start);
    expect(byName['Rinse'].start).toBe(-23);
  });

  it('never double-books a single cook; the loser holds', () => {
    const m = meal(
      dish('Steak', [step('Sear & baste', 10, 'active', 'stove')]),
      dish('Salad', [step('Dress & toss', 10, 'active')]),
    );
    const { steps } = scheduleMeal(m, kitchen(1));
    expect(maxConcurrency(steps, (s) => s.step.attention === 'active')).toBe(1);
    const ends = steps.map((s) => s.end).sort((a, b) => a - b);
    expect(ends[1]).toBe(0); // one finishes at serve
    expect(ends[0]).toBeLessThanOrEqual(-10); // the other finished earlier…
    const early = steps.find((s) => s.end === ends[0])!;
    expect(early.slackAfter).toBeGreaterThanOrEqual(10); // …and holds honestly
  });

  it('allows two cooks to work in parallel', () => {
    const m = meal(
      dish('Steak', [step('Sear', 10, 'active', 'stove')]),
      dish('Salad', [step('Toss', 10, 'active')]),
    );
    const { steps } = scheduleMeal(m, kitchen(2));
    expect(steps.every((s) => s.end === 0)).toBe(true);
  });

  it('respects burner capacity', () => {
    const m = meal(
      dish('A', [step('Simmer A', 20, 'passive', 'stove')]),
      dish('B', [step('Simmer B', 20, 'passive', 'stove')]),
      dish('C', [step('Simmer C', 20, 'passive', 'stove')]),
    );
    const { steps } = scheduleMeal(m, kitchen(1, 2, 1));
    expect(maxConcurrency(steps, (s) => s.step.resource === 'stove')).toBe(2);
  });

  it('lets same-temperature oven steps share one oven', () => {
    const m = meal(
      dish('Chicken', [step('Roast', 40, 'passive', 'oven', 425)]),
      dish('Potatoes', [step('Roast', 40, 'passive', 'oven', 425)]),
    );
    const { steps } = scheduleMeal(m, kitchen(1, 4, 1));
    expect(steps.every((s) => s.end === 0)).toBe(true);
  });

  it('never runs two temperatures at once in a single oven', () => {
    const m = meal(
      dish('Roast', [step('Roast', 30, 'passive', 'oven', 425)]),
      dish('Cake', [step('Bake', 30, 'passive', 'oven', 350)]),
    );
    const { steps } = scheduleMeal(m, kitchen(1, 4, 1));
    // Build the per-minute set of distinct temps and assert it never exceeds 1.
    const temps = new Map<number, Set<number>>();
    for (const s of steps) {
      for (let t = s.start; t < s.end; t++) {
        const set = temps.get(t) ?? new Set<number>();
        set.add(s.step.ovenTemp!);
        temps.set(t, set);
      }
    }
    for (const set of temps.values()) expect(set.size).toBeLessThanOrEqual(1);
  });

  it('two ovens can run two temperatures simultaneously', () => {
    const m = meal(
      dish('Roast', [step('Roast', 30, 'passive', 'oven', 425)]),
      dish('Cake', [step('Bake', 30, 'passive', 'oven', 350)]),
    );
    const { steps } = scheduleMeal(m, kitchen(1, 4, 2));
    expect(steps.every((s) => s.end === 0)).toBe(true);
  });

  it('reports impossible constraints as issues instead of failing', () => {
    const m = meal(dish('Soup', [step('Simmer', 15, 'passive', 'stove')]));
    const { steps, issues } = scheduleMeal(m, kitchen(1, 0, 1));
    expect(steps).toHaveLength(1);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].message).toContain('burner');
  });

  it('keeps dish step order under contention', () => {
    const m = meal(
      dish('Pasta', [
        step('Boil water', 8, 'passive', 'stove'),
        step('Cook pasta', 10, 'active', 'stove'),
        step('Toss with sauce', 3, 'active'),
      ]),
      dish('Sauce', [
        step('Chop', 6, 'active'),
        step('Simmer sauce', 15, 'passive', 'stove'),
      ]),
    );
    const { steps } = scheduleMeal(m, kitchen(1, 1, 1)); // one burner!
    expect(maxConcurrency(steps, (s) => s.step.resource === 'stove')).toBe(1);
    expect(maxConcurrency(steps, (s) => s.step.attention === 'active')).toBe(1);
    for (const d of m.dishes) {
      const placed = d.steps.map(
        (st) => steps.find((s) => s.step.id === st.id)!,
      );
      for (let i = 1; i < placed.length; i++) {
        expect(placed[i - 1].end).toBeLessThanOrEqual(placed[i].start);
      }
      expect(placed[placed.length - 1].end).toBeLessThanOrEqual(0);
    }
  });
});
