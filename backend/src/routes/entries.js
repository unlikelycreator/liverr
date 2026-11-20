import { Router } from 'express';
import mongoose from 'mongoose';
import { Entry } from '../models/Entry.js';
import { Record } from '../models/Record.js';
import { parseJournal } from '../parser/index.js';
import { config } from '../config.js';

const r = Router();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: config.timezone });
const validId = (id) => mongoose.isValidObjectId(id);

// Preview: parse without saving.
r.post('/preview', async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Write something first' });
    const date = DATE_RE.test(req.body?.date) ? req.body.date : today();
    res.json(await parseJournal(text, date));
  } catch (e) { next(e); }
});

r.post('/', async (req, res, next) => {
  try {
    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Write something first' });
    if (text.length > 20000) return res.status(400).json({ error: 'Entry is too long' });
    const date = DATE_RE.test(req.body?.date) ? req.body.date : today();
    const parsed = await parseJournal(text, date);
    const entry = await Entry.create({ text, date, summary: parsed.summary, mood: parsed.mood, parser: parsed.parser, recordCount: parsed.records.length });
    const records = await Record.insertMany(parsed.records.map((x) => ({ ...x, entry: entry._id, source: parsed.parser })));
    res.status(201).json({ entry, records, warning: parsed.warning });
  } catch (e) { next(e); }
});

r.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const q = {};
    if (req.query.before && DATE_RE.test(req.query.before)) q.date = { $lt: req.query.before };
    if (req.query.date && DATE_RE.test(req.query.date)) q.date = req.query.date;
    if (req.query.q) q.$text = { $search: String(req.query.q) };
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const [entries, total] = await Promise.all([
      Entry.find(q).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Entry.countDocuments(q),
    ]);
    res.json({ entries, total });
  } catch (e) { next(e); }
});

r.get('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const entry = await Entry.findById(req.params.id).lean();
    if (!entry) return res.status(404).json({ error: 'Not found' });
    const records = await Record.find({ entry: entry._id }).sort({ category: 1 }).lean();
    res.json({ entry, records });
  } catch (e) { next(e); }
});

// Edit text and re-run extraction. Manually added/edited records survive.
r.put('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const entry = await Entry.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    const text = String(req.body?.text ?? entry.text).trim();
    if (!text) return res.status(400).json({ error: 'Entry cannot be empty' });
    const date = DATE_RE.test(req.body?.date) ? req.body.date : entry.date;
    const parsed = await parseJournal(text, date);
    await Record.deleteMany({ entry: entry._id, source: { $ne: 'manual' } });
    const records = await Record.insertMany(parsed.records.map((x) => ({ ...x, entry: entry._id, source: parsed.parser })));
    Object.assign(entry, { text, date, summary: parsed.summary, mood: parsed.mood, parser: parsed.parser });
    entry.recordCount = await Record.countDocuments({ entry: entry._id });
    await entry.save();
    res.json({ entry, records: await Record.find({ entry: entry._id }).lean(), warning: parsed.warning, added: records.length });
  } catch (e) { next(e); }
});

r.delete('/:id', async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Not found' });
    const keep = req.query.keepRecords === 'true';
    const entry = await Entry.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (keep) await Record.updateMany({ entry: entry._id }, { $unset: { entry: 1 } });
    else await Record.deleteMany({ entry: entry._id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default r;
