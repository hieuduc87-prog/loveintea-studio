// =============================================================
// LOVEINTEA BRAND DNA — SOURCE OF TRUTH
// All content generation, image prompts, and publishing
// must reference this file. Do NOT hardcode brand data elsewhere.
// =============================================================

export const BRAND = {
  name: 'LoveinTea',
  tagline: 'Timeless Remedies',
  websiteUrl: 'https://loveintea.com',
  archetype: 'The Joyful Healer',
  colors: {
    heritageGreen: '#1A5632',
    loveCoral:     '#E04854',
    cottonCream:   '#FFF8F0',
    deepEarth:     '#2D2D2D',
    warmStone:     '#8C8C8C',
    naturalWhite:  '#F5F5F0',
  },
  typography: {
    display: 'Sorean',
    body:    'Lato',
  },
  hashtags: ['#LoveinTea', '#TimelessRemedies', '#VietnameseHerbs'],
  voiceTraits: [
    'Warmly Wise — gentle authority of a grandmother who knows her herbs',
    'Cheerfully Simple — light, accessible, joyful; wellness feels like a treat',
    'Proudly Vietnamese — celebrate heritage naturally, never exoticize',
  ],
  complianceGate: {
    neverSay: [
      'cures', 'treats', 'heals', 'prevents disease',
      'innovative', 'disrupting', 'mysterious', 'ancient secrets',
      'exotic Eastern', 'optimize your wellness protocol',
    ],
    alwaysSay: [
      'traditionally used to support',
      'a soothing ritual for',
      'plant-based corn-fiber pyramid',
      'grown in the Vietnamese highlands',
      'all-natural, zero calories',
    ],
  },
};

export const SKUS = [
  {
    id: 'dandelion',
    name: 'Dandelion',
    productName: 'DANDELION TEA BAGS',
    theme: 'Daily reset ritual',
    color: '#F4A020',
    colorName: 'Dandelion Gold',
    ingredients: ['Dandelion', 'Ginger', 'Artichoke', 'Tangerine Peel', 'Hibiscus'],
    mascotScene: 'Vietnamese woman in nón lá seated calmly in dandelion field, soft yellow hills',
    bestMoment: 'morning',
    image: '/brand/products/Da.png',
    useCases: ['morning', 'after-meal'],
    pitch: 'Gentle daily reset; warm, earthy, golden cup',
  },
  {
    id: 'ginger',
    name: 'Ginger',
    productName: 'GINGER TEA BAGS',
    theme: 'Warm morning lift',
    color: '#A8B525',
    colorName: 'Ginger Zest',
    ingredients: ['Dried Ginger (53%)', 'Ampelopsis', 'Jujube', 'Jasmine', 'Cinnamon'],
    mascotScene: 'Vietnamese woman playing guitar by campfire with kettle, ginger plants, warm mountains',
    bestMoment: 'morning',
    image: '/brand/products/Gi.png',
    useCases: ['morning', 'wfh-desk'],
    pitch: 'Cozy warming morning ritual, spicy-sweet',
  },
  {
    id: 'hibiscus',
    name: 'Hibiscus',
    productName: 'HIBISCUS TEA BAGS',
    theme: 'Bright & refreshing',
    color: '#5B8C3E',
    colorName: 'Hibiscus Garden',
    ingredients: ['Hibiscus (25%)', 'Ginger', 'Tangerine Peel', 'Artichoke', 'Jujube'],
    mascotScene: 'Vietnamese woman dancing joyfully among large hibiscus blooms, magenta and green',
    bestMoment: 'afternoon',
    image: '/brand/products/Hi.png',
    useCases: ['afternoon', 'cold-brew', 'self-care'],
    pitch: 'Bright ruby cup, vibrant and uplifting',
  },
  {
    id: 'lemon-balm',
    name: 'Lemon Balm',
    productName: 'LEMON BALM TEA BAGS',
    theme: 'Calm & unwind',
    color: '#8BBF5C',
    colorName: 'Lemon Mist',
    ingredients: ['Perilla', 'Ginger', 'Fennel', 'Lemon Balm', 'Jiaogulan', 'Peppermint'],
    mascotScene: 'Vietnamese woman riding whimsical leafy roller-coaster cart, soft green gradient',
    bestMoment: 'evening',
    image: '/brand/products/Le.png',
    useCases: ['evening', 'self-care', 'journaling'],
    pitch: 'Unwind, light-hearted calm moment',
  },
  {
    id: 'peppermint',
    name: 'Peppermint',
    productName: 'PEPPERMINT TEA BAGS',
    theme: 'Cool & after-meal ease',
    color: '#5BBCD2',
    colorName: 'Peppermint Wave',
    ingredients: ['Peppermint (40%)', 'Artichoke', 'Ampelopsis', 'Perilla', 'Reishi'],
    mascotScene: 'Vietnamese woman in magenta swimsuit surfing a wave holding teacup, turquoise ocean',
    bestMoment: 'afternoon',
    image: '/brand/products/Pe.png',
    useCases: ['after-meal', 'afternoon', 'wfh-desk'],
    pitch: 'Cool, fresh after-meal ritual',
  },
  {
    id: 'nighty-night',
    name: 'Nighty Night',
    productName: 'NIGHTY NIGHT TEA BAGS',
    theme: 'Wind-down before sleep',
    color: '#3F3D99',
    colorName: 'Dreamy Indigo',
    ingredients: ['Perilla', 'Chamomile', 'Lotus Leaf', 'Jujube', 'Lemon Balm', 'Jiaogulan'],
    mascotScene: 'Vietnamese woman in rust robe reclining on crescent moon, starry midnight sky',
    bestMoment: 'evening',
    image: '/brand/products/Ni.png',
    useCases: ['bedside', 'sofa', 'journaling'],
    pitch: 'Evening wind-down ritual, restful and quiet',
  },
] as const;

export type SkuId = typeof SKUS[number]['id'];

export const SEGMENTS = [
  { id: 'S1', name: 'Wind-Down Seeker', age: '28-45', tension: "Can't switch off at night", leadSkus: ['nighty-night', 'lemon-balm'] },
  { id: 'S2', name: 'Clean-Wellness Researcher', age: '30-45', tension: 'Most wellness products are hype + additives', leadSkus: ['dandelion'] },
  { id: 'S3', name: 'Gentle-Energy Switcher', age: '27-40', tension: 'Coffee wrecks me but I need a ritual', leadSkus: ['ginger', 'peppermint'] },
  { id: 'S4', name: 'Heritage-Curious Explorer', age: '28-45', tension: 'I want something real, with a story', leadSkus: ['hibiscus'] },
  { id: 'S5', name: 'Digestion-Conscious', age: '30-50', tension: 'Feel heavy/bloated after meals', leadSkus: ['peppermint', 'dandelion'] },
] as const;

export const RTBS = [
  { id: 'R7xM2', label: 'End your day calmer, the natural way', bestSeg: 'S1' },
  { id: 'R4xM5', label: 'A small daily moment that\'s just yours', bestSeg: 'S1' },
  { id: 'R7xM9', label: 'Real herbs, no microplastics — wellness you can trust', bestSeg: 'S2' },
  { id: 'R1xM8', label: "Vietnam's timeless remedies, kept honest", bestSeg: 'S4' },
  { id: 'R2xM4', label: 'One pyramid bag. Steep, sip, done.', bestSeg: 'S3' },
  { id: 'R7xM3', label: 'A gentle after-meal ritual that settles you', bestSeg: 'S5' },
  { id: 'R6xM2', label: 'Bright, antioxidant-rich botanicals for your daily glow', bestSeg: 'S4' },
] as const;

export const USP_ANCHORS = [
  { id: 'Ubag',    label: 'Pyramid bag (no microplastics)', imageRule: 'Pyramid bag in frame (in glass or held), white LoveinTea tag visible', caption: 'plant-based corn-fiber pyramid mesh, no microplastics' },
  { id: 'Uwhole', label: 'Whole herbs visible', imageRule: 'Whole leaves/buds visible through translucent mesh', caption: 'you can see the whole herbs inside — nothing ground, nothing hidden' },
  { id: 'Uorigin', label: 'Vietnamese origin', imageRule: 'Highland/farm atmosphere, herbs, nón lá', caption: 'grown in the Vietnamese highlands, trusted for generations' },
  { id: 'Ublend',  label: 'Easy-drinking family blend', imageRule: 'Clear golden brew in glass, satisfied sip', caption: 'blended by a family recipe so it\'s gentle and easy to drink' },
  { id: 'Uclean',  label: 'All-natural, zero-calorie', imageRule: 'Clean minimal styling, fresh ingredients', caption: 'all-natural, zero calories, nothing artificial' },
  { id: 'Uritual', label: 'Caffeine-free daily ritual', imageRule: 'Hands + cup + cozy US scene, correct time-of-day light', caption: 'a caffeine-free moment of calm, any time of day' },
] as const;

export const NARRATIVES = [
  { id: 'N-HR',    label: 'Hook-Reveal', hook: "What's actually inside your tea bag?" },
  { id: 'N-POV',   label: 'POV', hook: 'POV: the 10 minutes that are finally yours' },
  { id: 'N-BA',    label: 'Before-After', hook: 'From restless to calm' },
  { id: 'N-Story', label: 'Storytelling', hook: "Grandmother's kitchen → your cup" },
  { id: 'N-Test',  label: 'Testimonial Cut', hook: 'What she said after her first sip' },
  { id: 'N-How',   label: 'Tutorial/How-To', hook: 'Your 3-step evening ritual' },
  { id: 'N-Comp',  label: 'Comparison', hook: 'Whole herbs vs dusty flat bag' },
  { id: 'N-List',  label: 'Listicle', hook: '3 herbs your body loves' },
] as const;

export const CONTEXTS = [
  { id: 'C-EveSofa',   label: 'Evening sofa/bed',     light: 'Dim warm lamp, candle glow', skus: ['nighty-night', 'lemon-balm'] },
  { id: 'C-Read',      label: 'Reading in armchair',  light: 'Warm side lamp or soft window', skus: ['all'] },
  { id: 'C-MornWin',   label: 'Morning by window',    light: 'Crisp morning rays, light dust', skus: ['ginger', 'dandelion'] },
  { id: 'C-Bedside',   label: 'Bedside/nightstand',   light: 'Low candle/lamp glow', skus: ['nighty-night'] },
  { id: 'C-Desk',      label: 'WFH desk break',       light: 'Soft daylight', skus: ['peppermint', 'ginger'] },
  { id: 'C-AfterMeal', label: 'After-meal moment',    light: 'Warm kitchen light', skus: ['peppermint', 'dandelion'] },
  { id: 'C-Bath',      label: 'Self-care bath/spa',   light: 'Warm diffused, steamy', skus: ['lemon-balm', 'hibiscus'] },
  { id: 'C-Journal',   label: 'Journaling corner',    light: 'Soft warm low', skus: ['lemon-balm', 'nighty-night'] },
  { id: 'C-Kitchen',   label: 'Cozy kitchen brewing', light: 'Bright airy daylight', skus: ['ginger', 'hibiscus'] },
  { id: 'C-Iced',      label: 'Cold-brew iced',       light: 'Clean bright daylight', skus: ['hibiscus', 'peppermint'] },
] as const;

export const FORMATS = [
  { id: 'E-Still-L', label: 'Static lifestyle photo', size: '1080×1350 (4:5)', forFeed: true },
  { id: 'E-Still-P', label: 'Static product/macro',   size: '1080×1350 (4:5)', forFeed: true },
  { id: 'E-Carou',   label: 'Carousel (5-7 slides)',  size: '1080×1080 (1:1)', forFeed: true },
  { id: 'E-Reel',    label: 'Reels/Stories',           size: '1080×1920 (9:16)', forFeed: false },
  { id: 'E-UGC',     label: 'UGC creator video',       size: '1080×1920 (9:16)', forFeed: false },
] as const;

export const CTA_OPTIONS = [
  'Save this for tonight 💜',
  "What's your wind-down ritual? 👇",
  'Tag someone who needs a calmer evening',
  'Tap the link to bring one home',
  'Find your blend — link in bio',
  'Show us your LoveinTea moment with #TimelessRemedies',
] as const;
