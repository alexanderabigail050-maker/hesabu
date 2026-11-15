/** Hand-authored sample lesson. Nothing in this file is a live AI response or a learner's past activity. */
export const DEMO_TOPIC = 'Photosynthesis';
export const DEMO_NOTE = {
  id: 'sample-photosynthesis-note', title: 'Photosynthesis · sample notes', createdAt: 0, demo: true, warnings: [],
  content: `PHOTOSYNTHESIS — SAMPLE STUDY NOTES

Photosynthesis converts light energy into chemical energy stored in organic molecules. In plants it happens in chloroplasts.

An overall simplified equation is:
6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ + 6 O₂

The light-dependent reactions occur in the thylakoid membranes. Chlorophyll absorbs light. Water is split, providing electrons and releasing oxygen. The reactions produce ATP and NADPH. Oxygen released in photosynthesis comes from water, not carbon dioxide.

The Calvin cycle occurs in the stroma, the fluid around the thylakoids. It uses carbon dioxide, ATP, and NADPH to produce G3P, a three-carbon molecule. Some G3P can be used to build sugars. The remaining molecules help regenerate the carbon-accepting molecule, RuBP. Rubisco catalyses carbon fixation.

The Calvin cycle does not use light directly, but it depends on ATP and NADPH from the light-dependent reactions. Calling it a dark reaction does not mean it normally occurs only at night.

Carbon atoms in newly made carbohydrates come from carbon dioxide. Oxygen atoms in the released oxygen gas come from water.

Light intensity, carbon dioxide concentration, and temperature can limit the rate of photosynthesis. If the rate stops increasing when light intensity rises, another factor may be limiting. Increasing light alone does not always increase the rate.

A useful memory cue: thylakoids capture energy; the stroma uses that energy to fix carbon.

This small sample demonstrates Hesabu's study tools. It is not an uploaded course document.`,
};

export const DEMO_RESPONSE = `## Photosynthesis, made clear

Think of a chloroplast as a tiny solar-powered kitchen. It captures energy first, then uses that energy to build carbon-containing molecules.

### 1. Capture the energy
In the **thylakoid membranes**, chlorophyll absorbs light. Water is split, **oxygen is released**, and the plant makes **ATP and NADPH** to carry energy into the next stage.

### 2. Build with carbon
In the **stroma**, the Calvin cycle uses carbon dioxide together with ATP and NADPH to make **G3P**, a small molecule the plant can use to build sugars.

### The distinction to remember
- The carbon in a plant's new carbohydrates comes from **carbon dioxide**.
- The oxygen gas the plant releases comes from **water**.
- The Calvin cycle does not use light directly, but it depends on the first stage's products.

**Memory cue:** thylakoids capture energy; the stroma uses it to fix carbon.

### Check your understanding
If a plant has plenty of light but very little carbon dioxide, why might its photosynthesis slow down?

[Source: Photosynthesis · sample notes]`;

export const DEMO_QUIZ = {
  kind: 'quiz', title: 'Photosynthesis · sample practice',
  questions: [
    { id: 'sample-q1', question: 'A scientist labels the oxygen atoms in water supplied to a plant. Where can the label appear during photosynthesis?', options: ['In the oxygen gas released', 'Only in the carbon dioxide absorbed', 'Only in chlorophyll', 'Nowhere, because water is not used'], answerIndex: 0, explanation: 'The oxygen released during photosynthesis comes from splitting water in the light-dependent reactions.', topic: 'Oxygen source', source: DEMO_NOTE.title },
    { id: 'sample-q2', question: 'Where do the light-dependent reactions take place in a plant chloroplast?', options: ['The nucleus', 'The stroma', 'The thylakoid membranes', 'The outer cell wall'], answerIndex: 2, explanation: 'Chlorophyll and the light-dependent electron transport machinery are associated with the thylakoid membranes.', topic: 'Chloroplast structure', source: DEMO_NOTE.title },
    { id: 'sample-q3', question: 'Which pair supplies energy and reducing power to the Calvin cycle?', options: ['Oxygen and glucose', 'ATP and NADPH', 'Carbon dioxide and oxygen', 'Water and chlorophyll'], answerIndex: 1, explanation: 'ATP supplies energy and NADPH supplies reducing power. Both are produced by the light-dependent reactions.', topic: 'Calvin cycle', source: DEMO_NOTE.title },
    { id: 'sample-q4', question: 'A plant is given more light, but its photosynthesis rate no longer rises. What is the most reasonable explanation?', options: ['Plants stop using light at high rates', 'The Calvin cycle has moved into the thylakoid', 'Water is now converted directly into glucose', 'Another factor, such as carbon dioxide, is limiting'], answerIndex: 3, explanation: 'Once light is no longer the limiting factor, another factor such as carbon dioxide concentration or temperature may limit the rate.', topic: 'Limiting factors', source: DEMO_NOTE.title },
    { id: 'sample-q5', question: 'Why is calling the Calvin cycle a dark reaction potentially misleading?', options: ['It occurs only in the dark', 'It produces light', 'It does not use light directly, but depends on products of light-dependent reactions', 'It does not use carbon dioxide'], answerIndex: 2, explanation: 'The Calvin cycle uses ATP and NADPH from the light-dependent reactions. Light-independent does not mean that it occurs only at night.', topic: 'Calvin cycle', source: DEMO_NOTE.title },
  ],
};

export const DEMO_FLASHCARDS = {
  kind: 'flashcards', title: 'Photosynthesis · sample review',
  cards: [
    { front: 'What is the central purpose of photosynthesis?', back: 'To convert light energy into chemical energy stored in organic molecules.', topic: 'Big picture' },
    { front: 'Where do light-dependent reactions occur?', back: 'In the thylakoid membranes of chloroplasts.', topic: 'Chloroplast structure' },
    { front: 'Where does the Calvin cycle occur?', back: 'In the stroma of the chloroplast.', topic: 'Chloroplast structure' },
    { front: 'Where does the oxygen released by photosynthesis come from?', back: 'From water split during the light-dependent reactions.', topic: 'Oxygen source' },
    { front: 'Which molecules connect the light-dependent reactions to the Calvin cycle?', back: 'ATP and NADPH carry energy and reducing power into the Calvin cycle.', topic: 'Calvin cycle' },
    { front: 'Where do the carbon atoms in newly formed carbohydrates come from?', back: 'Carbon dioxide fixed during the Calvin cycle.', topic: 'Carbon fixation' },
    { front: 'Does light-independent mean the Calvin cycle happens only at night?', back: 'No. It does not use light directly, but depends on ATP and NADPH produced by light-dependent reactions.', topic: 'Calvin cycle' },
    { front: 'Why might more light fail to increase photosynthesis?', back: 'Another factor, such as carbon dioxide concentration or temperature, may be limiting.', topic: 'Limiting factors' },
  ].map(card => ({ ...card, source: DEMO_NOTE.title, demo: true })),
};

export const DEMO_PROMPTS = [
  'Explain photosynthesis with a simple analogy',
  'Quiz me on the two stages of photosynthesis',
  'Help me remember where each stage happens',
];

export const demoNote = DEMO_NOTE;
export const demoQuiz = DEMO_QUIZ;
export const demoCards = DEMO_FLASHCARDS.cards;
export const demoResponse = DEMO_RESPONSE;
