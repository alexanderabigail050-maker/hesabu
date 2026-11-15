import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, validateWorkspace, loadState, saveState, exportWorkspace, importWorkspace, clearWorkspace, STORAGE_KEY, WorkspaceError } from '../src/lib/storage.js';
import { getDueCards, reviewCard, makeFlashcards, createStudyPlan, getStats, dayKey } from '../src/lib/learning.js';
import { readNoteFile } from '../src/lib/files.js';
import { consumeChatStream, validateStudyResponse, ApiError } from '../src/lib/api.js';
import { DEMO_QUIZ, DEMO_FLASHCARDS, DEMO_NOTE } from '../src/data/demo.js';

function fakeStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function streamChunks(chunks) {
  return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } });
}
function encode(text) { return new TextEncoder().encode(text); }
const NOW = new Date(2026, 10, 15, 12).getTime();

test('new workspaces contain no invented activity or seeded personal data', () => {
  const state = createInitialState();
  assert.deepEqual(state.conversations, []);
  assert.deepEqual(state.notes, []);
  assert.deepEqual(state.flashcards, []);
  assert.equal(getStats(state, NOW).questionsAnswered, 0);
  assert.equal(getStats(state, NOW).streak, 0);
});

test('workspace save/export/import restores exact supported learner data', () => {
  const state = createInitialState();
  state.profile.name = 'A learner';
  state.notes = [structuredClone(DEMO_NOTE)];
  state.flashcards = makeFlashcards(DEMO_FLASHCARDS.cards, NOW);
  state.plan = createStudyPlan({ topics: ['Cells', 'Energy'], examDate: '2026-11-18', minutesPerDay: 25 }, NOW);
  const storage = fakeStorage();
  saveState(state, storage);
  assert.deepEqual(loadState(storage), state);
  assert.deepEqual(importWorkspace(exportWorkspace(state)), state);
  clearWorkspace(storage);
  assert.deepEqual(loadState(storage), createInitialState());
});

test('corrupt saved data is reported and not silently overwritten', () => {
  const storage = fakeStorage();
  storage.setItem(STORAGE_KEY, '{broken');
  assert.throws(() => loadState(storage), error => error instanceof WorkspaceError && error.code === 'STORAGE_CORRUPT');
  assert.equal(storage.getItem(STORAGE_KEY), '{broken');
});

test('storage quota and unavailability produce useful errors', () => {
  assert.throws(() => saveState(createInitialState(), { setItem() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); } }), /Export a backup/);
  assert.throws(() => loadState({ getItem() { throw new Error('denied'); } }), /could not be read/);
});

test('backup imports reject prototype keys, versions, malformed arrays and oversized files', () => {
  assert.throws(() => importWorkspace('{"version":1,"__proto__":{"polluted":true}}'), /valid Hesabu/);
  const nested = exportWorkspace(createInitialState()).replace('"name": ""', '"name":"","constructor":{}');
  assert.throws(() => importWorkspace(nested), /valid Hesabu/);
  assert.equal({}.polluted, undefined);
  assert.throws(() => validateWorkspace({ ...createInitialState(), version: 2 }), /version/);
  assert.throws(() => validateWorkspace({ ...createInitialState(), notes: {} }), /Notes/);
  assert.throws(() => importWorkspace(' '.repeat(3_000_001)), /smaller than 3 MB/);
});

test('duplicate IDs and inconsistent quiz scores are rejected', () => {
  const state = createInitialState();
  state.notes = [structuredClone(DEMO_NOTE), structuredClone(DEMO_NOTE)];
  assert.throws(() => validateWorkspace(state), /duplicate/);
  state.notes = [];
  state.quizResults = [{ id: 'q', title: 'Quiz', createdAt: NOW, score: 1, total: 1, answers: [{ question: 'Question', topic: 'Topic', correct: false, selectedIndex: 0, answerIndex: 1, explanation: 'Answer' }] }];
  assert.throws(() => validateWorkspace(state), /totals/);
});

test('flashcards become due only at their due time and sort earliest first', () => {
  const [card] = makeFlashcards(DEMO_FLASHCARDS.cards.slice(0, 1), NOW);
  const future = { ...card, id: 'future', dueAt: NOW + 1 };
  const earlier = { ...card, id: 'earlier', dueAt: NOW - 100 };
  assert.deepEqual(getDueCards([card, future, earlier], NOW).map(c => c.id), ['earlier', card.id]);
  assert.equal(getDueCards([future], NOW + 1).length, 1);
});

test('review ratings schedule distinct future intervals without mutating the old card', () => {
  const [card] = makeFlashcards(DEMO_FLASHCARDS.cards.slice(0, 1), NOW);
  const again = reviewCard(card, 'again', NOW);
  assert.equal(again.dueAt, NOW + 10 * 60_000);
  assert.equal(reviewCard(card, 'hard', NOW).dueAt, NOW + 12 * 60 * 60_000);
  const good = reviewCard(card, 'good', NOW);
  assert.equal(good.intervalDays, 1);
  assert.equal(reviewCard(good, 'good', NOW).intervalDays, 3);
  assert.equal(reviewCard(card, 'easy', NOW).intervalDays, 4);
  assert.equal(card.reviews, 0);
  assert.equal(good.reviews, 1);
  assert.throws(() => reviewCard(card, 'unknown', NOW), /Choose/);
});

test('study plans preserve daily minutes, include today and exclude exam day', () => {
  const plan = createStudyPlan({ topics: 'Cells, Energy\nCells', examDate: '2026-11-18', minutesPerDay: 17 }, NOW);
  assert.deepEqual(plan.days.map(day => day.date), ['2026-11-15', '2026-11-16', '2026-11-17']);
  for (const day of plan.days) assert.equal(day.tasks.reduce((sum, task) => sum + task.minutes, 0), 17);
  assert.equal(plan.days[0].tasks[0].title, 'Understand: Cells');
  assert.equal(plan.days[1].tasks[0].title, 'Understand: Energy');
  assert.equal(new Set(plan.days.flatMap(day => day.tasks.map(t => t.id))).size, 9);
});

test('plan date validation rejects impossible dates and unsupported horizons', () => {
  const options = { topics: ['Biology'], minutesPerDay: 25 };
  assert.throws(() => createStudyPlan({ ...options, examDate: '2026-11-15' }, NOW), /after today/);
  assert.throws(() => createStudyPlan({ ...options, examDate: '2027-02-30' }, NOW), /valid exam date/);
  assert.throws(() => createStudyPlan({ ...options, examDate: '2028-01-01' }, NOW), /90 days/);
  assert.throws(() => createStudyPlan({ ...options, examDate: '2026-11-18', minutesPerDay: 4 }, NOW), /between 5/);
  assert.throws(() => createStudyPlan({ ...options, topics: ['Cells', 'Energy', 'Plants', 'Ecology'], examDate: '2026-11-18' }, NOW), /every topic gets a study day/);
});

test('plan calendar arithmetic crosses month and daylight-saving boundaries cleanly', () => {
  const start = new Date(2026, 2, 7, 23, 30).getTime();
  const plan = createStudyPlan({ topics: ['Energy'], examDate: '2026-03-10', minutesPerDay: 5 }, start);
  assert.deepEqual(plan.days.map(d => d.date), ['2026-03-07', '2026-03-08', '2026-03-09']);
  const leap = createStudyPlan({ topics: ['Energy'], examDate: '2028-03-02', minutesPerDay: 5 }, new Date(2028, 1, 28, 12));
  assert.deepEqual(leap.days.map(d => d.date), ['2028-02-28', '2028-02-29', '2028-03-01']);
});

test('stats reflect only completed work and identify actual weak topics', () => {
  const state = createInitialState();
  state.quizResults = [{ id: 'q1', title: 'Quiz', createdAt: NOW, score: 1, total: 2, answers: [{ question: 'A', topic: 'Energy', correct: false, selectedIndex: 0, answerIndex: 1, explanation: 'Reason' }, { question: 'B', topic: 'Cells', correct: true, selectedIndex: 1, answerIndex: 1, explanation: 'Reason' }] }];
  state.focusSessions = [{ id: 'f1', createdAt: NOW - 86_400_000, minutes: 25 }, { id: 'f2', createdAt: NOW, minutes: 10 }];
  const stats = getStats(state, NOW);
  assert.equal(stats.accuracy, 50);
  assert.equal(stats.questionsAnswered, 2);
  assert.equal(stats.streak, 2);
  assert.equal(stats.focusMinutes, 35);
  assert.equal(stats.todayFocusMinutes, 10);
  assert.deepEqual(stats.weakTopics, [{ topic: 'Energy', correct: 0, total: 1, accuracy: 0 }]);
  assert.equal(stats.recentActivity.at(-1).date, dayKey(NOW));
});

test('review history preserves streak days when a card is reviewed again', () => {
  const state = createInitialState();
  const [card] = makeFlashcards(DEMO_FLASHCARDS.cards.slice(0, 1), NOW - 86_400_000);
  const yesterday = reviewCard(card, 'good', NOW - 86_400_000);
  const today = reviewCard(yesterday, 'good', NOW);
  state.flashcards = [today];
  assert.deepEqual(today.reviewDates, ['2026-11-14', '2026-11-15']);
  assert.equal(getStats(state, NOW).streak, 2);
  assert.deepEqual(importWorkspace(exportWorkspace(state)).flashcards[0].reviewDates, today.reviewDates);
  assert.equal(reviewCard(today, 'again', NOW + 60_000).reviewDates.length, 2);
});

test('text note ingestion rejects unsupported files and reports deliberate truncation', async () => {
  const file = { name: 'lecture.md', size: 31000, text: async () => 'A'.repeat(31000) };
  const note = await readNoteFile(file);
  assert.equal(note.content.length, 30000);
  assert.equal(note.warnings.length, 1);
  await assert.rejects(readNoteFile({ name: 'lecture.exe', size: 100 }), /Other file types/);
  await assert.rejects(readNoteFile({ name: 'lecture.txt', size: 11 * 1024 * 1024 }), /too large/);
  await assert.rejects(readNoteFile({ name: 'empty.txt', size: 0, text: async () => '' }), /empty/);
});

test('SSE parser preserves Unicode and events split at arbitrary byte boundaries', async () => {
  const bytes = encode(': heartbeat\r\n\r\ndata: {"type":"delta","text":"Jambo 🌱"}\r\n\r\ndata: {"type":"delta","text":" learner"}\n\ndata: {"type":"done"}\n\n');
  const chunks = Array.from(bytes, byte => new Uint8Array([byte]));
  const deltas = [];
  const result = await consumeChatStream(streamChunks(chunks), { onDelta: text => deltas.push(text) });
  assert.equal(result, 'Jambo 🌱 learner');
  assert.deepEqual(deltas, ['Jambo 🌱', ' learner']);
});

test('SSE parser reports early EOF and explicit stream errors while preserving received text', async () => {
  let partial = '';
  await assert.rejects(consumeChatStream(streamChunks([encode('data: {"type":"delta","text":"Partial"}\n\n')]), { onDelta: t => { partial += t; } }), /before the answer was complete/);
  assert.equal(partial, 'Partial');
  await assert.rejects(consumeChatStream(streamChunks([encode('data: {"type":"error","message":"Request limit reached"}\n\n')])), /Request limit/);
  await assert.rejects(consumeChatStream(streamChunks([encode('data: [DONE]\n\n')])), /before the answer was complete/);
});

test('SSE cancellation produces AbortError rather than successful completion', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(consumeChatStream(streamChunks([]), { signal: controller.signal }), error => error.name === 'AbortError');
});

test('structured quiz responses are checked before UI rendering', () => {
  assert.equal(validateStudyResponse(DEMO_QUIZ, 'quiz'), DEMO_QUIZ);
  assert.equal(validateStudyResponse(DEMO_FLASHCARDS, 'flashcards'), DEMO_FLASHCARDS);
  const bad = structuredClone(DEMO_QUIZ);
  bad.questions[0].answerIndex = 4;
  assert.throws(() => validateStudyResponse(bad, 'quiz'), ApiError);
  assert.throws(() => validateStudyResponse({ ...DEMO_QUIZ, questions: [DEMO_QUIZ.questions[0], DEMO_QUIZ.questions[0]] }, 'quiz'), /incomplete/);
});
