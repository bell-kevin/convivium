// SPDX-License-Identifier: AGPL-3.0-only

import { dishColor } from '../lib/colors';
import { clockFor, fmtClock, fmtDuration } from '../lib/time';
import type { ScheduledStep, ScheduleResult } from '../lib/types';

interface Props {
  schedule: ScheduleResult;
  serveTs: number;
  onPlan: () => void;
  onCook: () => void;
}

function pickTickInterval(totalMinutes: number): number {
  if (totalMinutes <= 60) return 10;
  if (totalMinutes <= 150) return 15;
  if (totalMinutes <= 300) return 30;
  return 60;
}

function resourceBadge(s: ScheduledStep): string | null {
  if (s.step.resource === 'stove') return '🔥 burner';
  if (s.step.resource === 'oven') return `♨ ${s.step.ovenTemp ?? 350}°`;
  return null;
}

export function Timeline({ schedule, serveTs, onPlan, onCook }: Props) {
  const { steps, issues, earliestStart, activeMinutes } = schedule;

  if (steps.length === 0) {
    return (
      <section className="panel empty">
        <p>Nothing to schedule yet — plan a meal first.</p>
        <button type="button" className="btn" onClick={onPlan}>
          ← Plan the meal
        </button>
      </section>
    );
  }

  const total = -earliestStart;
  const interval = pickTickInterval(total);
  const tickStart = -Math.max(interval, Math.ceil(total / interval) * interval);
  const span = -tickStart;
  const pct = (t: number) => ((t - tickStart) / span) * 100;

  const ticks: number[] = [];
  for (let t = tickStart; t <= 0; t += interval) ticks.push(t);

  const laneIndices = [...new Set(steps.map((s) => s.dishIndex))].sort(
    (a, b) => a - b,
  );

  const serveDate = new Date(serveTs);

  return (
    <div className="timeline">
      <section className="panel summary">
        <div className="summary-item">
          <span className="summary-label">First move</span>
          <span className="summary-value mono">
            {fmtClock(clockFor(serveTs, earliestStart))}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total time</span>
          <span className="summary-value mono">{fmtDuration(total)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Hands-on</span>
          <span className="summary-value mono">
            {fmtDuration(activeMinutes)}
          </span>
        </div>
        <div className="summary-item serve">
          <span className="summary-label">Serve</span>
          <span className="summary-value mono">{fmtClock(serveDate)}</span>
        </div>
        <button type="button" className="btn summary-cook" onClick={onCook}>
          Start cooking →
        </button>
      </section>

      {issues.length > 0 && (
        <section className="panel issues" role="alert">
          <h2 className="panel-title">Heads up</h2>
          <ul>
            {issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel gantt-panel">
        <div className="gantt-legend">
          <span className="legend-item">
            <span className="legend-swatch solid" /> hands-on
          </span>
          <span className="legend-item">
            <span className="legend-swatch hollow" /> hands-off
          </span>
          <span className="legend-item">
            <span className="legend-swatch hold" /> hold / keep warm
          </span>
        </div>

        <div className="gantt-scroll">
          <div className="gantt">
            <div className="gantt-axis">
              <span className="gantt-axis-spacer" />
              <div className="gantt-axis-track">
                {ticks.map((t) => (
                  <span
                    key={t}
                    className={t === 0 ? 'axis-tick serve-tick' : 'axis-tick'}
                    style={{ left: `${pct(t)}%` }}
                  >
                    {t === 0 ? 'Serve' : fmtClock(clockFor(serveTs, t))}
                  </span>
                ))}
              </div>
            </div>

            <div className="gantt-body">
              {laneIndices.map((di) => {
                const laneSteps = steps.filter((s) => s.dishIndex === di);
                const color = dishColor(di);
                return (
                  <div className="lane" key={di}>
                    <span className="lane-label" style={{ color }}>
                      {laneSteps[0].dishName || 'Untitled dish'}
                    </span>
                    <div className="lane-track">
                      {ticks.map((t) => (
                        <span
                          key={t}
                          className="gridline"
                          style={{ left: `${pct(t)}%` }}
                          aria-hidden="true"
                        />
                      ))}
                      {laneSteps.map((s) => {
                        const left = pct(s.start);
                        const width = ((s.end - s.start) / span) * 100;
                        const holdWidth = (s.slackAfter / span) * 100;
                        const title = `${s.step.name} — ${fmtClock(
                          clockFor(serveTs, s.start),
                        )}–${fmtClock(clockFor(serveTs, s.end))} (${fmtDuration(
                          s.end - s.start,
                        )})${
                          s.slackAfter > 0
                            ? ` · then hold ${fmtDuration(s.slackAfter)}`
                            : ''
                        }`;
                        return (
                          <span key={s.step.id}>
                            <span
                              className={
                                s.step.attention === 'active'
                                  ? 'bar bar-active'
                                  : 'bar bar-passive'
                              }
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                ['--dish' as string]: color,
                              }}
                              title={title}
                            >
                              {s.step.resource === 'oven' && (
                                <em className="bar-temp">
                                  {s.step.ovenTemp ?? 350}°
                                </em>
                              )}
                              {s.step.name || 'Step'}
                            </span>
                            {s.slackAfter > 0 && (
                              <span
                                className="hold-tail"
                                style={{
                                  left: `${pct(s.end)}%`,
                                  width: `${holdWidth}%`,
                                }}
                                title={`Hold ${fmtDuration(s.slackAfter)}`}
                                aria-hidden="true"
                              />
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <span className="serve-line" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      <section className="panel ticket">
        <header className="ticket-head">
          <h2 className="panel-title">The ticket</h2>
          <button
            type="button"
            className="btn ghost"
            onClick={() => window.print()}
          >
            Print
          </button>
        </header>
        <ol className="ticket-list">
          {steps.map((s) => (
            <li className="ticket-row" key={`${s.dishId}-${s.step.id}`}>
              <span className="ticket-time mono">
                {fmtClock(clockFor(serveTs, s.start))}
              </span>
              <span
                className="ticket-dish"
                style={{ ['--dish' as string]: dishColor(s.dishIndex) }}
              >
                {s.dishName || 'Dish'}
              </span>
              <span className="ticket-step">
                {s.step.name || 'Step'}
                <span className="ticket-badges">
                  <span className="badge mono">
                    {fmtDuration(s.end - s.start)}
                  </span>
                  {resourceBadge(s) && (
                    <span className="badge">{resourceBadge(s)}</span>
                  )}
                  {s.step.attention === 'passive' && (
                    <span className="badge badge-soft">hands-free</span>
                  )}
                  {s.slackAfter > 0 && (
                    <span className="badge badge-hold">
                      then hold {fmtDuration(s.slackAfter)}
                    </span>
                  )}
                </span>
              </span>
            </li>
          ))}
          <li className="ticket-row ticket-serve">
            <span className="ticket-time mono">{fmtClock(serveDate)}</span>
            <span className="ticket-dish" />
            <span className="ticket-step">Serve everything 🎉</span>
          </li>
        </ol>
      </section>
    </div>
  );
}
