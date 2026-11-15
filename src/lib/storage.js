/** Local-only workspace persistence. No API keys or session credentials belong here. */
export const STORAGE_KEY = 'hesabu.workspace.v1';
export const MAX_BACKUP_BYTES = 3_000_000;
const MAX_TEXT_CHARS = 1_400_000;
const LEVELS = ['secondary', 'university', 'advanced'];
const LANGUAGES = ['English', 'Kiswahili'];
const MODES = ['explain', 'socratic', 'teachback', 'summarize'];

export class WorkspaceError extends Error {
  constructor(message, code = 'INVALID_WORKSPACE') {
    super(message);
    this.name = 'WorkspaceError';
    this.code = code;
  }
}

export function createInitialState() {
  return {
    version: 1,
    profile: { name: '', level: 'university', language: 'English', dailyGoal: 25 },
    conversations: [], notes: [], flashcards: [], quizResults: [], plan: null, focusSessions: [],
  };
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new WorkspaceError(`${label} must be an object.`);
  }
  for (const key of Object.keys(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new WorkspaceError('The backup contains an unsafe object key.');
  }
  return value;
}
function text(value, label, max = 500, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) {
    throw new WorkspaceError(`${label} is missing or too long.`);
  }
  return value;
}
function number(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new WorkspaceError(`${label} is invalid.`);
  return value;
}
function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = number(value, label, min, max);
  if (!Number.isInteger(n)) throw new WorkspaceError(`${label} must be a whole number.`);
  return n;
}
function enumValue(value, allowed, label, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!allowed.includes(value)) throw new WorkspaceError(`${label} is not supported.`);
  return value;
}
function list(value, label, max) {
  if (!Array.isArray(value) || value.length > max) throw new WorkspaceError(`${label} must contain at most ${max} items.`);
  return value;
}
function optionalText(value, label, max = 500) { return value === undefined ? '' : text(value, label, max, true); }
function dateString(value, label) {
  text(value, label, 10);
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) throw new WorkspaceError(`${label} must be a valid calendar date.`);
  return value;
}
function uniqueIds(items, label) {
  if (new Set(items.map(item => item.id)).size !== items.length) throw new WorkspaceError(`${label} contains duplicate identifiers.`);
  return items;
}

/** Accepts only known fields and returns fresh objects, never merging imported objects into application state. */
export function validateWorkspace(input) {
  const state = object(input, 'Workspace');
  if (state.version !== 1) throw new WorkspaceError('This backup uses an unsupported workspace version.');
  const allowed = new Set(Object.keys(createInitialState()));
  if (Object.keys(state).some(key => !allowed.has(key))) throw new WorkspaceError('The backup contains unrecognized workspace fields.');
  const profile = object(state.profile, 'Profile');
  const clean = createInitialState();
  clean.profile = {
    name: optionalText(profile.name, 'Name', 60),
    level: enumValue(profile.level, LEVELS, 'Study level'),
    language: enumValue(profile.language, LANGUAGES, 'Language'),
    dailyGoal: integer(profile.dailyGoal, 'Daily goal', 5, 240),
  };
  clean.notes = uniqueIds(list(state.notes, 'Notes', 30).map((item) => {
    const n = object(item, 'Note');
    return {
      id: text(n.id, 'Note ID', 100), title: text(n.title, 'Note title', 180),
      content: text(n.content, 'Note content', 30_000), createdAt: number(n.createdAt, 'Note creation time'),
      ...(n.updatedAt !== undefined ? { updatedAt: number(n.updatedAt, 'Note update time') } : {}),
      ...(n.warnings !== undefined ? { warnings: list(n.warnings, 'Note warnings', 10).map(w => text(w, 'Note warning', 500)) } : {}),
      ...(n.demo === true ? { demo: true } : {}),
    };
  }), 'Notes');
  clean.conversations = uniqueIds(list(state.conversations, 'Conversations', 60).map((item) => {
    const c = object(item, 'Conversation');
    return {
      id: text(c.id, 'Conversation ID', 100), title: text(c.title, 'Conversation title', 180),
      createdAt: number(c.createdAt, 'Conversation creation time'), updatedAt: number(c.updatedAt ?? c.createdAt, 'Conversation update time'),
      mode: enumValue(c.mode, MODES, 'Learning mode', 'explain'),
      ...(c.demo === true ? { demo: true } : {}),
      messages: uniqueIds(list(c.messages, 'Messages', 100).map((message) => {
        const m = object(message, 'Message');
        return {
          id: text(m.id, 'Message ID', 100), role: enumValue(m.role, ['user', 'assistant'], 'Message role'),
          content: text(m.content, 'Message content', 50_000, true), createdAt: number(m.createdAt ?? c.createdAt, 'Message creation time'),
          ...(m.demo === true ? { demo: true } : {}),
          ...(m.status !== undefined ? { status: enumValue(m.status, ['complete', 'streaming', 'error', 'stopped'], 'Message status') } : {}),
          ...(m.error !== undefined ? { error: text(m.error, 'Message error', 2000, true) } : {}),
          ...(typeof m.stopped === 'boolean' ? { stopped: m.stopped } : {}),
          ...(m.sourceIds !== undefined ? { sourceIds: list(m.sourceIds, 'Message sources', 30).map(id => text(id, 'Source ID', 100)) } : {}),
        };
      }), 'Messages'),
    };
  }), 'Conversations');
  clean.flashcards = uniqueIds(list(state.flashcards, 'Flashcards', 1500).map((item) => {
    const c = object(item, 'Flashcard');
    return {
      id: text(c.id, 'Card ID', 100), front: text(c.front, 'Card question', 2000), back: text(c.back, 'Card answer', 5000),
      topic: text(c.topic, 'Card topic', 180), source: optionalText(c.source, 'Card source', 300),
      dueAt: number(c.dueAt, 'Card review date'), intervalDays: number(c.intervalDays, 'Review interval', 0, 3650),
      reviews: integer(c.reviews, 'Review count', 0, 100_000),
      ...(c.lastReviewedAt !== undefined ? { lastReviewedAt: number(c.lastReviewedAt, 'Last review time') } : {}),
      ...(c.reviewDates !== undefined ? { reviewDates: [...new Set(list(c.reviewDates, 'Review dates', 3660).map(date => dateString(date, 'Review date')))].sort() } : {}),
      ...(c.demo === true ? { demo: true } : {}),
    };
  }), 'Flashcards');
  clean.quizResults = uniqueIds(list(state.quizResults, 'Quiz results', 500).map((item) => {
    const q = object(item, 'Quiz result');
    const answers = list(q.answers, 'Quiz answers', 50).map((value) => {
      const a = object(value, 'Quiz answer');
      const selectedIndex = integer(a.selectedIndex, 'Selected answer', 0, 3);
      const answerIndex = integer(a.answerIndex, 'Correct answer', 0, 3);
      if (typeof a.correct !== 'boolean' || a.correct !== (selectedIndex === answerIndex)) throw new WorkspaceError('Quiz answer correctness is inconsistent.');
      return { question: text(a.question, 'Quiz question', 3000), topic: text(a.topic, 'Quiz topic', 180), correct: a.correct, selectedIndex, answerIndex, explanation: text(a.explanation, 'Answer explanation', 5000) };
    });
    const score = integer(q.score, 'Quiz score', 0, 50);
    const total = integer(q.total, 'Quiz total', 1, 50);
    if (total !== answers.length || score !== answers.filter(a => a.correct).length) throw new WorkspaceError('Quiz totals do not match the answers.');
    return { id: text(q.id, 'Quiz ID', 100), title: text(q.title, 'Quiz title', 180), createdAt: number(q.createdAt, 'Quiz date'), answers, score, total, ...(q.demo === true ? { demo: true } : {}) };
  }), 'Quiz results');
  clean.focusSessions = uniqueIds(list(state.focusSessions, 'Focus sessions', 2000).map((item) => {
    const f = object(item, 'Focus session');
    return { id: text(f.id, 'Focus session ID', 100), createdAt: number(f.createdAt, 'Focus session time'), minutes: number(f.minutes, 'Focus duration', 0.1, 240) };
  }), 'Focus sessions');
  if (state.plan !== null) {
    const p = object(state.plan, 'Study plan');
    clean.plan = {
      id: text(p.id, 'Plan ID', 100), title: text(p.title, 'Plan title', 180), examDate: dateString(p.examDate, 'Exam date'),
      minutesPerDay: integer(p.minutesPerDay, 'Study minutes', 5, 240),
      days: list(p.days, 'Plan days', 90).map((value) => {
        const day = object(value, 'Plan day');
        return { date: dateString(day.date, 'Study date'), tasks: uniqueIds(list(day.tasks, 'Daily tasks', 12).map((value) => {
          const t = object(value, 'Study task');
          if (typeof t.done !== 'boolean') throw new WorkspaceError('Study task completion must be true or false.');
          return { id: text(t.id, 'Task ID', 100), title: text(t.title, 'Task title', 250), minutes: integer(t.minutes, 'Task duration', 1, 240), done: t.done };
        }), 'Daily tasks') };
      }),
    };
  }
  if (JSON.stringify(clean).length > MAX_TEXT_CHARS) throw new WorkspaceError('This workspace is too large. Export a backup, then remove some old chats or notes.');
  return clean;
}

function storageOrThrow(storage) {
  try {
    const result = storage ?? globalThis.localStorage;
    if (!result) throw new Error('Unavailable');
    return result;
  } catch {
    throw new WorkspaceError('Browser storage is unavailable. Allow site storage to keep your work, or export a backup before leaving.', 'STORAGE_UNAVAILABLE');
  }
}

export function loadState(storage) {
  const target = storageOrThrow(storage);
  let saved;
  try { saved = target.getItem(STORAGE_KEY); }
  catch { throw new WorkspaceError('Your saved workspace could not be read. You can continue in this tab and export a backup.', 'STORAGE_UNAVAILABLE'); }
  if (!saved) return createInitialState();
  try { return importWorkspace(saved); }
  catch { throw new WorkspaceError('Your saved workspace could not be opened. It has not been overwritten. Restore a backup or reset this browser workspace in Settings.', 'STORAGE_CORRUPT'); }
}

export function saveState(state, storage) {
  const clean = validateWorkspace(state);
  try { storageOrThrow(storage).setItem(STORAGE_KEY, JSON.stringify(clean)); }
  catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError('Your browser could not save this update. Export a backup and free some site storage before closing the tab.', 'STORAGE_FULL');
  }
  return clean;
}

/** Returns a JSON string. The UI decides how and where the user downloads it. */
export function exportWorkspace(state) { return JSON.stringify(validateWorkspace(state), null, 2); }

/** Validates a backup without saving it. Replacing an active workspace belongs to the UI's explicit import action. */
export function importWorkspace(json) {
  if (typeof json !== 'string' || new TextEncoder().encode(json).byteLength > MAX_BACKUP_BYTES) throw new WorkspaceError('Choose a Hesabu backup smaller than 3 MB.');
  let parsed;
  try {
    parsed = JSON.parse(json, (key, value) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe key');
      return value;
    });
  } catch { throw new WorkspaceError('This file is not a valid Hesabu workspace backup.'); }
  return validateWorkspace(parsed);
}

export function clearWorkspace(storage) {
  try { storageOrThrow(storage).removeItem(STORAGE_KEY); }
  catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError('Your browser could not reset the saved workspace.', 'STORAGE_UNAVAILABLE');
  }
  return createInitialState();
}
