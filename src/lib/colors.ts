// SPDX-License-Identifier: AGPL-3.0-only

/** Enamelware-inspired lane colors; assigned by dish position, stable per meal. */
export const DISH_COLORS = [
  '#1F4D3F', // enamel green
  '#7A3B69', // beet
  '#B4551F', // paprika
  '#2E5E73', // dutch-oven blue
  '#8A6A14', // mustard
  '#5A4632', // walnut
  '#3F5A2E', // sage
  '#8A3B3B', // brick
] as const;

export const dishColor = (dishIndex: number): string =>
  DISH_COLORS[((dishIndex % DISH_COLORS.length) + DISH_COLORS.length) %
    DISH_COLORS.length];
