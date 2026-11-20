import { CATEGORIES } from '../categories.js';
import { config } from '../config.js';

const S = (description, extra = {}) => ({ type: 'STRING', description, ...extra });
const N = (description) => ({ type: 'NUMBER', description });
const A = (description) => ({ type: 'ARRAY', items: { type: 'STRING' }, description });

const responseSchema = {
  type: 'OBJECT',
  properties: {
    summary: S('One or two sentence neutral summary of the day, second person ("You ...").'),
    mood: { type: 'INTEGER', description: 'Overall mood of the entry 1-5, if inferable.' },
    records: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          category: S('Category key', { enum: Object.keys(CATEGORIES) }),
          subtype: S('One of the allowed subtypes for the category'),
          title: S('Short, specific title. For media, the exact name of the work.'),
          notes: S('Extra detail from the text worth keeping, else empty'),
          date: S('YYYY-MM-DD the event happened'),
          time: S('HH:mm 24h if stated or clearly implied, else empty'),
          amount: N('Money amount, positive'),
          currency: S('ISO 4217 code'),
          direction: S('income or expense', { enum: ['income', 'expense'] }),
          merchant: S('Who was paid / who paid'),
          value: N('Generic measured value (sleep hours, weight, litres, steps...)'),
          unit: S('Unit for value: h, kg, l, steps, mg...'),
          durationMin: N('Duration in minutes'),
          distanceKm: N('Distance in kilometres'),
          calories: N('Calories (eaten or burned)'),
          sets: N('Sets'),
          reps: N('Reps per set'),
          weightKg: N('Weight lifted in kg'),
          rating: N('Media rating out of 10, or mood 1-5'),
          status: S('Media status: finished | in_progress | started | dropped'),
          creator: S('Director / author / artist / channel'),
          platform: S('Netflix, Prime Video, Kindle, Spotify, theatre, YouTube...'),
          items: A('Individual food items or exercise movements'),
          people: A('Names or relations of people involved'),
          location: S('Place name'),
          tags: A('Short lowercase tags (emotions for mood)'),
        },
        required: ['category', 'subtype', 'title'],
      },
    },
  },
  required: ['records'],
};

function systemPrompt(date) {
  const cats = Object.entries(CATEGORIES)
    .map(([k, c]) => `- ${k}: ${c.hint} Subtypes: ${c.subtypes.join(', ')}.`)
    .join('\n');
  return `You are the extraction engine of Liverr, a personal life-tracking app. The user writes a free-form journal entry; you turn it into structured records.

Categories:
${cats}

Rules:
- Extract EVERY trackable fact. One record per distinct thing: two meals = two food records, three purchases = three finance records.
- A single sentence can create several records, e.g. "Lunch at Cafe Mocha with Riya, paid 640" => food (lunch), finance (expense 640, subtype food, merchant Cafe Mocha), social (Riya), place (Cafe Mocha).
- Never invent facts, numbers, names or titles that are not in the text. Leave unknown fields out.
- The entry is written for ${date}. Resolve relative days ("yesterday", "this morning", "last night") against it and output absolute YYYY-MM-DD dates.
- Money: numbers only, positive. Default currency ${config.currency} unless another is explicit ($ = USD, € = EUR, £ = GBP, ₹/rs = INR). "1.2k" = 1200.
- Convert durations to minutes, distances to km, weights to kg, water to litres (1 glass = 0.25 l).
- Sleep goes to health/sleep with value in hours and unit "h".
- Titles: concise and specific, Title Case for names ("Oppenheimer", "Chicken Biryani", "5K Morning Run"). Media title is just the work name, without "the movie".
- Mood: at most one mood record for the entry unless the mood clearly changed; rating 1-5.
- Do not create note records for things already captured by another category.`;
}

export async function parseWithGemini(text, date) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(date) }] },
        contents: [{ role: 'user', parts: [{ text: `Journal entry for ${date}:\n\n${text}` }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json', responseSchema },
      }),
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    const out = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('');
    if (!out) throw new Error('Gemini returned no content');
    return JSON.parse(out);
  } finally {
    clearTimeout(timer);
  }
}
