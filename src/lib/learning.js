const DAY = 86_400_000;

function timestamp(value = Date.now()) {
  const result = value instanceof Date ? value.getTime() : value;
  if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error('Choose a valid date.');
  return result;
}

/** Local calendar dates keep a learner's streak aligned with their own day. */
export function dayKey(value = Date.now()) {
  const date = new Date(timestamp(value));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function utcCalendarDate(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Choose a valid exam date.');
  const result = Date.parse(`${key}T00:00:00Z`);
  if (!Number.isFinite(result) || new Date(result).toISOString().slice(0, 10) !== key) throw new Error('Choose a valid exam date.');
  return result;
}
function shiftDay(key, delta) { return new Date(utcCalendarDate(key) + delta * DAY).toISOString().slice(0, 10); }

export function getDueCards(cards, now = Date.now()) {
  const current = timestamp(now);
  return cards.filter(card => Number.isFinite(card.dueAt) && card.dueAt <= current).sort((a, b) => a.dueAt - b.dueAt);
}

/** A transparent interval schedule, not a claim of clinically validated memory prediction. */
export function reviewCard(card, rating, now = Date.now()) {
  const current = timestamp(now);
  const previous = Math.max(0, Number(card.intervalDays) || 0);
  let intervalDays;
  switch (rating) {
    case 'again': intervalDays = 10 / 1440; break;
    case 'hard': intervalDays = Math.max(0.5, Math.min(365, previous * 1.2)); break;
    case 'good': intervalDays = previous < 1 ? 1 : previous < 3 ? 3 : previous < 7 ? 7 : Math.min(365, Math.round(previous * 2.2)); break;
    case 'easy': intervalDays = Math.max(4, Math.min(365, Math.round(Math.max(previous, 1) * 3))); break;
    default: throw new Error('Choose Again, Hard, Good, or Easy.');
  }
  return {
    ...card, intervalDays, dueAt: current + Math.round(intervalDays * DAY),
    reviews: (Number.isInteger(card.reviews) ? card.reviews : 0) + 1, lastReviewedAt: current,
    reviewDates: [...new Set([
      ...(Array.isArray(card.reviewDates) ? card.reviewDates : card.lastReviewedAt ? [dayKey(card.lastReviewedAt)] : []),
      dayKey(current),
    ])].sort().slice(-3660),
  };
}

export function makeFlashcards(cards, now = Date.now()) {
  const current = timestamp(now);
  if (!Array.isArray(cards) || cards.length > 50) throw new Error('A deck can contain at most 50 new cards.');
  return cards.map(card => {
    if (!card || typeof card.front !== 'string' || typeof card.back !== 'string' || !card.front.trim() || !card.back.trim()) throw new Error('A flashcard needs a question and an answer.');
    return {
      id: crypto.randomUUID(), front: card.front, back: card.back,
      topic: typeof card.topic === 'string' && card.topic.trim() ? card.topic : 'General study',
      source: typeof card.source === 'string' ? card.source : '',
      dueAt: current, intervalDays: 0, reviews: 0, ...(card.demo === true ? { demo: true } : {}),
    };
  });
}

/** Build a deterministic plan from today up to, but not including, the exam. */
export function createStudyPlan({ topics, examDate, minutesPerDay }, now = Date.now()) {
  const current = timestamp(now);
  const list = [...new Set((Array.isArray(topics) ? topics : String(topics || '').split(/[\n,]+/)).map(topic => String(topic).trim()).filter(Boolean))];
  if (!list.length) throw new Error('Add at least one topic to make a study plan.');
  if (list.length > 30 || list.some(topic => topic.length > 140)) throw new Error('Use up to 30 topics, with a short name for each.');
  const minutes = Number(minutesPerDay);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) throw new Error('Choose between 5 and 240 study minutes per day.');
  const today = dayKey(current);
  const count = Math.round((utcCalendarDate(examDate) - utcCalendarDate(today)) / DAY);
  if (count < 1) throw new Error('Choose an exam date after today.');
  if (count > 90) throw new Error('Choose an exam date within the next 90 days. You can create your next plan later.');
  if (list.length > count) throw new Error(`You have ${list.length} topics but only ${count} study ${count === 1 ? 'day' : 'days'}. Combine related topics or choose a later exam date so every topic gets a study day.`);
  const learnMinutes = Math.max(1, Math.floor(minutes * 0.5));
  const recallMinutes = Math.max(1, Math.floor(minutes * 0.3));
  const reviewMinutes = minutes - learnMinutes - recallMinutes;
  const days = Array.from({ length: count }, (_, i) => {
    const topic = list[i % list.length];
    const revisit = list[(i + list.length - 1) % list.length];
    const review = i === count - 1;
    return {
      date: shiftDay(today, i),
      tasks: [
        { id: crypto.randomUUID(), title: review ? `Review key ideas: ${topic}` : `Understand: ${topic}`, minutes: learnMinutes, done: false },
        { id: crypto.randomUUID(), title: `Recall without notes: ${topic}`, minutes: recallMinutes, done: false },
        { id: crypto.randomUUID(), title: i === 0 ? `Make review cards: ${topic}` : `Revisit mistakes: ${revisit}`, minutes: reviewMinutes, done: false },
      ],
    };
  });
  return { id: crypto.randomUUID(), title: `${count}-day study plan`, examDate, minutesPerDay: minutes, days };
}

export function getStats(state, now = Date.now()) {
  const current = timestamp(now);
  const today = dayKey(current);
  const quizResults = state.quizResults || [];
  const focusSessions = state.focusSessions || [];
  const cards = state.flashcards || [];
  const questionsAnswered = quizResults.reduce((sum, quiz) => sum + quiz.total, 0);
  const correctAnswers = quizResults.reduce((sum, quiz) => sum + quiz.score, 0);
  const topicMap = new Map();
  for (const quiz of quizResults) {
    for (const answer of quiz.answers) {
      const topic = answer.topic || 'General study';
      const row = topicMap.get(topic) || { topic, correct: 0, total: 0 };
      row.correct += answer.correct ? 1 : 0;
      row.total += 1;
      topicMap.set(topic, row);
    }
  }
  const weakTopics = [...topicMap.values()]
    .map(row => ({ ...row, accuracy: Math.round(row.correct / row.total * 100) }))
    .filter(row => row.accuracy < 80)
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
    .slice(0, 8);
  const activityDates = new Set([
    ...quizResults.map(q => dayKey(q.createdAt)),
    ...focusSessions.map(f => dayKey(f.createdAt)),
    ...cards.flatMap(card => Array.isArray(card.reviewDates) ? card.reviewDates : card.lastReviewedAt ? [dayKey(card.lastReviewedAt)] : []),
  ]);
  let streak = 0;
  let cursor = activityDates.has(today) ? today : shiftDay(today, -1);
  while (activityDates.has(cursor) && streak < 3660) { streak += 1; cursor = shiftDay(cursor, -1); }
  const recentActivity = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDay(today, i - 6);
    return {
      date,
      minutes: focusSessions.filter(session => dayKey(session.createdAt) === date).reduce((sum, session) => sum + session.minutes, 0),
      questions: quizResults.filter(result => dayKey(result.createdAt) === date).reduce((sum, result) => sum + result.total, 0),
    };
  });
  const tasks = state.plan?.days?.flatMap(day => day.tasks) || [];
  return {
    dueCards: getDueCards(cards, current).length,
    questionsAnswered, correctAnswers, accuracy: questionsAnswered ? Math.round(correctAnswers / questionsAnswered * 100) : 0,
    quizCount: quizResults.length,
    focusMinutes: focusSessions.reduce((sum, session) => sum + session.minutes, 0),
    todayFocusMinutes: focusSessions.filter(session => dayKey(session.createdAt) === today).reduce((sum, session) => sum + session.minutes, 0),
    streak, weakTopics, recentActivity,
    completedTasks: tasks.filter(task => task.done).length, totalTasks: tasks.length,
  };
}
