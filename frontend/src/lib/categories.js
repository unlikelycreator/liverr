import {
  Wallet, UtensilsCrossed, Clapperboard, Dumbbell, HeartPulse, Smile, ListChecks, Users, MapPin, StickyNote,
} from 'lucide-react';

// Visual + behavioural metadata for each category. Keys mirror backend/src/categories.js.
export const CATEGORIES = {
  finance: { label: 'Ledger', noun: 'transaction', icon: Wallet, color: '#10b981', blurb: 'Every rupee in and out.' },
  food: { label: 'Food', noun: 'meal', icon: UtensilsCrossed, color: '#f97316', blurb: 'Meals, snacks and drinks.' },
  media: { label: 'Media', noun: 'title', icon: Clapperboard, color: '#a855f7', blurb: 'Watched, read, heard, played.' },
  exercise: { label: 'Exercise', noun: 'workout', icon: Dumbbell, color: '#0ea5e9', blurb: 'Your training log.' },
  health: { label: 'Health', noun: 'metric', icon: HeartPulse, color: '#f43f5e', blurb: 'Sleep, weight, water, symptoms.' },
  mood: { label: 'Mood', noun: 'check-in', icon: Smile, color: '#eab308', blurb: 'How your days felt.' },
  activity: { label: 'Activities', noun: 'activity', icon: ListChecks, color: '#3b82f6', blurb: 'Work, study, chores, hobbies.' },
  social: { label: 'People', noun: 'interaction', icon: Users, color: '#ec4899', blurb: 'Who you spent time with.' },
  place: { label: 'Places', noun: 'place', icon: MapPin, color: '#14b8a6', blurb: 'Where you went.' },
  note: { label: 'Notes', noun: 'note', icon: StickyNote, color: '#8b8b96', blurb: 'Ideas, todos, gratitude.' },
};
export const CATEGORY_KEYS = Object.keys(CATEGORIES);

export const SUBTYPES = {
  finance: ['food', 'groceries', 'transport', 'shopping', 'bills', 'rent', 'entertainment', 'health', 'travel', 'education', 'subscription', 'salary', 'freelance', 'investment', 'gift', 'transfer', 'other'],
  food: ['breakfast', 'lunch', 'dinner', 'snack', 'drink'],
  media: ['movie', 'show', 'book', 'music', 'podcast', 'game', 'video', 'article'],
  exercise: ['run', 'walk', 'gym', 'cycling', 'swim', 'yoga', 'sport', 'hiit', 'stretching', 'other'],
  health: ['sleep', 'weight', 'water', 'steps', 'medication', 'symptom', 'checkup', 'other'],
  mood: ['great', 'good', 'okay', 'low', 'bad'],
  activity: ['work', 'study', 'chores', 'hobby', 'errand', 'project', 'self_care', 'other'],
  social: ['meetup', 'call', 'message', 'date', 'family', 'party', 'other'],
  place: ['restaurant', 'cafe', 'home', 'office', 'outdoors', 'shop', 'travel', 'other'],
  note: ['idea', 'todo', 'goal', 'gratitude', 'reflection', 'other'],
};

// Which editable fields each category shows in the record editor.
export const FIELDS = {
  finance: ['amount', 'direction', 'currency', 'merchant'],
  food: ['items', 'calories', 'location'],
  media: ['status', 'rating', 'platform', 'creator'],
  exercise: ['durationMin', 'distanceKm', 'sets', 'reps', 'weightKg', 'calories', 'items'],
  health: ['value', 'unit'],
  mood: ['rating', 'tags'],
  activity: ['durationMin', 'people'],
  social: ['people', 'location'],
  place: ['location', 'people'],
  note: ['tags'],
};

export const FIELD_META = {
  amount: { label: 'Amount', type: 'number' },
  direction: { label: 'Direction', type: 'select', options: ['expense', 'income'] },
  currency: { label: 'Currency', type: 'text' },
  merchant: { label: 'Merchant / payer', type: 'text' },
  items: { label: 'Items', type: 'list' },
  calories: { label: 'Calories', type: 'number' },
  location: { label: 'Location', type: 'text' },
  status: { label: 'Status', type: 'select', options: ['finished', 'in_progress', 'started', 'dropped'] },
  rating: { label: 'Rating', type: 'number' },
  platform: { label: 'Platform', type: 'text' },
  creator: { label: 'Creator', type: 'text' },
  durationMin: { label: 'Duration (min)', type: 'number' },
  distanceKm: { label: 'Distance (km)', type: 'number' },
  sets: { label: 'Sets', type: 'number' },
  reps: { label: 'Reps', type: 'number' },
  weightKg: { label: 'Weight (kg)', type: 'number' },
  value: { label: 'Value', type: 'number' },
  unit: { label: 'Unit', type: 'text' },
  tags: { label: 'Tags', type: 'list' },
  people: { label: 'People', type: 'list' },
};

export const MOOD_FACE = { 5: '😄', 4: '🙂', 3: '😐', 2: '😕', 1: '😞' };
