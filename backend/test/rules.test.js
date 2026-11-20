import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWithRules } from '../src/parser/rules.js';
import { normalizeRecord } from '../src/parser/normalize.js';

const D = '2026-11-20';
const parse = (t) => parseWithRules(t, D).records.map((r) => normalizeRecord(r, D)).filter(Boolean);
const find = (rs, c, pred = () => true) => rs.find((r) => r.category === c && pred(r));

test('finance: expenses and income', () => {
  const rs = parse('Spent ₹450 on groceries at BigBasket. Got my salary of 85000 today. Paid 1.2k for an Uber.');
  const g = find(rs, 'finance', (r) => r.amount === 450);
  assert.equal(g.direction, 'expense');
  assert.equal(g.subtype, 'groceries');
  assert.equal(g.currency, 'INR');
  assert.equal(find(rs, 'finance', (r) => r.amount === 85000).direction, 'income');
  assert.equal(find(rs, 'finance', (r) => r.amount === 1200).subtype, 'transport');
});

test('finance: does not treat units as money', () => {
  const rs = parse('Ran 5 km in 30 minutes.');
  assert.equal(find(rs, 'finance'), undefined);
  const ex = find(rs, 'exercise');
  assert.equal(ex.subtype, 'run');
  assert.equal(ex.distanceKm, 5);
  assert.equal(ex.durationMin, 30);
});

test('media: movie with platform and rating', () => {
  const rs = parse('Watched Oppenheimer on Netflix, 9/10.');
  const m = find(rs, 'media');
  assert.equal(m.title, 'Oppenheimer');
  assert.equal(m.platform, 'Netflix');
  assert.equal(m.rating, 9);
  assert.equal(m.subtype, 'movie');
});

test('media: show and book', () => {
  const rs = parse('Binged three episodes of The Bear. Started reading "Atomic Habits".');
  assert.equal(find(rs, 'media', (r) => r.subtype === 'show').title, 'The Bear');
  const b = find(rs, 'media', (r) => r.subtype === 'book');
  assert.equal(b.title, 'Atomic Habits');
  assert.equal(b.status, 'in_progress');
});

test('food: meals and items', () => {
  const rs = parse('Had poha and chai for breakfast. Dinner was paneer tikka with naan.');
  const b = find(rs, 'food', (r) => r.subtype === 'breakfast');
  assert.deepEqual(b.items, ['Poha', 'Chai']);
  assert.ok(find(rs, 'food', (r) => r.subtype === 'dinner').items.includes('Paneer Tikka'));
});

test('health, social, mood and yesterday', () => {
  const rs = parse('Slept 7 hours. Drank 8 glasses of water. Yesterday I met Riya and Arjun at Blue Tokai. Feeling really productive today.');
  assert.equal(find(rs, 'health', (r) => r.subtype === 'sleep').value, 7);
  assert.equal(find(rs, 'health', (r) => r.subtype === 'water').value, 2);
  const s = find(rs, 'social');
  assert.deepEqual(s.people, ['Riya', 'Arjun']);
  assert.equal(s.date, '2026-11-19');
  assert.equal(find(rs, 'place').location, 'Blue Tokai');
  assert.equal(find(rs, 'mood').rating, 4);
});

test('gym workout with sets', () => {
  const rs = parse('Leg day at the gym: squats 4 sets of 10 reps at 60kg, then lunges.');
  const ex = find(rs, 'exercise');
  assert.equal(ex.subtype, 'gym');
  assert.equal(ex.sets, 4);
  assert.equal(ex.reps, 10);
  assert.equal(ex.weightKg, 60);
});
