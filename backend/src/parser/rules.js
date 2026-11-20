// Offline, dependency-free journal parser. Used when no Gemini key is configured
// or when the Gemini call fails. Heuristic by design: it favours precision over recall.
import { config } from '../config.js';
import { titleCase } from './normalize.js';

const WORD_NUM = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90,
  half: 0.5, couple: 2, few: 3,
};
const NUM = String.raw`(\d+(?:[.,]\d+)*|${Object.keys(WORD_NUM).join('|')})`;
const toNum = (s) => {
  if (s == null) return undefined;
  const k = String(s).toLowerCase();
  if (k in WORD_NUM) return WORD_NUM[k];
  const n = Number(k.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

const shiftDate = (date, days) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Clean a captured phrase into a short title.
const STOP = /\s+(?:on|with|at|and|in|for|from|today|yesterday|tonight|this|last|after|before|while|which|that|but|because|till|until|then|so|it|was|were|is|most|all|whole|the whole|throughout|during)\b.*$/i;
const clean = (s, { stop = true, article = true } = {}) => {
  if (!s) return '';
  let t = s.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (stop) t = t.replace(STOP, '');
  t = t.replace(article ? /^(?:the|a|an|my|some)\s+/i : /^(?:a|an|my|some)\s+/i, '').replace(/[,.;:!?]+$/, '').trim();
  return t.split(/\s+/).slice(0, 8).join(' ');
};
const quoted = (s) => s.match(/["“']([^"”']{2,80})["”']/)?.[1];

function splitSentences(text) {
  return text
    .replace(/\r/g, '')
    .split(/(?<=[.!?])\s+|\n+|;\s*|,?\s+(?:and then|then|after that|later|also)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

// ---------- Finance ----------
const CURRENCY_SYM = [
  [/₹|\brs\.?|\binr\b|\brupees?\b/i, 'INR'],
  [/\$|\busd\b|\bdollars?\b|\bbucks\b/i, 'USD'],
  [/€|\beur\b|\beuros?\b/i, 'EUR'],
  [/£|\bgbp\b|\bpounds?\b/i, 'GBP'],
];
const AMOUNT_RE = new RegExp(
  String.raw`(?:(₹|rs\.?|inr|\$|usd|€|eur|£)\s?(\d[\d,]*(?:\.\d+)?)(\s?k\b)?)|(?:(\d[\d,]*(?:\.\d+)?)(\s?k\b)?\s?(rupees?|rs\.?|inr|bucks|dollars?|usd|euros?|eur|pounds?|gbp)\b)` +
    String.raw`|(?:\b(?:spent|spend|paid|pay|cost|costs|costing|earned|received|got|for|of|worth|charged|transferred|sent)\s+(?:me\s+)?(?:around\s+|about\s+|like\s+)?(\d[\d,]*(?:\.\d+)?)(\s?k\b)?)`,
  'gi'
);
const INCOME_RE = /\b(earned|received|got paid|salary|credited|income|refund(?:ed)?|sold|bonus|freelanc\w*|stipend|cashback|won)\b/i;
const MONEY_CTX = /\b(got|freelanc\w*|income|spent|spend|paid|pay|bought|buy|purchase|cost|ordered|earned|received|salary|credited|bill|rent|recharge|subscription|fee|ticket|tip|donated|lent|borrowed|refund|sold|bonus)\b|₹|\$|€|£|\brs\b|rupees/i;
const FIN_SUBTYPES = [
  ['salary', /\b(salary|paycheck|payslip)\b/i],
  ['freelance', /\b(freelanc\w*|client|invoice|gig)\b/i],
  ['investment', /\b(sip|stocks?|shares|mutual funds?|invest\w*|crypto|fd|deposit)\b/i],
  ['rent', /\brent\b/i],
  ['subscription', /\b(netflix|spotify|prime|subscription|hotstar|youtube premium|icloud|chatgpt)\b/i],
  ['bills', /\b(electricity|wifi|wi-fi|internet|phone bill|recharge|bill|gas bill|water bill|insurance)\b/i],
  ['transport', /\b(uber|ola|rapido|cab|taxi|fuel|petrol|diesel|metro|bus|train|auto|parking|toll|flight)\b/i],
  ['groceries', /\b(grocer\w*|vegetables|veggies|fruits?|milk|bigbasket|blinkit|zepto|instamart|supermarket)\b/i],
  ['food', /\b(lunch|dinner|breakfast|coffee|tea|snack|zomato|swiggy|restaurant|cafe|pizza|burger|food|meal|biryani|drinks?|beer)\b/i],
  ['health', /\b(medicine|doctor|pharmacy|hospital|clinic|dentist|medical|tablets?)\b/i],
  ['entertainment', /\b(movie|cinema|concert|show tickets?|tickets?|game|bowling|club)\b/i],
  ['education', /\b(course|books?|class|tuition|udemy|coursera|exam fee)\b/i],
  ['travel', /\b(hotel|airbnb|trip|travel|booking)\b/i],
  ['gift', /\b(gift|donat\w*|charity)\b/i],
  ['transfer', /\b(transferred|sent|lent|borrowed|upi to)\b/i],
  ['shopping', /\b(amazon|flipkart|myntra|bought|clothes|shoes|shirt|jeans|shopping|mall|gadget|phone)\b/i],
];

function parseFinance(s, date) {
  if (!MONEY_CTX.test(s)) return [];
  const out = [];
  AMOUNT_RE.lastIndex = 0;
  let m;
  while ((m = AMOUNT_RE.exec(s))) {
    const raw = m[2] ?? m[4] ?? m[7];
    const k = m[3] ?? m[5] ?? m[8];
    let amount = toNum(raw);
    if (!amount) continue;
    if (k) amount *= 1000;
    // Skip numbers that are obviously units ("5 km", "2 hours", "3 sets", "2025").
    const after = s.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (!m[1] && !m[6] && /^\s?(km|kms|k\b|mins?|minutes?|hours?|hrs?|h\b|sets?|reps?|kg|kgs|steps|glasses|l\b|litres?|liters?|pm|am|times|episodes?|pages?|chapters?|calories|kcal|people|friends|days|weeks|years)/i.test(after)) continue;
    if (!m[1] && !m[6] && amount >= 1900 && amount <= 2100 && /\b(in|since|year)\b/i.test(s)) continue;

    let currency = config.currency;
    const sym = m[1] || m[6] || '';
    for (const [re, code] of CURRENCY_SYM) if (re.test(sym)) currency = code;

    const direction = INCOME_RE.test(s) ? 'income' : 'expense';
    const subtype = FIN_SUBTYPES.find(([, re]) => re.test(s))?.[0] || (direction === 'income' ? 'other' : 'other');
    const merchant = clean(s.match(/\b(?:at|from|to|on)\s+([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*)*)/)?.[1] || '');
    const what = clean(
      s.match(/\b(?:on|for|bought|ordered|purchased)\s+(?:a\s+|an\s+|some\s+|new\s+)?([a-z][\w\s'-]{2,40}?)(?=\s+(?:for|at|from|on|worth|which|that|and|,|₹|\$|rs|\d)|[.,!]|$)/i)?.[1] || ''
    );
    const label = what && merchant && /^(breakfast|lunch|dinner|snacks?|coffee|drinks?)$/i.test(what) ? `${what} at ${merchant}` : what;
    const title = titleCase(label || merchant || (direction === 'income' ? subtype === 'other' ? 'Income' : subtype : subtype === 'other' ? 'Expense' : subtype));
    out.push({ category: 'finance', subtype, title, amount, currency, direction, merchant: merchant || undefined, date, notes: s });
  }
  return out;
}

// ---------- Media ----------
const PLATFORMS = [
  ['Netflix', /netflix/i], ['Prime Video', /\bprime( video)?\b|amazon prime/i], ['Disney+ Hotstar', /hotstar|disney/i],
  ['YouTube', /youtube|\byt\b/i], ['Spotify', /spotify/i], ['Apple TV+', /apple tv/i], ['HBO Max', /\bhbo|\bmax\b/i],
  ['JioCinema', /jio ?cinema/i], ['Kindle', /kindle/i], ['Audible', /audible/i], ['Theatre', /\b(theat(er|re)|cinema|pvr|inox|imax)\b/i],
];
const MEDIA_RE =
  /\b(watched|watching|re-?watched|saw|binged|binge-watched|streamed|finished watching|started watching|read|reading|finished reading|started reading|finished|listened to|listening to|played|playing)\s+(.+)/i;

function parseMedia(s, date) {
  const m = s.match(MEDIA_RE);
  if (!m) return [];
  const verb = m[1].toLowerCase();
  let rest = m[2];
  if (/^(?:out|up|with|to|for|around|a lot|it|that|this|some|my|to\b)/i.test(rest) && !quoted(s)) {
    if (!/\b(movie|film|show|series|episode|book|novel|podcast|album|song|game|documentary)\b/i.test(rest)) return [];
  }
  if (/^played\b|^playing\b/.test(verb) && /\b(football|cricket|badminton|tennis|basketball|volleyball|squash|golf|pickleball|table tennis|chess with)\b/i.test(rest)) return [];
  if (/^finished$/.test(verb) && !/\b(book|novel|series|show|season|movie|film|game|podcast)\b/i.test(rest)) return [];

  let subtype = 'movie';
  if (/\b(episodes?|seasons?|series|shows?|sitcom|anime|s\d+e\d+)\b/i.test(s)) subtype = 'show';
  else if (/\b(documentary|movie|film)\b/i.test(s)) subtype = 'movie';
  else if (/read/.test(verb)) subtype = /\b(article|blog|post|paper|newsletter)\b/i.test(s) ? 'article' : 'book';
  else if (/listen/.test(verb)) subtype = /\bpodcast\b/i.test(s) ? 'podcast' : 'music';
  else if (/play/.test(verb)) subtype = 'game';
  else if (/youtube/i.test(s) || (/\bvideos?\b/i.test(s) && !/prime video/i.test(s))) subtype = 'video';

  let title = quoted(s);
  if (!title) {
    rest = rest
      .replace(/^(?:the\s+|a\s+|an\s+)?(?:new\s+)?(?:movie|film|show|series|tv show|book|novel|documentary|podcast|album|song|game|video|(?:the\s+)?(?:first\s+|last\s+|next\s+|final\s+)?(?:\w+\s+)?(?:few\s+|of\s+)?episodes?\s+(?:\d+\s+)?of|season\s+\d+\s+of)\s*(?:called|named|titled)?\s*/i, '')
      .replace(/^(?:the\s+)?(?:movie|film|show|series)\s+/i, '');
    title = clean(rest, { article: false });
  }
  if (!title || title.length < 2) return [];
  const platform = PLATFORMS.find(([, re]) => re.test(s))?.[0];
  let rating;
  const r = s.match(/(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*(10|5)\b/i) || s.match(/(\d(?:\.\d)?)\s*stars?/i);
  if (r) rating = r[2] === '5' || !r[2] ? Number(r[1]) * 2 : Number(r[1]);
  const status = /started|watching|reading|listening|playing/.test(verb) ? 'in_progress' : 'finished';
  const creator = clean(s.match(/\bby\s+([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*)*)/)?.[1] || '') || undefined;
  return [{ category: 'media', subtype, title: titleCase(title), platform, rating, status, creator, date, notes: s }];
}

// ---------- Food ----------
const MEALS = ['breakfast', 'brunch', 'lunch', 'dinner', 'snack', 'snacks', 'supper'];
const DRINKS = /\b(coffee|tea|chai|latte|cappuccino|espresso|juice|smoothie|shake|beer|wine|whisky|cocktail|soda|coke|lassi|kombucha)\b/i;

function parseFood(s, date) {
  const lower = s.toLowerCase();
  let meal = MEALS.find((w) => new RegExp(`\\b${w}\\b`).test(lower));
  if (meal === 'brunch') meal = 'lunch';
  if (meal === 'supper') meal = 'dinner';
  if (meal === 'snacks') meal = 'snack';
  const eat = s.match(/\b(?:ate|eat|eating|had|having|grabbed|ordered|cooked|made|tried|devoured|drank|drink|sipped)\s+(?:some\s+|a\s+|an\s+|my\s+|the\s+)?(.+)/i);
  const mealIs = s.match(/\b(?:breakfast|lunch|dinner|snack)\s+(?:was|is|:|-)\s+(.+)/i);
  const forMeal = s.match(/\b(?:for|at)\s+(?:breakfast|lunch|dinner|snack)\s*,?\s*(?:i\s+)?(?:had|ate)?\s*(.+)/i);
  let phrase = mealIs?.[1] || (eat && (meal || DRINKS.test(eat[1]) || /\b(ate|eat|eating|cooked|devoured)\b/i.test(eat[0])) ? eat[1] : null) || forMeal?.[1];
  if (!phrase && !meal) return [];
  if (phrase) {
    phrase = phrase
      .replace(/^(?:breakfast|lunch|dinner|snacks?)\s+(?:from|at)\s+[A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*)*\s*,?\s*/, '')
      .replace(/\b(?:for|at)\s+(?:breakfast|lunch|dinner|snack)\b.*$/i, '')
      .replace(/\b(?:at|from|with|in|which|that|because|but|while|for)\b.*$/i, '')
      .replace(/(₹|rs\.?|\$)\s?\d.*$/i, '')
      .trim();
  }
  if (phrase && /\b(water|fun|time|meeting|call|chat|fight|argument|bath|shower|nap|headache|fever|dream|idea|good|great|bad|a lot|work)\b/i.test(phrase) && !meal) return [];
  if (phrase && /^\s*water\b/i.test(phrase)) return [];
  const items = (phrase || '')
    .split(/,\s*|\s+and\s+|\s+with\s+|\s*\+\s*|\s*&\s*/i)
    .map((x) => clean(x, { stop: false }))
    .filter((x) => x && x.length > 1 && x.split(' ').length <= 5 && !MEALS.includes(x.toLowerCase()));
  if (!meal) {
    if (DRINKS.test(s) && items.length <= 2) meal = 'drink';
    else meal = 'snack';
  }
  const calories = toNum(s.match(/(\d+)\s*(?:kcal|cal\b|calories)/i)?.[1]);
  const location = clean(s.match(/\b(?:at|from)\s+([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*)*)/)?.[1] || '') || undefined;
  const title = items.length ? titleCase(items.slice(0, 3).join(', ')) : titleCase(meal);
  return [{ category: 'food', subtype: meal, title, items: items.map(titleCase), calories, location, date, notes: s }];
}

// ---------- Exercise ----------
const EX_TYPES = [
  ['run', /\b(ran|run|running|jog|jogged|jogging|sprint\w*|5k|10k|marathon)\b/i],
  ['cycling', /\b(cycl\w*|biked|biking|bike ride|spin class)\b/i],
  ['swim', /\b(swam|swim\w*|laps in the pool)\b/i],
  ['yoga', /\b(yoga|surya namaskar|pilates|meditat\w*)\b/i],
  ['hiit', /\b(hiit|crossfit|tabata|circuit)\b/i],
  ['gym', /\b(gym|work(?:ed)? ?out|lifted|lifting|weights|bench|deadlifts?|squats?|push-?ups|pull-?ups|chest day|leg day|back day|arm day|shoulder day|planks?|abs|strength)\b/i],
  ['sport', /\b(football|soccer|cricket|badminton|tennis|basketball|volleyball|squash|golf|pickleball|table tennis|boxing|climbing|bouldering|hike|hiked|hiking|trek\w*)\b/i],
  ['walk', /\b(walk(?:ed)?|walking|stroll\w*)\b/i],
  ['stretching', /\b(stretch\w*|mobility)\b/i],
];

const durationOf = (s) => {
  let total = 0;
  const h = s.match(new RegExp(`${NUM}\\s*(?:and a half\\s*)?(?:hours?|hrs?|h)\\b`, 'i'));
  if (h) total += toNum(h[1]) * 60 + (/and a half/i.test(h[0]) ? 30 : 0);
  if (/half an hour/i.test(s)) total += 30;
  const mm = s.match(new RegExp(`${NUM}\\s*(?:minutes?|mins?|m)\\b`, 'i'));
  if (mm) total += toNum(mm[1]);
  return total || undefined;
};

function parseExercise(s, date) {
  const type = EX_TYPES.find(([, re]) => re.test(s));
  if (!type) return [];
  let subtype = type[0];
  // "walked to the store" without metrics is not a workout worth logging.
  if (subtype === 'walk' && !/\b(km|mile|steps|minutes?|mins?|hours?|hrs?|for a walk|evening walk|morning walk|long walk)\b/i.test(s)) return [];
  if (subtype === 'run' && /\b(ran out|ran into|run out|errands?|ran late|run late)\b/i.test(s)) return [];
  const durationMin = durationOf(s);
  const dm = s.match(/(\d+(?:\.\d+)?)\s*(km|kms|kilomet\w*|k\b|miles?|mi\b)/i);
  let distanceKm = dm ? Number(dm[1]) * (/mi/i.test(dm[2]) ? 1.609 : 1) : undefined;
  if (distanceKm) distanceKm = Math.round(distanceKm * 100) / 100;
  if (!distanceKm && /\b5k\b/i.test(s)) distanceKm = 5;
  if (!distanceKm && /\b10k\b/i.test(s)) distanceKm = 10;
  const sr = s.match(/(\d+)\s*(?:sets?\s*(?:of|x)?|x)\s*(\d+)\s*(?:reps?)?/i);
  const wk = s.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|lbs?|pounds)\b/i);
  const weightKg = wk && !/\b(weigh|weight is|weight was|scale)\b/i.test(s) ? Number(wk[1]) * (/lb|pound/i.test(wk[2]) ? 0.4536 : 1) : undefined;
  const calories = toNum(s.match(/(?:burn(?:ed|t)?\s*)?(\d+)\s*(?:kcal|cal\b|calories)\s*(?:burn)?/i)?.[1]);
  const moves = [...s.matchAll(/\b(squats?|deadlifts?|bench press|bench|push-?ups|pull-?ups|lunges|planks?|curls|rows|overhead press|dips|crunches|burpees)\b/gi)].map((x) => titleCase(x[1].toLowerCase()));
  const sport = s.match(EX_TYPES.find(([k]) => k === 'sport')[1])?.[1];
  const label = {
    run: 'Run', cycling: 'Cycling', swim: 'Swim', yoga: /pilates/i.test(s) ? 'Pilates' : /meditat/i.test(s) ? 'Meditation' : 'Yoga',
    hiit: 'HIIT', gym: /(chest|leg|back|arm|shoulder) day/i.test(s) ? titleCase(s.match(/(chest|leg|back|arm|shoulder) day/i)[0].toLowerCase()) : 'Gym Workout',
    sport: sport ? titleCase(sport.toLowerCase()) : 'Sport', walk: 'Walk', stretching: 'Stretching',
  }[subtype];
  const title = distanceKm ? `${label} · ${distanceKm} km` : durationMin ? `${label} · ${durationMin} min` : label;
  return [{
    category: 'exercise', subtype, title, durationMin, distanceKm, sets: sr ? Number(sr[1]) : undefined, reps: sr ? Number(sr[2]) : undefined,
    weightKg: weightKg ? Math.round(weightKg * 10) / 10 : undefined, calories, items: [...new Set(moves)], date, notes: s,
  }];
}

// ---------- Health ----------
function parseHealth(s, date) {
  const out = [];
  const sleep = s.match(new RegExp(`\\b(?:slept|sleep|sleeping|got|had)\\s+(?:for\\s+|only\\s+|about\\s+|around\\s+|like\\s+|almost\\s+)?${NUM}\\s*(?:and a half\\s*)?(?:hours?|hrs?|h)\\b`, 'i')) ||
    s.match(new RegExp(`${NUM}\\s*(?:hours?|hrs?|h)\\s+(?:of\\s+)?sleep`, 'i'));
  if (sleep) {
    const v = toNum(sleep[1]) + (/and a half/i.test(sleep[0]) ? 0.5 : 0);
    if (v > 0 && v <= 16) out.push({ category: 'health', subtype: 'sleep', title: `Slept ${v} h`, value: v, unit: 'h', date: /last night/i.test(s) ? date : date, notes: s });
  } else if (/\b(slept well|good sleep|slept badly|couldn'?t sleep|insomnia|slept late)\b/i.test(s)) {
    out.push({ category: 'health', subtype: 'sleep', title: titleCase(s.match(/slept well|good sleep|slept badly|couldn'?t sleep|insomnia|slept late/i)[0].toLowerCase()), date, notes: s });
  }
  const w = s.match(/\b(?:weigh(?:ed|t is|t was|ing)?|weight[:\s]+|scale (?:said|showed))\s*(?:in at\s+)?(\d+(?:\.\d+)?)\s*(kg|kgs|lbs?|pounds)?/i);
  if (w) {
    const kg = Number(w[1]) * (/lb|pound/i.test(w[2] || '') ? 0.4536 : 1);
    if (kg > 20 && kg < 300) out.push({ category: 'health', subtype: 'weight', title: `Weight ${Math.round(kg * 10) / 10} kg`, value: Math.round(kg * 10) / 10, unit: 'kg', date, notes: s });
  }
  const water = s.match(new RegExp(`${NUM}\\s*(glasses|glass|litres?|liters?|l|ml|bottles?)\\s+(?:of\\s+)?water`, 'i')) ||
    s.match(new RegExp(`water[^.]*?${NUM}\\s*(glasses|litres?|liters?|l|ml|bottles?)\\b`, 'i'));
  if (water) {
    const n = toNum(water[1]);
    const u = water[2].toLowerCase();
    const l = u.startsWith('glass') ? n * 0.25 : u === 'ml' ? n / 1000 : u.startsWith('bottle') ? n * 1 : n;
    out.push({ category: 'health', subtype: 'water', title: `Water ${Math.round(l * 100) / 100} l`, value: Math.round(l * 100) / 100, unit: 'l', date, notes: s });
  }
  const steps = s.match(/(\d[\d,]*(?:\.\d+)?)(k)?\s*steps/i);
  if (steps) {
    const v = toNum(steps[1]) * (steps[2] ? 1000 : 1);
    out.push({ category: 'health', subtype: 'steps', title: `${v.toLocaleString('en-US')} steps`, value: v, unit: 'steps', date, notes: s });
  }
  const med = s.match(/\b(?:took|taking|had)\s+(?:my\s+|a\s+|an\s+)?((?:paracetamol|crocin|dolo|ibuprofen|aspirin|antibiotics?|vitamin\s?\w*|supplements?|medicine|medication|pills?|tablets?|creatine|protein|omega[- ]?3|multivitamins?|melatonin|insulin)\b[\w\s-]{0,20})/i);
  if (med) out.push({ category: 'health', subtype: 'medication', title: titleCase(clean(med[1])), date, notes: s });
  const sym = s.match(/\b(headache|migraine|fever|cold|cough|sore throat|back pain|stomach ache|acidity|nausea|allerg\w*|sick|flu|cramps|tired|exhausted|fatigue)\b/i);
  if (sym && /\b(had|have|having|got|feel|feeling|felt|was|am|with)\b/i.test(s) && !/\b(not|no)\s+\w*\s*(headache|fever|cold)/i.test(s)) {
    const t = sym[1].toLowerCase();
    if (!['tired', 'exhausted'].includes(t) || /\b(very|so|extremely|really)\b/i.test(s)) out.push({ category: 'health', subtype: 'symptom', title: titleCase(t), date, notes: s });
  }
  if (/\b(doctor|dentist|checkup|check-up|blood test|physio)\b/i.test(s) && /\b(went|visited|appointment|saw|had)\b/i.test(s))
    out.push({ category: 'health', subtype: 'checkup', title: titleCase(s.match(/doctor|dentist|checkup|check-up|blood test|physio/i)[0].toLowerCase()), date, notes: s });
  return out;
}

// ---------- Mood ----------
const MOODS = [
  [5, /\b(amazing|awesome|fantastic|ecstatic|thrilled|elated|wonderful|incredible|on top of the world|blessed|excellent|euphoric|great)\b/i],
  [4, /\b(good|happy|productive|relaxed|calm|content|grateful|peaceful|motivated|energetic|excited|refreshed|proud|positive|nice|cheerful|joyful)\b/i],
  [3, /\b(okay|ok|fine|meh|alright|average|normal|neutral|tired|bored|so-so|mixed)\b/i],
  [2, /\b(sad|low|anxious|stressed|lonely|frustrated|upset|worried|irritated|annoyed|overwhelmed|down|nervous|unmotivated|drained|lazy)\b/i],
  [1, /\b(terrible|awful|depressed|angry|miserable|horrible|furious|devastated|hopeless|worst|panic\w*)\b/i],
];
const LABEL = { 5: 'great', 4: 'good', 3: 'okay', 2: 'low', 1: 'bad' };

function moodOf(s) {
  if (!/\b(feel|feeling|felt|mood|was a|day was|today was|it was|i am|i'm|im|so|very|really|pretty|quite)\b/i.test(s)) return null;
  const neg = /\b(not|wasn'?t|didn'?t|don'?t|isn'?t|never)\s+(?:feel(?:ing)?\s+|very\s+|so\s+|that\s+|too\s+)?(\w+)/i.exec(s);
  const tags = [];
  const scores = [];
  for (const [score, re] of MOODS) {
    const all = s.match(new RegExp(re.source, 'gi')) || [];
    for (const w of all) {
      const word = w.toLowerCase();
      if (neg && neg[2].toLowerCase() === word) { scores.push(score >= 4 ? 2 : 4); tags.push(`not ${word}`); continue; }
      // "great"/"good" describing food/movies is not a mood.
      if (/^(good|great|nice|amazing|awesome)$/.test(word) && !/\b(feel|feeling|felt|mood|day|today|i am|i'm|im|evening|morning|week)\b/i.test(s)) continue;
      scores.push(score);
      tags.push(word);
    }
  }
  if (!scores.length) return null;
  return { score: scores.reduce((a, b) => a + b, 0) / scores.length, tags };
}

// ---------- Social ----------
const RELATIONS = /\b(mom|mum|mother|dad|father|parents|brother|sister|sibling|wife|husband|girlfriend|boyfriend|partner|grandma|grandpa|grandmother|grandfather|aunt|uncle|cousin|son|daughter|kids|friends?|colleagues?|team|boss|roommates?|neighbou?rs?|family)\b/gi;
const NAME_STOP = new Set(['I', 'The', 'A', 'An', 'Today', 'Yesterday', 'Tonight', 'Morning', 'Evening', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Netflix', 'Prime', 'YouTube', 'Spotify', 'Uber', 'Ola', 'Zomato', 'Swiggy', 'Amazon', 'Flipkart', 'Then', 'After', 'Later', 'Also', 'My', 'We', 'It', 'In', 'At', 'On', 'For', 'And', 'But', 'Had', 'Went', 'Got']);

function peopleIn(s) {
  const people = [];
  const withM = s.match(/\b(?:with|met|meet|meeting|called|call with|calling|texted|talked to|spoke to|spoke with|visited|caught up with|hung out with|dinner with|lunch with|date with|saw)\s+((?:my\s+)?[\w\s,&']+)/i);
  if (withM) {
    const seg = withM[1].split(/\b(?:at|for|in|on|about|to|from|which|who|and then|but|because|over)\b/i)[0];
    for (const n of seg.matchAll(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g)) if (!NAME_STOP.has(n[1].split(' ')[0])) people.push(n[1]);
    for (const r of seg.matchAll(RELATIONS)) people.push(r[1].toLowerCase().replace(/^mum$/, 'mom'));
  }
  return [...new Set(people)];
}

function parseSocial(s, date) {
  if (!/\b(met|meet|meeting up|hung out|hangout|caught up|called|call with|video call|facetime|texted|talked to|spoke to|spoke with|visited|dinner with|lunch with|coffee with|date|party|birthday|with my|with (?:[A-Z][a-z]+))\b/.test(s) && !/\b(met|called|party|date)\b/i.test(s)) return [];
  if (/\b(work meeting|standup|stand-up|team meeting|zoom meeting)\b/i.test(s)) return [];
  const people = peopleIn(s);
  if (!people.length) return [];
  let subtype = 'meetup';
  if (/\b(called|call|phone|facetime|video call|rang)\b/i.test(s)) subtype = 'call';
  else if (/\b(texted|messaged|whatsapp|dm'?d|chatted online)\b/i.test(s)) subtype = 'message';
  else if (/\bdate\b/i.test(s)) subtype = 'date';
  else if (/\b(party|birthday|wedding|celebrat\w*)\b/i.test(s)) subtype = 'party';
  else if (people.some((p) => /^(mom|mother|dad|father|parents|brother|sister|grand\w*|aunt|uncle|cousin|family|son|daughter|kids|wife|husband)$/.test(p))) subtype = 'family';
  const verb = { call: 'Call with', message: 'Messaged', date: 'Date with', party: 'Party with', family: 'Time with', meetup: 'Met' }[subtype];
  const names = people.map((p) => (/^[a-z]/.test(p) ? p : p));
  return [{ category: 'social', subtype, title: `${verb} ${names.slice(0, 3).join(', ')}`, people: names, date, notes: s }];
}

// ---------- Place ----------
const PLACE_SUB = [
  ['cafe', /\b(cafe|café|coffee shop|starbucks|blue tokai|third wave|costa)\b/i],
  ['restaurant', /\b(restaurant|dhaba|diner|bistro|bar|pub|brewery)\b/i],
  ['shop', /\b(mall|market|store|supermarket|shop)\b/i],
  ['outdoors', /\b(park|beach|lake|hill|mountain|trek|trail|garden|river)\b/i],
  ['office', /\b(office|workplace|coworking)\b/i],
  ['travel', /\b(airport|station|trip to|flew to|travel(?:led)? to|drove to)\b/i],
];

function parsePlace(s, date) {
  const m = s.match(/\b(?:went to|go to|visited|headed to|drove to|flew to|travel(?:l)?ed to|trip to|walked to|been to|checked out|at)\s+(?:the\s+|a\s+|this\s+|my\s+)?((?:[A-Z][\w&'.-]*)(?:\s+(?:[A-Z][\w&'.-]*|of|the|&))*)/);
  let location = m?.[1] && !NAME_STOP.has(m[1].split(' ')[0]) ? m[1].replace(/[.,!?']+$/, '').replace(/\s+(?:of|the|&)$/, '') : '';
  let subtype = PLACE_SUB.find(([, re]) => re.test(s))?.[0];
  if (!location) {
    const generic = s.match(/\b(?:went to|visited|headed to|been to)\s+(?:the\s+|a\s+)?(park|beach|mall|market|temple|church|mosque|museum|library|office|cafe|restaurant|lake|zoo|cinema|theatre|theater|salon|airport|station|club)\b/i);
    if (!generic) return [];
    location = titleCase(generic[1].toLowerCase());
    subtype = subtype || 'other';
  }
  // A capitalised word after "at" might be a time ("at 7") or a person; require a place-y context for bare "at".
  if (/^at$/i.test(m?.[0]?.split(' ')[0] || '') && !subtype && !/\b(went|visited|lunch|dinner|breakfast|coffee|drinks|ate|had)\b/i.test(s)) return [];
  if (location.length < 3) return [];
  return [{ category: 'place', subtype: subtype || 'other', title: location, location, date, notes: s }];
}

// ---------- Activities ----------
const ACTS = [
  ['work', /\b(worked|working|work on|meetings?|standup|stand-up|shipped|deployed|presentation|deadline|client call|office work|sprint)\b/i],
  ['study', /\b(studied|studying|learn(?:ed|t|ing)?|course|lecture|class|revised|practice[d]? (?:dsa|leetcode)|leetcode|exam|homework|research(?:ed)?)\b/i],
  ['chores', /\b(cleaned|cleaning|laundry|washed|dishes|vacuum\w*|tidied|ironed|cooked|cooking|organi[sz]ed|fixed)\b/i],
  ['project', /\b(side project|coded|coding|built|building|wrote code|programm\w*|designed|hackathon)\b/i],
  ['hobby', /\b(painted|painting|drew|drawing|sketch\w*|guitar|piano|sang|singing|danced|dancing|gardening|photograph\w*|knit\w*|wrote|writing|journal\w*|baked|baking)\b/i],
  ['errand', /\b(errands?|bank|post office|picked up|dropped off|renewed|paid the|haircut|salon|repair)\b/i],
  ['self_care', /\b(spa|massage|skincare|nap(?:ped)?|bath|self[- ]care|rested|meditat\w*)\b/i],
];

function parseActivity(s, date) {
  const hit = ACTS.find(([, re]) => re.test(s));
  if (!hit) return [];
  if (hit[0] === 'self_care' && /meditat/i.test(s)) return []; // logged as exercise/yoga
  const durationMin = durationOf(s);
  const obj = s.match(/\b(?:worked on|working on|studied|studying|learned|learnt|learning|built|building|cleaned|fixed|coded|wrote|painted|practiced|practised|finished|organized|organised)\s+(?:the\s+|my\s+|a\s+|some\s+)?(.+)/i)?.[1];
  const base = clean(obj || '') || s.match(hit[1])[0];
  const title = titleCase(base.length > 2 ? base : hit[0]);
  return [{ category: 'activity', subtype: hit[0], title, durationMin, date, notes: s }];
}

// ---------- Notes ----------
function parseNote(s, date) {
  let m;
  if ((m = s.match(/\b(?:idea|thought)\s*[:\-–]\s*(.+)/i)) || (m = s.match(/\b(?:i had an idea|idea for)\s+(?:about\s+|to\s+)?(.+)/i)))
    return [{ category: 'note', subtype: 'idea', title: clean(m[1], { stop: false }).slice(0, 120) || 'Idea', notes: s, date }];
  if ((m = s.match(/\b(?:todo|to-do|need to|have to|must|should|remember to|don'?t forget to|gotta|plan to|planning to|tomorrow i will|will have to)\s*:?\s+(.+)/i)))
    return [{ category: 'note', subtype: 'todo', title: titleCase(clean(m[1], { stop: false })).slice(0, 120), notes: s, date }];
  if ((m = s.match(/\b(?:grateful|thankful)\s+(?:for|that)\s+(.+)/i)))
    return [{ category: 'note', subtype: 'gratitude', title: clean(m[1], { stop: false }).slice(0, 120), notes: s, date }];
  if ((m = s.match(/\b(?:my goal is|goal\s*:|i want to|i'?m going to start|resolution)\s+(?:to\s+)?(.+)/i)))
    return [{ category: 'note', subtype: 'goal', title: titleCase(clean(m[1], { stop: false })).slice(0, 120), notes: s, date }];
  return [];
}

export function parseWithRules(text, date) {
  const records = [];
  const moods = [];
  for (const raw of splitSentences(text)) {
    let d = date;
    if (/\byesterday\b/i.test(raw)) d = shiftDate(date, -1);
    else if (/\b(day before yesterday)\b/i.test(raw)) d = shiftDate(date, -2);
    const s = raw;
    const media = parseMedia(s, d);
    records.push(...parseFinance(s, d), ...media, ...parseExercise(s, d), ...parseHealth(s, d), ...parseSocial(s, d), ...parsePlace(s, d), ...parseNote(s, d));
    const food = parseFood(s, d);
    if (!media.length || food.length) records.push(...food);
    const tracked = records.some((r) => r.notes === s && ['exercise', 'media', 'food'].includes(r.category));
    if (!tracked) records.push(...parseActivity(s, d));
    const m = moodOf(s);
    if (m) moods.push(m);
  }
  let mood;
  if (moods.length) {
    const score = Math.round(moods.reduce((a, m) => a + m.score, 0) / moods.length);
    const tags = [...new Set(moods.flatMap((m) => m.tags))].slice(0, 6);
    mood = score;
    records.push({ category: 'mood', subtype: LABEL[score], title: titleCase(tags[0] || LABEL[score]), rating: score, tags, date });
  }
  // De-duplicate places that are already merchants/food locations? Keep, but drop exact duplicates.
  const seen = new Set();
  const unique = records.filter((r) => {
    const key = `${r.category}|${r.subtype}|${r.title.toLowerCase()}|${r.amount ?? ''}|${r.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const counts = unique.reduce((a, r) => ((a[r.category] = (a[r.category] || 0) + 1), a), {});
  const summary = Object.keys(counts).length
    ? `Logged ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}.`
    : 'Nothing trackable was detected in this entry.';
  return { records: unique, summary, mood };
}
