// SPDX-License-Identifier: AGPL-3.0-only
//
// Serverless sharing: the whole meal travels inside the URL *fragment*
// (`#m=…`), which browsers never transmit to the web server. Opening a share
// link is a purely client-side import.

import type { Kitchen, Meal } from './types';

export interface SharePayload {
  v: 1;
  meal: Meal;
  kitchen: Kitchen;
}

export function encodeShare(payload: SharePayload): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(encoded: string): SharePayload | null {
  try {
    const b64 =
      encoded.replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - (encoded.length % 4)) % 4);
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as SharePayload;
    if (parsed && parsed.v === 1 && parsed.meal && parsed.kitchen) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function shareUrlFor(payload: SharePayload): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#m=${encodeShare(payload)}`;
}

/** Read and clear a share payload from the current URL, if present. */
export function consumeShareFromLocation(): SharePayload | null {
  const h = location.hash;
  if (!h.startsWith('#m=')) return null;
  const payload = decodeShare(h.slice(3));
  history.replaceState(null, '', location.pathname + location.search);
  return payload;
}
