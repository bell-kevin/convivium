// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useMemo, useState } from 'react';
import { CookMode } from './components/CookMode';
import { Editor } from './components/Editor';
import { Timeline } from './components/Timeline';
import { sampleMeals } from './lib/samples';
import { scheduleMeal } from './lib/scheduler';
import { consumeShareFromLocation } from './lib/share';
import { loadCurrent, saveCurrent } from './lib/storage';
import {
  fmtClock,
  fromDatetimeLocal,
  roundedFromNow,
  toDatetimeLocal,
} from './lib/time';
import type { Kitchen, Meal } from './lib/types';

const DEFAULT_KITCHEN: Kitchen = { cooks: 1, burners: 4, ovens: 1 };

type Tab = 'plan' | 'timeline' | 'cook';

interface Boot {
  meal: Meal;
  kitchen: Kitchen;
  serveTs: number;
  fromShare: boolean;
}

function boot(): Boot {
  const shared = consumeShareFromLocation();
  if (shared) {
    return {
      meal: shared.meal,
      kitchen: shared.kitchen,
      serveTs: roundedFromNow(90),
      fromShare: true,
    };
  }
  const saved = loadCurrent();
  if (saved && Array.isArray(saved.meal?.dishes)) {
    const stale = saved.serveTs < Date.now() - 6 * 3_600_000;
    return {
      meal: saved.meal,
      kitchen: saved.kitchen ?? DEFAULT_KITCHEN,
      serveTs: stale ? roundedFromNow(90) : saved.serveTs,
      fromShare: false,
    };
  }
  return {
    meal: sampleMeals()[0],
    kitchen: DEFAULT_KITCHEN,
    serveTs: roundedFromNow(90),
    fromShare: false,
  };
}

export default function App() {
  const [init] = useState<Boot>(boot);
  const [meal, setMeal] = useState<Meal>(init.meal);
  const [kitchen, setKitchen] = useState<Kitchen>(init.kitchen);
  const [serveTs, setServeTs] = useState<number>(init.serveTs);
  const [tab, setTab] = useState<Tab>(init.fromShare ? 'timeline' : 'plan');
  const [showImported, setShowImported] = useState(init.fromShare);

  const schedule = useMemo(() => scheduleMeal(meal, kitchen), [meal, kitchen]);

  useEffect(() => {
    saveCurrent({ meal, kitchen, serveTs });
  }, [meal, kitchen, serveTs]);

  const onServeChange = (value: string) => {
    const ts = fromDatetimeLocal(value);
    if (ts !== null) setServeTs(ts);
  };

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <svg
            className="mark"
            viewBox="0 0 64 64"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="32" cy="32" r="26" fill="#F6F3E9" />
            <circle
              cx="32"
              cy="32"
              r="18"
              fill="none"
              stroke="#1F4D3F"
              strokeWidth="2.5"
            />
            <line
              x1="32"
              y1="32"
              x2="32"
              y2="18"
              stroke="#C4482F"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <line
              x1="32"
              y1="32"
              x2="42"
              y2="37"
              stroke="#E9A820"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx="32" cy="32" r="3.5" fill="#26251F" />
          </svg>
          <div>
            <h1 className="wordmark">
              convivium<span className="dot">.</span>
            </h1>
            <p className="tagline">Every dish, done at the same time.</p>
          </div>
        </div>

        <div className="serve-control">
          <label className="serve-label" htmlFor="serve-at">
            Everything ready at
          </label>
          <input
            id="serve-at"
            className="serve-input"
            type="datetime-local"
            value={toDatetimeLocal(serveTs)}
            onChange={(e) => onServeChange(e.target.value)}
          />
          <div className="serve-chips" role="group" aria-label="Quick serve times">
            {[45, 90, 120].map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                onClick={() => setServeTs(roundedFromNow(m))}
              >
                {m < 60 ? `in ${m} min` : `in ${m / 60} h${m % 60 ? ` ${m % 60}` : ''}`}
              </button>
            ))}
          </div>
        </div>
      </header>

      {showImported && (
        <div className="banner" role="status">
          <span>
            Loaded a shared meal. It's yours now — edits stay on this device.
          </span>
          <button
            type="button"
            className="banner-close"
            onClick={() => setShowImported(false)}
          >
            Got it
          </button>
        </div>
      )}

      <nav className="tabs" role="tablist" aria-label="Views">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'plan'}
          className={tab === 'plan' ? 'tab is-active' : 'tab'}
          onClick={() => setTab('plan')}
        >
          Plan the meal
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'timeline'}
          className={tab === 'timeline' ? 'tab is-active' : 'tab'}
          onClick={() => setTab('timeline')}
        >
          Timeline
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'cook'}
          className={tab === 'cook' ? 'tab is-active' : 'tab'}
          onClick={() => setTab('cook')}
        >
          Cook · {fmtClock(new Date(serveTs))}
        </button>
      </nav>

      <main className="view">
        {tab === 'plan' && (
          <Editor
            meal={meal}
            setMeal={setMeal}
            kitchen={kitchen}
            setKitchen={setKitchen}
            onTimeline={() => setTab('timeline')}
          />
        )}
        {tab === 'timeline' && (
          <Timeline
            schedule={schedule}
            serveTs={serveTs}
            onPlan={() => setTab('plan')}
            onCook={() => setTab('cook')}
          />
        )}
        {tab === 'cook' && (
          <CookMode
            schedule={schedule}
            serveTs={serveTs}
            onPlan={() => setTab('plan')}
          />
        )}
      </main>

      <footer className="colophon">
        <p>
          convivium is free software under the{' '}
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noreferrer"
          >
            AGPL-3.0
          </a>{' '}
          ·{' '}
          <a
            href="https://github.com/bell-kevin/convivium"
            target="_blank"
            rel="noreferrer"
          >
            Source on GitHub
          </a>
        </p>
        <p className="colophon-privacy">
          Runs entirely in your browser. Meals live in local storage; share
          links carry the meal inside the URL itself. No accounts, no servers,
          no tracking.
        </p>
      </footer>
    </div>
  );
}
