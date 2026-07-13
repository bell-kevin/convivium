// SPDX-License-Identifier: AGPL-3.0-only
//
// All persistence is localStorage on the cook's own device. There is no
// backend and no account: your recipes never leave your browser unless you
// copy a share link yourself.

import type { Kitchen, Meal } from './types';

const CURRENT_KEY = 'convivium:v1:current';
const LIBRARY_KEY = 'convivium:v1:library';

export interface CurrentState {
  meal: Meal;
  kitchen: Kitchen;
  serveTs: number;
}

export interface LibraryEntry {
  id: string;
  savedAt: number;
  meal: Meal;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadCurrent(): CurrentState | null {
  try {
    return safeParse<CurrentState>(localStorage.getItem(CURRENT_KEY));
  } catch {
    return null;
  }
}

export function saveCurrent(state: CurrentState): void {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable — the app keeps working in memory */
  }
}

export function loadLibrary(): LibraryEntry[] {
  try {
    return safeParse<LibraryEntry[]>(localStorage.getItem(LIBRARY_KEY)) ?? [];
  } catch {
    return [];
  }
}

export function saveLibrary(entries: LibraryEntry[]): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}
