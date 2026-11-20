import { config } from '../config.js';
import { parseWithGemini } from './gemini.js';
import { parseWithRules } from './rules.js';
import { normalizeRecord } from './normalize.js';

/**
 * Turn a free-form journal entry into normalized records.
 * Uses Gemini when GEMINI_API_KEY is set, and falls back to the offline rule engine on any failure.
 */
export async function parseJournal(text, date) {
  let result;
  let parser = 'rules';
  let warning;
  if (config.geminiKey) {
    try {
      result = await parseWithGemini(text, date);
      parser = 'gemini';
    } catch (err) {
      warning = 'AI parsing failed, used the offline parser instead.';
      console.error('[parser] gemini failed, falling back to rules:', err.message);
    }
  }
  if (!result) result = parseWithRules(text, date);

  const records = (result.records || []).map((r) => normalizeRecord(r, date)).filter(Boolean);
  const mood = Number.isInteger(result.mood) && result.mood >= 1 && result.mood <= 5 ? result.mood : undefined;
  return { records, summary: typeof result.summary === 'string' ? result.summary.slice(0, 600) : '', mood, parser, warning };
}
