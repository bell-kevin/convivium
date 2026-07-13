// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { dishColor } from '../lib/colors';
import { sampleMeals } from '../lib/samples';
import { shareUrlFor } from '../lib/share';
import {
  loadLibrary,
  saveLibrary,
  type LibraryEntry,
} from '../lib/storage';
import type { Dish, Kitchen, Meal, Step } from '../lib/types';
import { uid } from '../lib/types';

interface Props {
  meal: Meal;
  setMeal: (m: Meal) => void;
  kitchen: Kitchen;
  setKitchen: (k: Kitchen) => void;
  onTimeline: () => void;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.floor(v)));

export function Editor({ meal, setMeal, kitchen, setKitchen, onTimeline }: Props) {
  const [library, setLibrary] = useState<LibraryEntry[]>(loadLibrary);
  const [copied, setCopied] = useState(false);

  const patchDish = (dishId: string, patch: Partial<Dish>) =>
    setMeal({
      ...meal,
      dishes: meal.dishes.map((d) => (d.id === dishId ? { ...d, ...patch } : d)),
    });

  const patchStep = (dishId: string, stepId: string, patch: Partial<Step>) =>
    setMeal({
      ...meal,
      dishes: meal.dishes.map((d) =>
        d.id !== dishId
          ? d
          : {
              ...d,
              steps: d.steps.map((s) =>
                s.id === stepId ? { ...s, ...patch } : s,
              ),
            },
      ),
    });

  const moveStep = (dishId: string, stepId: string, dir: -1 | 1) =>
    setMeal({
      ...meal,
      dishes: meal.dishes.map((d) => {
        if (d.id !== dishId) return d;
        const i = d.steps.findIndex((s) => s.id === stepId);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= d.steps.length) return d;
        const steps = [...d.steps];
        [steps[i], steps[j]] = [steps[j], steps[i]];
        return { ...d, steps };
      }),
    });

  const removeStep = (dishId: string, stepId: string) =>
    setMeal({
      ...meal,
      dishes: meal.dishes.map((d) =>
        d.id !== dishId
          ? d
          : { ...d, steps: d.steps.filter((s) => s.id !== stepId) },
      ),
    });

  const addStep = (dishId: string) =>
    setMeal({
      ...meal,
      dishes: meal.dishes.map((d) =>
        d.id !== dishId
          ? d
          : {
              ...d,
              steps: [
                ...d.steps,
                {
                  id: uid(),
                  name: '',
                  minutes: 10,
                  attention: 'active',
                  resource: 'none',
                },
              ],
            },
      ),
    });

  const addDish = () =>
    setMeal({
      ...meal,
      dishes: [...meal.dishes, { id: uid(), name: '', steps: [] }],
    });

  const removeDish = (dishId: string) =>
    setMeal({ ...meal, dishes: meal.dishes.filter((d) => d.id !== dishId) });

  const loadSample = (index: number) => {
    const sample = sampleMeals()[index];
    if (sample) setMeal(sample);
  };

  const saveToLibrary = () => {
    const entry: LibraryEntry = {
      id: uid(),
      savedAt: Date.now(),
      meal: structuredClone(meal),
    };
    const next = [entry, ...library].slice(0, 30);
    setLibrary(next);
    saveLibrary(next);
  };

  const loadFromLibrary = (entry: LibraryEntry) =>
    setMeal(structuredClone(entry.meal));

  const deleteFromLibrary = (id: string) => {
    const next = library.filter((e) => e.id !== id);
    setLibrary(next);
    saveLibrary(next);
  };

  const copyShareLink = async () => {
    const url = shareUrlFor({ v: 1, meal, kitchen });
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  const stepCount = meal.dishes.reduce((n, d) => n + d.steps.length, 0);

  return (
    <div className="editor">
      <section className="panel meal-panel">
        <div className="meal-row">
          <input
            className="meal-name"
            value={meal.name}
            placeholder="Name this meal"
            onChange={(e) => setMeal({ ...meal, name: e.target.value })}
            aria-label="Meal name"
          />
          <div className="meal-actions">
            <select
              className="select"
              value=""
              aria-label="Load a sample meal"
              onChange={(e) => {
                const i = Number(e.target.value);
                if (!Number.isNaN(i)) loadSample(i);
              }}
            >
              <option value="" disabled>
                Load a sample…
              </option>
              {sampleMeals().map((m, i) => (
                <option key={m.name} value={i}>
                  {m.name}
                </option>
              ))}
            </select>
            <button type="button" className="btn ghost" onClick={saveToLibrary}>
              Save to library
            </button>
            <button type="button" className="btn ghost" onClick={copyShareLink}>
              {copied ? 'Link copied ✓' : 'Copy share link'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={onTimeline}
              disabled={stepCount === 0}
            >
              See the timeline →
            </button>
          </div>
        </div>

        <div className="kitchen-strip">
          <span className="kitchen-title">Your kitchen</span>
          <label className="kitchen-field">
            <span>Cooks</span>
            <input
              type="number"
              min={1}
              max={6}
              value={kitchen.cooks}
              onChange={(e) =>
                setKitchen({
                  ...kitchen,
                  cooks: clamp(Number(e.target.value) || 1, 1, 6),
                })
              }
            />
          </label>
          <label className="kitchen-field">
            <span>Burners</span>
            <input
              type="number"
              min={0}
              max={8}
              value={kitchen.burners}
              onChange={(e) =>
                setKitchen({
                  ...kitchen,
                  burners: clamp(Number(e.target.value) || 0, 0, 8),
                })
              }
            />
          </label>
          <label className="kitchen-field">
            <span>Ovens</span>
            <input
              type="number"
              min={0}
              max={3}
              value={kitchen.ovens}
              onChange={(e) =>
                setKitchen({
                  ...kitchen,
                  ovens: clamp(Number(e.target.value) || 0, 0, 3),
                })
              }
            />
          </label>
          <span className="kitchen-note">
            Hands-on steps take a cook. Same-temperature dishes share an oven.
          </span>
        </div>
      </section>

      {meal.dishes.length === 0 && (
        <section className="panel empty">
          <p>No dishes yet. Add one, or load a sample dinner above.</p>
          <button type="button" className="btn" onClick={addDish}>
            + Add a dish
          </button>
        </section>
      )}

      <div className="dishes">
        {meal.dishes.map((dish, di) => (
          <section className="panel dish" key={dish.id}>
            <header className="dish-head">
              <span
                className="dish-dot"
                style={{ background: dishColor(di) }}
                aria-hidden="true"
              />
              <input
                className="dish-name"
                value={dish.name}
                placeholder="Dish name"
                aria-label="Dish name"
                onChange={(e) => patchDish(dish.id, { name: e.target.value })}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${dish.name || 'dish'}`}
                onClick={() => removeDish(dish.id)}
              >
                ✕
              </button>
            </header>

            {dish.steps.length > 0 && (
              <div className="steps-head" aria-hidden="true">
                <span>Step</span>
                <span>Min</span>
                <span>Attention</span>
                <span>Equipment</span>
                <span />
              </div>
            )}

            {dish.steps.map((step, si) => (
              <div className="step-row" key={step.id}>
                <input
                  className="step-name"
                  value={step.name}
                  placeholder="e.g. Simmer, covered"
                  aria-label="Step name"
                  onChange={(e) =>
                    patchStep(dish.id, step.id, { name: e.target.value })
                  }
                />
                <input
                  className="step-min"
                  type="number"
                  min={1}
                  max={480}
                  value={step.minutes}
                  aria-label="Minutes"
                  onChange={(e) =>
                    patchStep(dish.id, step.id, {
                      minutes: clamp(Number(e.target.value) || 1, 1, 480),
                    })
                  }
                />
                <select
                  className="select step-attn"
                  value={step.attention}
                  aria-label="Attention"
                  onChange={(e) =>
                    patchStep(dish.id, step.id, {
                      attention: e.target.value as Step['attention'],
                    })
                  }
                >
                  <option value="active">Hands-on</option>
                  <option value="passive">Hands-off</option>
                </select>
                <span className="step-equip">
                  <select
                    className="select"
                    value={step.resource}
                    aria-label="Equipment"
                    onChange={(e) => {
                      const resource = e.target.value as Step['resource'];
                      patchStep(dish.id, step.id, {
                        resource,
                        ovenTemp:
                          resource === 'oven' ? step.ovenTemp ?? 350 : undefined,
                      });
                    }}
                  >
                    <option value="none">No equipment</option>
                    <option value="stove">Burner</option>
                    <option value="oven">Oven</option>
                  </select>
                  {step.resource === 'oven' && (
                    <input
                      className="step-temp"
                      type="number"
                      min={150}
                      max={550}
                      step={5}
                      value={step.ovenTemp ?? 350}
                      aria-label="Oven temperature °F"
                      onChange={(e) =>
                        patchStep(dish.id, step.id, {
                          ovenTemp: clamp(
                            Number(e.target.value) || 350,
                            150,
                            550,
                          ),
                        })
                      }
                    />
                  )}
                </span>
                <span className="step-tools">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Move step up"
                    disabled={si === 0}
                    onClick={() => moveStep(dish.id, step.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Move step down"
                    disabled={si === dish.steps.length - 1}
                    onClick={() => moveStep(dish.id, step.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Remove step"
                    onClick={() => removeStep(dish.id, step.id)}
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}

            <button
              type="button"
              className="btn ghost add-step"
              onClick={() => addStep(dish.id)}
            >
              + Add step
            </button>
          </section>
        ))}
      </div>

      {meal.dishes.length > 0 && (
        <button type="button" className="btn ghost add-dish" onClick={addDish}>
          + Add a dish
        </button>
      )}

      {library.length > 0 && (
        <section className="panel library">
          <h2 className="panel-title">Saved meals</h2>
          <ul className="library-list">
            {library.map((entry) => (
              <li key={entry.id} className="library-row">
                <span className="library-name">
                  {entry.meal.name || 'Untitled meal'}
                </span>
                <span className="library-meta">
                  {entry.meal.dishes.length}{' '}
                  {entry.meal.dishes.length === 1 ? 'dish' : 'dishes'} · saved{' '}
                  {new Date(entry.savedAt).toLocaleDateString()}
                </span>
                <span className="library-actions">
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => loadFromLibrary(entry)}
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Delete ${entry.meal.name || 'saved meal'}`}
                    onClick={() => deleteFromLibrary(entry.id)}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
