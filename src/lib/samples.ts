// SPDX-License-Identifier: AGPL-3.0-only

import type { Attention, Meal, Resource, Step } from './types';
import { uid } from './types';

const s = (
  name: string,
  minutes: number,
  attention: Attention,
  resource: Resource = 'none',
  ovenTemp?: number,
): Step => ({ id: uid(), name, minutes, attention, resource, ovenTemp });

export function sampleMeals(): Meal[] {
  return [
    {
      name: 'Weeknight salmon dinner',
      dishes: [
        {
          id: uid(),
          name: 'Salmon',
          steps: [
            s('Preheat oven to 425°', 12, 'passive', 'oven', 425),
            s('Season fillets', 5, 'active'),
            s('Roast', 13, 'passive', 'oven', 425),
            s('Rest', 3, 'passive'),
          ],
        },
        {
          id: uid(),
          name: 'Rice',
          steps: [
            s('Rinse rice', 3, 'active'),
            s('Simmer, covered', 18, 'passive', 'stove'),
            s('Steam off heat', 5, 'passive'),
            s('Fluff', 2, 'active'),
          ],
        },
        {
          id: uid(),
          name: 'Green beans',
          steps: [
            s('Trim beans', 5, 'active'),
            s('Sauté with garlic', 8, 'active', 'stove'),
          ],
        },
        {
          id: uid(),
          name: 'Lemon butter',
          steps: [s('Melt & whisk sauce', 6, 'active', 'stove')],
        },
      ],
    },
    {
      name: 'Sunday roast chicken',
      dishes: [
        {
          id: uid(),
          name: 'Chicken',
          steps: [
            s('Preheat oven to 425°', 15, 'passive', 'oven', 425),
            s('Dry, season & truss', 15, 'active'),
            s('Roast', 75, 'passive', 'oven', 425),
            s('Rest under foil', 15, 'passive'),
            s('Carve', 5, 'active'),
          ],
        },
        {
          id: uid(),
          name: 'Roast potatoes',
          steps: [
            s('Peel & chop', 10, 'active'),
            s('Parboil', 12, 'passive', 'stove'),
            s('Drain & rough up', 3, 'active'),
            s('Roast until crisp', 35, 'passive', 'oven', 425),
          ],
        },
        {
          id: uid(),
          name: 'Green beans',
          steps: [
            s('Trim', 5, 'active'),
            s('Blanch', 4, 'passive', 'stove'),
            s('Finish in butter', 5, 'active', 'stove'),
          ],
        },
        {
          id: uid(),
          name: 'Gravy',
          steps: [s('Make gravy from drippings', 12, 'active', 'stove')],
        },
      ],
    },
    {
      name: 'Taco night',
      dishes: [
        {
          id: uid(),
          name: 'Beef filling',
          steps: [
            s('Chop onion & garlic', 6, 'active'),
            s('Brown the beef', 10, 'active', 'stove'),
            s('Simmer with spices', 12, 'passive', 'stove'),
          ],
        },
        {
          id: uid(),
          name: 'Rice',
          steps: [
            s('Toast rice in oil', 4, 'active', 'stove'),
            s('Simmer', 16, 'passive', 'stove'),
            s('Rest, covered', 5, 'passive'),
          ],
        },
        {
          id: uid(),
          name: 'Pico de gallo',
          steps: [s('Dice & mix', 10, 'active')],
        },
        {
          id: uid(),
          name: 'Tortillas',
          steps: [s('Warm on the comal', 6, 'active', 'stove')],
        },
        {
          id: uid(),
          name: 'Toppings',
          steps: [s('Shred lettuce & cheese', 6, 'active')],
        },
      ],
    },
  ];
}
