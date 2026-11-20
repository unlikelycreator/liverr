// Single source of truth for what Liverr tracks. The frontend mirrors these keys.
export const CATEGORIES = {
  finance: {
    label: 'Finance',
    subtypes: ['food', 'groceries', 'transport', 'shopping', 'bills', 'rent', 'entertainment', 'health', 'travel', 'education', 'subscription', 'salary', 'freelance', 'investment', 'gift', 'transfer', 'other'],
    hint: 'Any money spent or received. direction = expense | income. amount is a positive number.',
  },
  food: {
    label: 'Food',
    subtypes: ['breakfast', 'lunch', 'dinner', 'snack', 'drink'],
    hint: 'Meals, snacks and drinks. title = what was eaten. items = individual dishes.',
  },
  media: {
    label: 'Media',
    subtypes: ['movie', 'show', 'book', 'music', 'podcast', 'game', 'video', 'article'],
    hint: 'Things watched, read, listened to or played. title = exact name of the work. status = finished | in_progress | started | dropped.',
  },
  exercise: {
    label: 'Exercise',
    subtypes: ['run', 'walk', 'gym', 'cycling', 'swim', 'yoga', 'sport', 'hiit', 'stretching', 'other'],
    hint: 'Workouts and physical activity, with duration, distance, sets/reps where mentioned.',
  },
  health: {
    label: 'Health',
    subtypes: ['sleep', 'weight', 'water', 'steps', 'medication', 'symptom', 'checkup', 'other'],
    hint: 'Body metrics and wellbeing: sleep hours, weight, water intake, steps, symptoms, medicine.',
  },
  mood: {
    label: 'Mood',
    subtypes: ['great', 'good', 'okay', 'low', 'bad'],
    hint: 'How the person felt. rating 1-5 (5 = great). tags = emotions.',
  },
  activity: {
    label: 'Activities',
    subtypes: ['work', 'study', 'chores', 'hobby', 'errand', 'project', 'self_care', 'other'],
    hint: 'Things done that are not covered elsewhere: work, studying, chores, hobbies, errands.',
  },
  social: {
    label: 'People',
    subtypes: ['meetup', 'call', 'message', 'date', 'family', 'party', 'other'],
    hint: 'Time with or contact with people. people = names.',
  },
  place: {
    label: 'Places',
    subtypes: ['restaurant', 'cafe', 'home', 'office', 'outdoors', 'shop', 'travel', 'other'],
    hint: 'Places visited. location = name of the place.',
  },
  note: {
    label: 'Notes',
    subtypes: ['idea', 'todo', 'goal', 'gratitude', 'reflection', 'other'],
    hint: 'Ideas, todos, goals, gratitude and reflections worth keeping.',
  },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES);
