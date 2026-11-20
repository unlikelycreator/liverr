import { Router } from 'express';
import { Record } from '../models/Record.js';
import { Entry } from '../models/Entry.js';
import { config } from '../config.js';
import { CATEGORY_KEYS } from '../categories.js';

const r = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const day = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: config.timezone });
const shift = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const range = (q, defDays = 30) => {
  const to = DATE_RE.test(q.to || '') ? q.to : day();
  const from = DATE_RE.test(q.from || '') ? q.from : shift(to, -(defDays - 1));
  return { from, to };
};

r.get('/overview', async (req, res, next) => {
  try {
    const { from, to } = range(req.query);
    const inRange = { date: { $gte: from, $lte: to } };
    const yearFrom = shift(day(), -364);

    const [byCategory, finance, daily, heat, entryDays, totals, recentMedia, topSpend] = await Promise.all([
      Record.aggregate([{ $match: inRange }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
      Record.aggregate([
        { $match: { ...inRange, category: 'finance' } },
        { $group: { _id: { currency: '$currency', direction: '$direction' }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Record.aggregate([
        { $match: inRange },
        {
          $group: {
            _id: '$date',
            records: { $sum: 1 },
            expense: { $sum: { $cond: [{ $and: [{ $eq: ['$category', 'finance'] }, { $eq: ['$direction', 'expense'] }] }, '$amount', 0] } },
            income: { $sum: { $cond: [{ $and: [{ $eq: ['$category', 'finance'] }, { $eq: ['$direction', 'income'] }] }, '$amount', 0] } },
            exerciseMin: { $sum: { $cond: [{ $eq: ['$category', 'exercise'] }, { $ifNull: ['$durationMin', 0] }, 0] } },
            workouts: { $sum: { $cond: [{ $eq: ['$category', 'exercise'] }, 1, 0] } },
            sleep: { $max: { $cond: [{ $and: [{ $eq: ['$category', 'health'] }, { $eq: ['$subtype', 'sleep'] }] }, '$value', null] } },
            mood: { $avg: { $cond: [{ $eq: ['$category', 'mood'] }, '$rating', null] } },
            meals: { $sum: { $cond: [{ $eq: ['$category', 'food'] }, 1, 0] } },
            media: { $sum: { $cond: [{ $eq: ['$category', 'media'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Record.aggregate([{ $match: { date: { $gte: yearFrom } } }, { $group: { _id: '$date', count: { $sum: 1 } } }]),
      Entry.distinct('date'),
      Promise.all([Entry.estimatedDocumentCount(), Record.estimatedDocumentCount()]),
      Record.find({ category: 'media' }).sort({ date: -1, createdAt: -1 }).limit(6).lean(),
      Record.aggregate([
        { $match: { ...inRange, category: 'finance', direction: 'expense' } },
        { $group: { _id: '$subtype', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 8 },
      ]),
    ]);

    // Fill gaps so charts get one point per day.
    const byDay = Object.fromEntries(daily.map((d) => [d._id, d]));
    const series = [];
    for (let d = from; d <= to; d = shift(d, 1)) {
      const x = byDay[d] || {};
      series.push({
        date: d, records: x.records || 0, expense: x.expense || 0, income: x.income || 0, exerciseMin: x.exerciseMin || 0,
        workouts: x.workouts || 0, sleep: x.sleep ?? null, mood: x.mood ? Math.round(x.mood * 10) / 10 : null, meals: x.meals || 0, media: x.media || 0,
      });
      if (series.length > 400) break;
    }

    // Journal streak: consecutive days with an entry, ending today (or yesterday).
    const days = new Set(entryDays);
    let streak = 0;
    let cursor = days.has(day()) ? day() : shift(day(), -1);
    while (days.has(cursor)) { streak += 1; cursor = shift(cursor, -1); }

    const money = {};
    for (const f of finance) {
      const c = f._id.currency || config.currency;
      money[c] ||= { income: 0, expense: 0, count: 0 };
      money[c][f._id.direction || 'expense'] += f.total;
      money[c].count += f.count;
    }

    res.json({
      from, to, currency: config.currency, streak,
      totals: { entries: totals[0], records: totals[1], journalDays: days.size },
      categories: Object.fromEntries(CATEGORY_KEYS.map((k) => [k, byCategory.find((c) => c._id === k)?.count || 0])),
      money, series,
      heatmap: Object.fromEntries(heat.map((h) => [h._id, h.count])),
      recentMedia,
      topSpend: topSpend.map((s) => ({ subtype: s._id, total: s.total, count: s.count })),
    });
  } catch (e) { next(e); }
});

r.get('/category/:category', async (req, res, next) => {
  try {
    const { category } = req.params;
    if (!CATEGORY_KEYS.includes(category)) return res.status(404).json({ error: 'Unknown category' });
    const { from, to } = range(req.query, 90);
    const match = { category, date: { $gte: from, $lte: to } };
    const [bySubtype, sums, allTime] = await Promise.all([
      Record.aggregate([
        { $match: match },
        { $group: { _id: { subtype: '$subtype', direction: '$direction' }, count: { $sum: 1 }, amount: { $sum: { $ifNull: ['$amount', 0] } }, durationMin: { $sum: { $ifNull: ['$durationMin', 0] } } } },
        { $sort: { count: -1 } },
      ]),
      Record.aggregate([
        { $match: match },
        {
          $group: {
            _id: null, count: { $sum: 1 }, days: { $addToSet: '$date' },
            income: { $sum: { $cond: [{ $eq: ['$direction', 'income'] }, '$amount', 0] } },
            expense: { $sum: { $cond: [{ $eq: ['$direction', 'expense'] }, '$amount', 0] } },
            durationMin: { $sum: { $ifNull: ['$durationMin', 0] } }, distanceKm: { $sum: { $ifNull: ['$distanceKm', 0] } },
            calories: { $sum: { $ifNull: ['$calories', 0] } }, avgRating: { $avg: '$rating' },
          },
        },
      ]),
      Record.countDocuments({ category }),
    ]);
    const s = sums[0] || {};
    res.json({
      category, from, to, allTime,
      summary: {
        count: s.count || 0, activeDays: s.days?.length || 0, income: s.income || 0, expense: s.expense || 0,
        durationMin: s.durationMin || 0, distanceKm: Math.round((s.distanceKm || 0) * 100) / 100, calories: s.calories || 0,
        avgRating: s.avgRating ? Math.round(s.avgRating * 10) / 10 : null,
      },
      subtypes: bySubtype.map((b) => ({ subtype: b._id.subtype, direction: b._id.direction, count: b.count, amount: b.amount, durationMin: b.durationMin })),
    });
  } catch (e) { next(e); }
});

export default r;
