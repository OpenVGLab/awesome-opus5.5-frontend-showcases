export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Named members whose know-how shows up in the hero's "you now know…" notifications.
export const BORROWS = [
  { name: 'Ines Duarte', role: 'Housekeeping manager', city: 'Porto', skill: 'how to fold a fitted sheet', lend: ['Fitted sheets', 'Stain removal', 'Portuguese'], day: 'Tuesday' },
  { name: 'Marisol Reyes', role: 'ICU nurse', city: 'Quezon City', skill: '“salamat po” — thank you, in Tagalog', lend: ['Tagalog', 'Night shifts', 'Staying calm'], day: 'Thursday' },
  { name: 'Jonas Berg', role: 'Baker', city: 'Malmö', skill: 'why your sourdough came out flat', lend: ['Sourdough', 'Swedish', '4 a.m. starts'], day: 'Wednesday' },
  { name: 'Adaeze Nwosu', role: 'Venture associate', city: 'Lagos', skill: 'how to read a term sheet', lend: ['Term sheets', 'Pitch decks', 'Igbo'], day: 'Thursday' },
  { name: 'Theo Marchetti', role: 'Jazz pianist', city: 'Turin', skill: 'the chord changes to “Autumn Leaves”', lend: ['Jazz voicings', 'Sight-reading', 'Stage nerves'], day: 'Monday' },
  { name: 'Pieter de Vries', role: 'Bike courier', city: 'Utrecht', skill: 'how to get a bike chain back on', lend: ['Bike repair', 'Dutch', 'Shortcuts'], day: 'Friday' },
  { name: 'Priya Raman', role: 'Financial analyst', city: 'Bengaluru', skill: 'what XLOOKUP actually does', lend: ['Excel', 'Forecasting', 'Tamil'], day: 'Thursday' },
  { name: 'Mateo Silva', role: 'Sailing instructor', city: 'Valparaíso', skill: 'how to tie a bowline', lend: ['Knots', 'Reading weather', 'Spanish'], day: 'Saturday' },
  { name: 'Hanna Virtanen', role: 'Forager', city: 'Tampere', skill: 'which mushrooms to leave alone', lend: ['Mushrooms', 'Finnish', 'Saunas'], day: 'Wednesday' },
  { name: 'Rachel Stein', role: 'Labor lawyer', city: 'Chicago', skill: 'how to ask for a raise', lend: ['Negotiation', 'Contracts', 'Latin phrases'], day: 'Thursday' },
  { name: 'Kofi Mensah', role: 'Driving instructor', city: 'Accra', skill: 'parallel parking, first try', lend: ['Parking', 'Twi', 'Patience'], day: 'Tuesday' },
  { name: 'Aiko Nishimura', role: 'Translator', city: 'Osaka', skill: 'when to say “sumimasen”', lend: ['Japanese', 'Etiquette', 'Idioms'], day: 'Thursday' },
];

const FIRST = ['Amara', 'Tomás', 'Aiko', 'Ravi', 'Lena', 'Kofi', 'Ines', 'Jonas', 'Priya', 'Mateo', 'Hanna', 'Yusuf', 'Mei', 'Olu', 'Sofia', 'Arjun', 'Freya', 'Diego', 'Nia', 'Kenji', 'Zara', 'Emeka', 'Chloé', 'Lars', 'Fatima', 'Hugo', 'Leilani', 'Omar', 'Ana', 'Sven', 'Thandi', 'Luca', 'Ayesha', 'Kai', 'Mira', 'Rafael', 'Ingrid', 'Tariq', 'Yara', 'Bao', 'Elif', 'Nikolai', 'Paloma', 'Sione', 'Wanjiru', 'Joaquín', 'Saoirse', 'Dmitri', 'Imani', 'Haruto', 'Grace', 'Noor', 'Mateus', 'Rosa'];
const LAST = ['Okafor', 'Reyes', 'Nishimura', 'Menon', 'Vogel', 'Mensah', 'Duarte', 'Berg', 'Raman', 'Silva', 'Virtanen', 'Demir', 'Chen', 'Adeyemi', 'Rossi', 'Patel', 'Larsen', 'Moreno', 'Njoroge', 'Tanaka', 'Khan', 'Eze', 'Laurent', 'Holm', 'Haddad', 'Girard', 'Kahale', 'Farouk', 'Costa', 'Lindqvist', 'Dlamini', 'Bianchi', 'Siddiqui', 'Nakoa', 'Novak', 'Almeida', 'Johansson', 'Aziz', 'Nguyen', 'Yilmaz', 'Petrov', 'Ortega', 'Tuilagi', 'Kamau', 'Herrera', 'Byrne', 'Volkov', 'Mwangi', 'Sato', 'Kim', 'Obi', 'Ferreira'];
const CITIES = ['Lisbon', 'Lagos', 'Osaka', 'Kochi', 'Berlin', 'Accra', 'Porto', 'Malmö', 'Bengaluru', 'Valparaíso', 'Tampere', 'Istanbul', 'Taipei', 'Ibadan', 'Turin', 'Ahmedabad', 'Aarhus', 'Bogotá', 'Nairobi', 'Sapporo', 'Lahore', 'Enugu', 'Montréal', 'Bergen', 'Beirut', 'Lyon', 'Honolulu', 'Cairo', 'Recife', 'Uppsala', 'Durban', 'Bologna', 'Karachi', 'Auckland', 'Prague', 'Salvador', 'Gothenburg', 'Casablanca', 'Hanoi', 'Izmir', 'Tbilisi', 'Oaxaca', 'Apia', 'Mombasa', 'Medellín', 'Galway', 'Almaty', 'Kigali', 'Kyoto', 'Reykjavík', 'Glasgow', 'Seoul'];

export const PROFESSIONS = [
  ['Pediatric nurse', ['Calming toddlers', 'Triage', 'Night shifts']],
  ['Structural engineer', ['Load paths', 'Bridges', 'AutoCAD']],
  ['Tax accountant', ['Deductions', 'Spreadsheets', 'Surviving April']],
  ['Pastry chef', ['Laminated dough', 'Tempering', 'Piping']],
  ['Marine biologist', ['Coral ID', 'Scuba', 'Grant writing']],
  ['Airline pilot', ['Crosswinds', 'Jet lag', 'The calm voice']],
  ['Beekeeper', ['Swarms', 'Honey', 'Not panicking']],
  ['Software engineer', ['Rust', 'Debugging', 'Estimates (bad)']],
  ['Midwife', ['Breathing', 'Patience', '3 a.m. calm']],
  ['Architect', ['Daylight', 'Sketching', 'Chairs']],
  ['Electrician', ['Wiring', 'Fuse boxes', 'Not getting shocked']],
  ['Sommelier', ['Pairings', 'Tasting notes', 'Sounding sure']],
  ['Data scientist', ['Statistics', 'Python', '“It depends”']],
  ['Plumber', ['Leaks', 'Boilers', 'Crawl spaces']],
  ['Kindergarten teacher', ['Storytime', 'Glitter control', 'Infinite patience']],
  ['Carpenter', ['Joinery', 'Measuring twice', 'Sanding']],
  ['Diplomat', ['Tact', 'French', 'Small talk']],
  ['Surgeon', ['Anatomy', 'Steady hands', 'Long days']],
  ['Farmer', ['Soil', 'Reading weather', 'Tractors']],
  ['Stand-up comic', ['Timing', 'Hecklers', 'Rejection']],
  ['Astrophysicist', ['Orbits', 'Telescopes', 'Big numbers']],
  ['Barista', ['Latte art', 'Grind size', 'Remembering names']],
  ['Mountain guide', ['Knots', 'Avalanche safety', 'Route finding']],
  ['Florist', ['Bouquets', 'Seasonal stems', 'Wedding stress']],
  ['Mechanic', ['Engines', 'Brakes', 'Weird noises']],
  ['Librarian', ['Research', 'Cataloguing', 'Finding anything']],
  ['Firefighter', ['First aid', 'Ladders', 'Staying calm']],
  ['Therapist', ['Listening', 'Boundaries', 'Reframing']],
  ['Game designer', ['Level design', 'Playtesting', 'Fun']],
  ['Photographer', ['Lighting', 'Composition', 'Golden hour']],
  ['Veterinarian', ['Cats', 'Dogs', 'Stitches']],
  ['Economist', ['Models', 'Forecasts', 'Hedging']],
  ['Urban planner', ['Zoning', 'Bike lanes', 'Public meetings']],
  ['Radio host', ['Voice', 'Dead air', 'Interviews']],
];

const DAY_WEIGHTS = [1, 1.3, 1.6, 3, 1.2, 0.5, 0.3];

export function randomPersona(r) {
  const name = `${FIRST[(r() * FIRST.length) | 0]} ${LAST[(r() * LAST.length) | 0]}`;
  const [role, lend] = PROFESSIONS[(r() * PROFESSIONS.length) | 0];
  const city = CITIES[(r() * CITIES.length) | 0];
  let t = r() * DAY_WEIGHTS.reduce((a, b) => a + b, 0);
  let d = 0;
  while ((t -= DAY_WEIGHTS[d]) > 0 && d < 6) d++;
  return { name, role, city, lend, day: DAYS[d] };
}

// ---------- "Wonder something" demo ----------
const A = (name, role, city, conf, text) => ({ name, role, city, conf, text });

export const PRESETS = [
  {
    q: 'How do I fold a fitted sheet?',
    answers: [
      A('Ines Duarte', 'Housekeeping manager', 'Porto', 98, 'Inside out, hands in two corners. Tuck one corner into the other, repeat on the other side, then lay it flat and fold it into a rectangle. You’ll feel it click.'),
      A('Mei Chen', 'Laundromat owner', 'Taipei', 91, 'Aim for square-ish, not perfect. Nobody has ever audited a linen closet.'),
      A('Walter Brandt', 'Retired postman', 'Hamburg', 64, 'I balled mine up for forty years. I use Ines’s method now, like everybody else.'),
    ],
  },
  {
    q: 'How do I negotiate a raise?',
    answers: [
      A('Rachel Stein', 'Labor lawyer', 'Chicago', 97, 'Name a number a little above what you want, then stop talking. The silence will feel awful. Let it.'),
      A('Kenji Sato', 'Hiring manager', 'Sapporo', 93, 'Bring one page of wins with numbers attached. Your manager needs ammunition to argue for you upstairs.'),
      A('Amara Okafor', 'HR director', 'Lagos', 95, 'Ask a month before budgets are set, not after. Timing is half the raise.'),
    ],
  },
  {
    q: 'Say “thank you” in Japanese',
    answers: [
      A('Aiko Nishimura', 'Translator', 'Osaka', 99, '“Arigatō gozaimasu” for anyone you’d bow to, “arigatō” for friends, and a quick “dōmo” for the barista.'),
      A('Haruto Tanaka', 'Hotel concierge', 'Kyoto', 94, 'Add a small nod. The nod does half the work.'),
      A('Sofia Rossi', 'Exchange student', 'Bologna', 72, 'Tested on three hundred shopkeepers: say it slowly and smile. You get a bigger smile back.'),
    ],
  },
  {
    q: 'Why is my sourdough flat?',
    answers: [
      A('Jonas Berg', 'Baker', 'Malmö', 96, 'Your starter isn’t peaking. Feed it, wait until it doubles and domes, and bake then — not four hours later.'),
      A('Chloé Laurent', 'Pastry chef', 'Lyon', 92, 'Shape tighter. Drag the dough towards you on a bare counter until the surface feels like a drum.'),
      A('Omar Farouk', 'Food scientist', 'Cairo', 88, 'Check your kitchen. At 19 °C everything takes twice as long as the recipe claims.'),
    ],
  },
  {
    q: 'Is now a good time to buy a flat?',
    answers: [
      A('Thandi Dlamini', 'Economist', 'Durban', 81, '“It depends” is my whole profession in two words. More useful: if you can stay put for five years, timing matters much less.'),
      A('Lena Vogel', 'Mortgage broker', 'Berlin', 92, 'Get pre-approved before you fall in love with a kitchen.'),
      A('Diego Moreno', 'Estate agent', 'Bogotá', 88, 'Visit at night and on a rainy day. Every home looks lovely on a sunny Sunday.'),
    ],
  },
  {
    q: 'How do I get a toddler to sleep?',
    answers: [
      A('Wanjiru Kamau', 'Pediatric nurse', 'Nairobi', 93, 'Same three steps every night — bath, book, bed — and make the room as boring as humanly possible.'),
      A('Mira Novak', 'Sleep researcher', 'Prague', 90, 'Consistency beats cleverness. The same bedtime, weekends included, does more than any gadget.'),
      A('Lars Holm', 'Father of four', 'Bergen', 77, 'White noise, blackout curtains, lowered expectations.'),
    ],
  },
];

export const CATEGORIES = [
  {
    keys: ['raise', 'salary', 'negotiat', 'boss', 'promotion', 'job', 'interview', 'career', 'manager', 'resign', 'quit', 'work'],
    answers: PRESETS[1].answers,
  },
  {
    keys: ['japanese', 'thank', 'translate', 'language', 'spanish', 'french', 'german', 'chinese', 'mandarin', 'portuguese', 'word for', 'phrase', 'speak', 'pronounce', 'say '],
    answers: [
      A('Aiko Nishimura', 'Translator', 'Osaka', 94, 'Learn “please”, “thank you” and “sorry” first. People forgive terrible grammar from anyone who’s polite.'),
      A('Luca Bianchi', 'Interpreter', 'Bologna', 90, 'Copy the melody before the words. A good accent with a small vocabulary beats the reverse.'),
      A('Noor Siddiqui', 'Language teacher', 'Lahore', 87, 'Ten minutes a day beats two hours on Sunday. You’re training a habit, not cramming a fact.'),
    ],
  },
  {
    keys: ['sourdough', 'bread', 'bake', 'baking', 'cook', 'recipe', 'dough', 'cake', 'pasta', 'food', 'dinner', 'lunch', 'breakfast', 'coffee', 'espresso', 'rice', 'soup', 'egg', 'steak', 'jollof', 'curry'],
    answers: [
      A('Chloé Laurent', 'Pastry chef', 'Lyon', 91, 'Read the whole recipe before you start. Then read it again. Every kitchen disaster I’ve seen began on step four.'),
      A('Ravi Menon', 'Restaurant owner', 'Kochi', 89, 'Hot pan first, then the oil, then the food. Patience is an ingredient; it just isn’t listed.'),
      A('Omar Farouk', 'Food scientist', 'Cairo', 85, 'Salt earlier than you think, taste more often than you think, and trust your nose over the timer.'),
    ],
  },
  {
    keys: ['doctor', 'pain', 'sick', 'mole', 'headache', 'fever', 'hurt', 'health', 'cough', 'rash', 'injur', 'medic', 'ache', 'allerg'],
    note: 'Borrowed memories are not medical advice. The hive will, however, nag you until you see an actual doctor.',
    answers: [
      A('Deborah Okafor', 'Pediatrician', 'Lagos', 91, 'A borrowed memory isn’t a diagnosis. Book the appointment — and write your questions down first. Doctors love a list.'),
      A('Samuel Adeyemi', 'GP', 'Ibadan', 89, 'If it’s new, changing, or keeping you up at night, get it looked at this week. Not “someday”.'),
      A('Ingrid Johansson', 'Pharmacist', 'Uppsala', 86, 'Ask your pharmacist. We’re free, we’re fast, and we’re mostly just waiting for someone to ask.'),
    ],
  },
  {
    keys: ['code', 'coding', 'bug', 'python', 'javascript', 'program', 'computer', 'wifi', 'wi-fi', 'laptop', 'software', 'excel', 'error', 'crash', 'password', 'phone', 'app'],
    answers: [
      A('Freya Larsen', 'Senior engineer', 'Aarhus', 94, 'Read the error message. The whole thing. Out loud, if necessary — it usually tells you exactly what’s wrong.'),
      A('Yusuf Demir', 'Site reliability engineer', 'Istanbul', 90, 'Turn it off and on again. I’m not joking; I carry a pager.'),
      A('Priya Raman', 'Financial analyst', 'Bengaluru', 83, 'Before you fix it, write down what “fixed” looks like. Half of debugging is knowing when to stop.'),
    ],
  },
  {
    keys: ['love', 'date', 'dating', 'relationship', 'partner', 'breakup', 'break up', 'marry', 'marriage', 'crush', 'wedding', 'boyfriend', 'girlfriend', 'husband', 'wife', 'friend'],
    answers: [
      A('Nia Mwangi', 'Couples therapist', 'Nairobi', 93, 'Say the thing you’re afraid to say, kindly and early. Most breakups are just unspoken sentences.'),
      A('Paloma Ortega', 'Wedding planner', 'Oaxaca', 84, 'Watch how they treat a waiter who got the order wrong. That’s the whole review.'),
      A('Walter Brandt', 'Retired postman', 'Hamburg', 79, 'Married forty-four years. The secret is two duvets.'),
    ],
  },
  {
    keys: ['house', 'rent', 'mortgage', 'buy', 'home', 'apartment', 'flat', 'money', 'save', 'saving', 'invest', 'budget', 'tax', 'debt', 'loan', 'pension'],
    answers: PRESETS[4].answers,
  },
  {
    keys: ['plant', 'garden', 'tree', 'flower', 'grow', 'soil', 'basil', 'succulent', 'orchid', 'tomato', 'lawn'],
    answers: [
      A('Hugo Girard', 'Gardener', 'Bordeaux', 92, 'You’re overwatering it. Everyone is overwatering it.'),
      A('Leilani Kahale', 'Botanist', 'Honolulu', 90, 'Push a finger two knuckles into the soil. Dry? Water. Damp? Walk away.'),
      A('Bao Nguyen', 'Farmer', 'Hanoi', 84, 'Talk to it if you like. Mostly it wants light.'),
    ],
  },
  {
    keys: ['travel', 'trip', 'flight', 'visa', 'pack', 'jet lag', 'vacation', 'holiday', 'hotel', 'airport', 'passport'],
    answers: [
      A('Ana Costa', 'Flight attendant', 'Lisbon', 93, 'Roll your clothes, keep one outfit in your carry-on, and drink water like it’s your job.'),
      A('Haruto Tanaka', 'Hotel concierge', 'Kyoto', 90, 'Ask the concierge where they eat on their day off. Never where the tourists eat.'),
      A('Tariq Aziz', 'Airline pilot', 'Karachi', 88, 'For jet lag, get daylight at your destination’s morning. Your body will argue for two days, then give up.'),
    ],
  },
  {
    keys: ['baby', 'toddler', 'kid', 'child', 'sleep', 'parent', 'teen', 'son', 'daughter', 'school', 'homework'],
    answers: PRESETS[5].answers,
  },
  {
    keys: ['car', 'bike', 'bicycle', 'engine', 'tire', 'tyre', 'fix', 'repair', 'leak', 'sink', 'tap', 'faucet', 'drive', 'toilet', 'shelf', 'drill', 'paint'],
    answers: [
      A('Emeka Eze', 'Mechanic', 'Enugu', 91, 'If it makes a new noise, it’s telling you something. Record it and play it to a mechanic — we love a voice memo.'),
      A('Sven Lindqvist', 'Plumber', 'Gothenburg', 89, 'Turn the water off at the valve before you touch anything. Then you’re allowed to panic.'),
      A('Pieter de Vries', 'Bike courier', 'Utrecht', 86, 'Take a photo before you take anything apart. Future you will not remember which way the spring went.'),
    ],
  },
];

export const GENERIC = [
  A('Walter Brandt', 'Retired postman', 'Hamburg', 58, 'I don’t know this one, but I delivered letters to someone who did. Asking him now.'),
  A('Zara Khan', 'Librarian', 'Lahore', 88, 'Start with the dullest reliable source you can find. Exciting sources are usually exciting because they’re wrong.'),
  A('Kenji Sato', 'Hiring manager', 'Sapporo', 76, 'Ask someone who’s done it twice, not once. The first time is luck; the second time is knowledge.'),
  A('Imani Njoroge', 'Kindergarten teacher', 'Mombasa', 81, 'Break it into steps small enough that a five-year-old would say “that’s easy”. Then do the first one.'),
  A('Elif Yilmaz', 'Philosophy lecturer', 'Izmir', 67, 'Before answering, ask why you want to know. The answer changes more often than you’d think.'),
  A('Gary Whitlock', 'Lighthouse keeper', 'Nova Scotia', 52, 'Honestly, I mostly keep the light on. But I believe in you.'),
  A('Rosa Ferreira', 'Retired nurse', 'Recife', 83, 'Sleep on it. Nine problems in ten look smaller at breakfast.'),
  A('Arjun Patel', 'Management consultant', 'Ahmedabad', 71, 'Draw it on a napkin first. If it doesn’t fit on a napkin, you don’t understand it yet — and neither do I.'),
];

// ---------- week ----------
export const OBJECTIVES = [
  { t: 'Map every hiking trail in the Andes', p: 72, meta: '318k minds · passed with 81%' },
  { t: 'Teach 40,000 kids to read', p: 58, meta: '402k minds · passed with 94%' },
  { t: 'Restore 300 km² of coral reef', p: 34, meta: '141k minds · passed with 88%' },
  { t: 'Proofread the world’s appliance manuals', p: 91, meta: '77k minds · passed with 63%' },
  { t: 'Find a kinder phrase than “per my last email”', p: 12, meta: '1.2M minds · passed with 99%' },
  { t: 'Cure the common Monday', p: 3, meta: '2.4M minds · passed unanimously' },
];

// ---------- network ----------
export const TILES = [
  ['Software engineers', 214880, 'tech'], ['Nurses', 131402, 'care'], ['Teachers', 128955, 'care'], ['Doctors', 88317, 'care'],
  ['Accountants', 73518, 'money'], ['Lawyers', 61209, 'money'], ['Researchers', 58012, 'science'], ['Chefs', 52870, 'trades'],
  ['Data scientists', 47221, 'tech'], ['Electricians', 44106, 'trades'], ['Musicians', 33015, 'arts'], ['Writers', 27480, 'arts'],
  ['Marine biologists', 3904, 'science'], ['Ice-cream tasters', 14, 'rare'], ['Astronauts', 3, 'rare'], ['Lighthouse keepers', 1, 'rare', 'Hi, Gary'],
];

export const FIELDS = [['all', 'All'], ['care', 'Care'], ['tech', 'Tech'], ['money', 'Money & law'], ['trades', 'Trades'], ['arts', 'Arts'], ['science', 'Science'], ['rare', 'Rare finds']];

export const OPPORTUNITIES = [
  { t: 'Bilingual pediatric nurse (PT/EN)', where: 'Lisbon', n: 14, by: 'Ana Costa' },
  { t: 'CFO for a Series A solar start-up', where: 'Nairobi', n: 31, by: 'Wanjiru Kamau' },
  { t: 'Cellist for a Saturday wedding', where: 'Kyoto', n: 6, by: 'Haruto Tanaka', you: true },
  { t: 'Grant: urban beekeeping pilot', where: 'Toronto', n: 118, by: 'Grace Kim' },
  { t: 'Technical co-founder, ed-tech', where: 'São Paulo', n: 22, by: 'Mateus Almeida' },
  { t: 'Carpenter for a 1920s boat restoration', where: 'Bergen', n: 4, by: 'Lars Holm' },
  { t: 'Someone who can fix a 1974 Moog synth', where: 'Detroit', n: 2, by: 'Theo Marchetti', you: true },
  { t: 'Spare room for a visiting researcher', where: 'Cape Town', n: 9, by: 'Thandi Dlamini' },
  { t: 'Voice actor with a Welsh accent', where: 'Cardiff', n: 12, by: 'Saoirse Byrne' },
  { t: 'Night-shift pharmacist, 3 months', where: 'Glasgow', n: 7, by: 'Ingrid Johansson' },
  { t: 'Board seat, community credit union', where: 'Manila', n: 19, by: 'Marisol Reyes', you: true },
  { t: 'Maths tutor, two hours a week', where: 'Leeds', n: 57, by: 'Imani Njoroge' },
];
