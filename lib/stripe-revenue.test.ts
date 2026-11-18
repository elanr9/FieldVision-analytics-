import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { mrrFromSubscription } from './stripe-revenue';

const RENEWS = 1_800_000_000;

function sub(unitAmount: number, interval: 'month' | 'year', discounts: unknown[] = []): Stripe.Subscription {
  return {
    discounts,
    items: {
      data: [
        {
          quantity: 1,
          current_period_end: RENEWS,
          price: { unit_amount: unitAmount, recurring: { interval, interval_count: 1 } },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

test('an undiscounted annual plan is its price over twelve months', () => {
  assert.equal(mrrFromSubscription(sub(29900, 'year')), 2491);
});

test('a one month credit on an annual plan still counts at the full renewal price', () => {
  const credit = { end: RENEWS - 300 * 86400, coupon: { amount_off: 3000, percent_off: null } };
  assert.equal(mrrFromSubscription(sub(29900, 'year', [credit])), 2491);
});

test('a forever percent discount lowers recurring revenue', () => {
  const half = { end: null, coupon: { amount_off: null, percent_off: 50 } };
  assert.equal(mrrFromSubscription(sub(3000, 'month', [half])), 1500);
});

test('a forever amount discount lowers recurring revenue', () => {
  const off = { end: null, coupon: { amount_off: 500, percent_off: null } };
  assert.equal(mrrFromSubscription(sub(3000, 'month', [off])), 2500);
});

test('a 100 percent coupon is worth nothing', () => {
  const free = { end: null, coupon: { amount_off: null, percent_off: 100 } };
  assert.equal(mrrFromSubscription(sub(24000, 'year', [free])), 0);
});
