import mongoose from 'mongoose';

const entrySchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 20000 },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD (local day the entry is about)
    summary: { type: String, default: '' },
    mood: { type: Number, min: 1, max: 5 },
    parser: { type: String, enum: ['gemini', 'rules'], default: 'rules' },
    recordCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

entrySchema.index({ text: 'text', summary: 'text' });

export const Entry = mongoose.model('Entry', entrySchema);
