// convivium — every dish, done at the same time
// Copyright (C) 2026 Kevin Bell
// SPDX-License-Identifier: AGPL-3.0-only

/** How much of the cook a step consumes. */
export type Attention = 'active' | 'passive';

/** Which piece of kitchen equipment a step occupies for its whole duration. */
export type Resource = 'none' | 'stove' | 'oven';

export interface Step {
  id: string;
  name: string;
  /** Duration in whole minutes (>= 1). */
  minutes: number;
  /** 'active' steps need a cook's hands; 'passive' steps run unattended. */
  attention: Attention;
  /** Equipment occupied: a burner, the oven, or nothing. */
  resource: Resource;
  /** Oven temperature in °F. Only meaningful when resource === 'oven'. */
  ovenTemp?: number;
}

export interface Dish {
  id: string;
  name: string;
  /** Steps run in order; a step cannot start before the previous one ends. */
  steps: Step[];
}

export interface Meal {
  name: string;
  dishes: Dish[];
}

/** The real constraints of the kitchen doing the cooking. */
export interface Kitchen {
  /** Pairs of hands available for 'active' steps. */
  cooks: number;
  /** Stovetop burners available simultaneously. */
  burners: number;
  /** Separate ovens. Steps at the SAME temperature share one oven freely. */
  ovens: number;
}

/**
 * A step placed on the clock. Times are integer minutes relative to serve
 * time: serve is 0, so start/end are usually negative ("T-minus").
 */
export interface ScheduledStep {
  dishId: string;
  dishName: string;
  /** Index of the dish within the meal (stable color assignment). */
  dishIndex: number;
  step: Step;
  start: number;
  end: number;
  /**
   * Minutes of idle "hold" between this step's end and the next step of the
   * same dish (or serve time, for the dish's final step). Nonzero holds are
   * how the scheduler resolves resource contention honestly.
   */
  slackAfter: number;
}

export interface ScheduleIssue {
  message: string;
}

export interface ScheduleResult {
  steps: ScheduledStep[];
  issues: ScheduleIssue[];
  /** Minutes before serve when the very first step begins (<= 0). */
  earliestStart: number;
  /** Total hands-on ('active') minutes across the meal. */
  activeMinutes: number;
}

/** Small collision-tolerant id for client-side records. */
export const uid = (): string =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
