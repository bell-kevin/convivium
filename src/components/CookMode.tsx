// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from 'react';
import { dishColor } from '../lib/colors';
import { clockFor, fmtClock, fmtCountdown, fmtDuration } from '../lib/time';
import type { ScheduledStep, ScheduleResult } from '../lib/types';

interface Props {
  schedule: ScheduleResult;
  serveTs: number;
  onPlan: () => void;
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: 'release', cb: () => void) => void;
}

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
};

const keyOf = (s: ScheduledStep) => `${s.dishId}/${s.step.id}`;

export function CookMode({ schedule, serveTs, onPlan }: Props) {
  const { steps, earliestStart } = schedule;
  const [now, setNow] = useState(() => Date.now());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [notify, setNotify] = useState(false);
  const [awake, setAwake] = useState(false);
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Browser notifications at each step's start time (while the tab is open).
  useEffect(() => {
    if (!notify || !('Notification' in window)) return;
    const timers: number[] = [];
    for (const s of steps) {
      const at = serveTs + s.start * 60_000;
      const delay = at - Date.now();
      if (delay > 0 && delay < 12 * 3_600_000) {
        timers.push(
          window.setTimeout(() => {
            new Notification(`${fmtClock(new Date(at))} — ${s.step.name}`, {
              body: s.dishName,
              tag: keyOf(s),
            });
          }, delay),
        );
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [notify, steps, serveTs]);

  // Screen wake lock, re-acquired when the tab becomes visible again.
  useEffect(() => {
    if (!awake) return;
    const nav = navigator as WakeLockNavigator;
    let released = false;

    const acquire = async () => {
      try {
        const sentinel = await nav.wakeLock?.request('screen');
        if (!sentinel) return;
        if (released) {
          void sentinel.release();
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          sentinelRef.current = null;
        });
      } catch {
        setAwake(false);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !sentinelRef.current) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinelRef.current?.release();
      sentinelRef.current = null;
    };
  }, [awake]);

  const requestNotify = async () => {
    if (notify) {
      setNotify(false);
      return;
    }
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') setNotify(true);
  };

  if (steps.length === 0) {
    return (
      <section className="panel empty">
        <p>Nothing to cook yet — plan a meal first.</p>
        <button type="button" className="btn" onClick={onPlan}>
          ← Plan the meal
        </button>
      </section>
    );
  }

  const tMin = (now - serveTs) / 60_000;
  const served = tMin >= 0;
  const isDone = (s: ScheduledStep) => checked.has(keyOf(s)) || s.end <= tMin;
  const current = steps.filter(
    (s) => s.start <= tMin && s.end > tMin && !checked.has(keyOf(s)),
  );
  const upcoming = steps.filter((s) => s.start > tMin);
  const nextUp = upcoming.slice(0, 4);
  const laterCount = upcoming.length - nextUp.length;
  const done = steps.filter(isDone);

  const progress =
    earliestStart >= 0
      ? 0
      : Math.min(1, Math.max(0, (tMin - earliestStart) / -earliestStart));

  const toggle = (s: ScheduledStep) => {
    const k = keyOf(s);
    const next = new Set(checked);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setChecked(next);
  };

  const inLabel = (minutes: number) =>
    minutes < 1 ? 'now' : `in ${fmtDuration(minutes)}`;

  return (
    <div className="cook">
      <section className="panel hero">
        {served ? (
          <>
            <span className="hero-label">It's time</span>
            <span className="hero-value">Dinner is served 🎉</span>
          </>
        ) : (
          <>
            <span className="hero-label">
              Serve at {fmtClock(new Date(serveTs))}
            </span>
            <span className="hero-value mono">
              {fmtCountdown(serveTs - now)}
            </span>
          </>
        )}
        <div
          className="progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <span className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="hero-tools">
          {'Notification' in window && (
            <button
              type="button"
              className={notify ? 'btn ghost is-on' : 'btn ghost'}
              onClick={requestNotify}
            >
              {notify ? 'Notifications on ✓' : 'Notify me at each step'}
            </button>
          )}
          {'wakeLock' in navigator && (
            <button
              type="button"
              className={awake ? 'btn ghost is-on' : 'btn ghost'}
              onClick={() => setAwake((a) => !a)}
            >
              {awake ? 'Screen staying on ✓' : 'Keep screen on'}
            </button>
          )}
        </div>
      </section>

      <section className="panel now-panel">
        <h2 className="panel-title">Now</h2>
        {current.length === 0 ? (
          <p className="quiet">
            {upcoming.length > 0
              ? `Nothing on the stove — next task ${inLabel(
                  Math.round(upcoming[0].start - tMin),
                )}.`
              : served
                ? 'All done. Go eat.'
                : 'Everything is resting until serve time.'}
          </p>
        ) : (
          <ul className="task-list">
            {current.map((s) => (
              <li className="task now" key={keyOf(s)}>
                <label className="task-check">
                  <input
                    type="checkbox"
                    checked={checked.has(keyOf(s))}
                    onChange={() => toggle(s)}
                  />
                  <span className="task-body">
                    <span
                      className="task-dish"
                      style={{ ['--dish' as string]: dishColor(s.dishIndex) }}
                    >
                      {s.dishName || 'Dish'}
                    </span>
                    <span className="task-name">{s.step.name || 'Step'}</span>
                    <span className="task-meta mono">
                      until {fmtClock(clockFor(serveTs, s.end))}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Up next</h2>
        {nextUp.length === 0 ? (
          <p className="quiet">No more tasks. Plates warm?</p>
        ) : (
          <ul className="task-list">
            {nextUp.map((s) => (
              <li className="task" key={keyOf(s)}>
                <span className="task-when mono">
                  {fmtClock(clockFor(serveTs, s.start))}
                </span>
                <span className="task-body">
                  <span
                    className="task-dish"
                    style={{ ['--dish' as string]: dishColor(s.dishIndex) }}
                  >
                    {s.dishName || 'Dish'}
                  </span>
                  <span className="task-name">{s.step.name || 'Step'}</span>
                  <span className="task-meta">
                    {inLabel(Math.round(s.start - tMin))} ·{' '}
                    {fmtDuration(s.end - s.start)}
                    {s.step.attention === 'passive' ? ' · hands-free' : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {laterCount > 0 && (
          <p className="quiet">
            + {laterCount} more after that — see the Timeline for the whole
            plan.
          </p>
        )}
      </section>

      {done.length > 0 && (
        <details className="panel done-panel">
          <summary className="panel-title">Done ({done.length})</summary>
          <ul className="task-list">
            {[...done].reverse().map((s) => (
              <li className="task is-done" key={keyOf(s)}>
                <span className="task-when mono">
                  {fmtClock(clockFor(serveTs, s.start))}
                </span>
                <span className="task-body">
                  <span
                    className="task-dish"
                    style={{ ['--dish' as string]: dishColor(s.dishIndex) }}
                  >
                    {s.dishName || 'Dish'}
                  </span>
                  <span className="task-name">{s.step.name || 'Step'}</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
