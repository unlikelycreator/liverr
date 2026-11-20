import { Router } from 'express';
import mongoose from 'mongoose';
import { Record, RECORD_FIELDS } from '../models/Record.js';
import { Entry } from '../models/Entry.js';
import { normalizeRecord } from '../parser/normalize.js';
import { config } from '../config.js';

const r = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: config.timezone });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pick = (o) => Object.fromEntries(RECORD_FIELDS.filter((k) => k in o).map((k) => [k, o[k]]));

r.get('/', async (req, res, next) => {
  try {
    const { category, subtype, from, to, q, direction, entry } = req.query;
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const filter = {};
    if (category) filter.category = String(category);
    if (subtype) filter.subtype = String(subtype);
    if (direction) filter.direction = String(direction);
    if (entry && mongoose.isValidObjectId(entry)) filter.entry = entry;
    if ((from && DATE_RE.test(from)) || (to && DATE_RE.test(to))) {
      filter.date = {};
      if (DATE_RE.test(from || '')) filter.date.$gte = from;
      if (DATE_RE.test(to || '')) filter.date.$lte = to;
    }
    if (q) {
      const re = new RegExp(esc(String(q).slice(0, 100)), 'i');
      filter.$or = ['title', 'notes', 'merchant', 'creator', 'location', 'platform', 'subtype'].map((f) => ({ [f]: re }))
        .concat([{ people: re }, { tags: re }, { items: re }]);
    }
    const [records, total] = await Promise.all([
      Record.find(filter).sort({ date: -1, time: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Record.countDocuments(filter),
    ]);
    res.json({ records, total, page, pages: Math.ceil(total / limit) });
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const rec = normalizeRecord(pick(req.body || {}), today());
    if (!rec) return res.status(400).json({ error: 'Invalid record: category and title (and amount for finance) are required' });
    res.status(201).json({ record: await Record.create({ ...rec, source: 'manual' }) });
  } catch (e) { next(e); }
});

r.patch('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const existing = await Record.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const merged = normalizeRecord({ ...pick(existing), ...pick(req.body || {}) }, existing.date);
    if (!merged) return res.status(400).json({ error: 'Invalid record' });
    const unset = Object.fromEntries(RECORD_FIELDS.filter((k) => !(k in merged) && k in existing).map((k) => [k, 1]));
    const record = await Record.findByIdAndUpdate(
      req.params.id,
      { $set: { ...merged, source: 'manual' }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true }
    ).lean();
    res.json({ record });
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const rec = await Record.findByIdAndDelete(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    if (rec.entry) await Entry.updateOne({ _id: rec.entry }, { $inc: { recordCount: -1 } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
