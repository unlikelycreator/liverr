import mongoose from 'mongoose';
import { CATEGORY_KEYS } from '../categories.js';

const recordSchema = new mongoose.Schema(
  {
    category: { type: String, enum: CATEGORY_KEYS, required: true, index: true },
    subtype: { type: String, default: 'other', lowercase: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    notes: { type: String, default: '', maxlength: 2000 },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
    time: { type: String, default: '' }, // HH:mm when known

    // finance
    amount: Number,
    currency: String,
    direction: { type: String, enum: ['income', 'expense', null], default: null },
    merchant: String,
    // measurements
    value: Number,
    unit: String,
    durationMin: Number,
    distanceKm: Number,
    calories: Number,
    sets: Number,
    reps: Number,
    weightKg: Number,
    // media
    rating: { type: Number, min: 0, max: 10 },
    status: String,
    creator: String,
    platform: String,
    // shared
    items: [String],
    people: [String],
    location: String,
    tags: [String],

    entry: { type: mongoose.Schema.Types.ObjectId, ref: 'Entry', index: true },
    source: { type: String, enum: ['gemini', 'rules', 'manual'], default: 'manual' },
  },
  { timestamps: true }
);

recordSchema.index({ category: 1, date: -1 });
recordSchema.index({ title: 'text', notes: 'text', merchant: 'text', creator: 'text', location: 'text' });

export const Record = mongoose.model('Record', recordSchema);

// Fields a client (or the parser) may set.
export const RECORD_FIELDS = [
  'category', 'subtype', 'title', 'notes', 'date', 'time', 'amount', 'currency', 'direction', 'merchant',
  'value', 'unit', 'durationMin', 'distanceKm', 'calories', 'sets', 'reps', 'weightKg', 'rating', 'status',
  'creator', 'platform', 'items', 'people', 'location', 'tags',
];
