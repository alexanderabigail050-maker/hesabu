import { ApiError } from './http.js';

const MODES = ['explain', 'socratic', 'teachback', 'summarize'];
const LEVELS = ['secondary', 'university', 'advanced'];
const LANGUAGES = ['English', 'Kiswahili'];

function invalid(message) { throw new ApiError(400, 'INVALID_INPUT', message); }
function plain(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function text(value, name, max, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) invalid(`${name} must be ${allowEmpty ? '' : 'non-empty text and '}at most ${max} characters.`);
  return value.trim();
}
function oneOf(value, values, name, fallback) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (!values.includes(value)) invalid(`Choose a supported ${name}.`);
  return value;
}
function knownKeys(value, allowed) {
  if (Object.keys(value).some(k => !allowed.includes(k))) invalid('The request contains an unsupported field.');
}

export function validateNotes(value = []) {
  if (!Array.isArray(value) || value.length > 4) invalid('Select no more than four notes.');
  let total = 0;
  const ids = new Set();
  const notes = value.map((note, i) => {
    if (!plain(note)) invalid('Each note must contain a title and content.');
    const id = text(note.id ?? `source-${i + 1}`, 'Note ID', 100);
    const title = text(note.title, 'Note title', 180);
    const content = text(note.content, 'Note content', 30_000);
    if (ids.has(id)) invalid('Select each note only once.');
    ids.add(id);
    total += content.length;
    return { id, title, content };
  });
  if (total > 48_000) invalid('Your selected notes are too long. Select a smaller section.');
  return notes;
}

function base(body) {
  if (!plain(body)) invalid('The request must be a JSON object.');
  const level = oneOf(body.level, LEVELS, 'learning level', 'university');
  const language = oneOf(body.language, LANGUAGES, 'language', 'English');
  const notes = validateNotes(body.notes);
  if (body.sourceOnly !== undefined && typeof body.sourceOnly !== 'boolean') invalid('Notes-only mode must be true or false.');
  const sourceOnly = body.sourceOnly ?? false;
  if (sourceOnly && !notes.length) invalid('Select at least one note to use notes-only mode.');
  return { level, language, notes, sourceOnly };
}

export function validateChat(body) {
  const settings = base(body);
  knownKeys(body, ['messages', 'mode', 'level', 'language', 'notes', 'sourceOnly']);
  const mode = oneOf(body.mode, MODES, 'study mode', 'explain');
  if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 24) invalid('Send between 1 and 24 messages. Start a new session if this conversation is too long.');
  let total = 0;
  const messages = body.messages.map(message => {
    if (!plain(message)) invalid('Each message must contain a role and text.');
    knownKeys(message, ['role', 'content']);
    const role = oneOf(message.role, ['user', 'assistant'], 'message role');
    const content = text(message.content, 'Message', 12_000);
    total += content.length;
    return { role, content };
  });
  if (total > 40_000) invalid('This conversation is too long. Start a new session or shorten the recent messages.');
  if (messages.at(-1).role !== 'user') invalid('The final message must be your question.');
  return { ...settings, messages, mode };
}

export function validateStudy(body) {
  const settings = base(body);
  knownKeys(body, ['kind', 'topic', 'level', 'language', 'notes', 'sourceOnly', 'count', 'weakTopics']);
  const kind = oneOf(body.kind, ['quiz', 'flashcards'], 'study activity');
  const topic = text(body.topic, 'Topic', 2000);
  const count = oneOf(body.count, [5, 8, 10], 'question or card count', 5);
  if (body.weakTopics !== undefined && (!Array.isArray(body.weakTopics) || body.weakTopics.length > 8)) invalid('Include no more than eight revision topics.');
  const weakTopics = (body.weakTopics || []).map(value => text(value, 'Revision topic', 180));
  return { ...settings, kind, topic, count, weakTopics };
}

const stringSchema = { type: 'string' };
export function studySchema(kind) {
  if (kind === 'quiz') return {
    type: 'object', additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: ['quiz'] }, title: stringSchema,
      questions: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: {
          id: stringSchema, question: stringSchema,
          options: { type: 'array', minItems: 4, maxItems: 4, items: stringSchema },
          answerIndex: { type: 'integer', minimum: 0, maximum: 3 },
          explanation: stringSchema, topic: stringSchema, source: stringSchema,
        },
        required: ['id', 'question', 'options', 'answerIndex', 'explanation', 'topic', 'source'],
      } },
    }, required: ['kind', 'title', 'questions'],
  };
  return {
    type: 'object', additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: ['flashcards'] }, title: stringSchema,
      cards: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        properties: { front: stringSchema, back: stringSchema, topic: stringSchema, source: stringSchema },
        required: ['front', 'back', 'topic', 'source'],
      } },
    }, required: ['kind', 'title', 'cards'],
  };
}

export function validateStudyOutput(value, request) {
  const bad = () => { throw new ApiError(502, 'INVALID_AI_OUTPUT', 'The AI returned an incomplete study activity. Please try again.'); };
  const str = (item, max = 6000) => typeof item === 'string' && item.trim().length > 0 && item.length <= max;
  if (!plain(value) || value.kind !== request.kind || !str(value.title, 180)) bad();
  const items = request.kind === 'quiz' ? value.questions : value.cards;
  if (!Array.isArray(items)) bad();
  if (!items.length) throw new ApiError(422, 'SOURCE_COVERAGE', 'The selected notes do not contain enough information for this activity. Choose different notes or a topic covered by them.');
  if (items.length !== request.count) bad();
  const sourceTitles = new Set(request.notes.map(note => note.title));
  const seenQuestions = new Set();
  const cleanItems = items.map((item, index) => {
    if (!plain(item) || !str(item.topic, 180) || typeof item.source !== 'string' || item.source.length > 180 || (item.source !== '' && !sourceTitles.has(item.source)) || (request.sourceOnly && !sourceTitles.has(item.source))) bad();
    if (request.kind === 'quiz') {
      if (!str(item.question, 2000) || !Array.isArray(item.options) || item.options.length !== 4 || item.options.some(option => !str(option, 1500)) || new Set(item.options.map(option => option.trim())).size !== 4 || !Number.isInteger(item.answerIndex) || item.answerIndex < 0 || item.answerIndex > 3 || !str(item.explanation, 4000)) bad();
      if (seenQuestions.has(item.question.trim())) bad();
      seenQuestions.add(item.question.trim());
      // IDs belong to the application, so duplicate or hostile provider IDs never become DOM keys.
      return { id: `question-${index + 1}`, question: item.question.trim(), options: item.options.map(option => option.trim()), answerIndex: item.answerIndex, explanation: item.explanation.trim(), topic: item.topic.trim(), source: item.source };
    }
    if (!str(item.front, 2000) || !str(item.back, 4000) || seenQuestions.has(item.front.trim())) bad();
    seenQuestions.add(item.front.trim());
    return { front: item.front.trim(), back: item.back.trim(), topic: item.topic.trim(), source: item.source };
  });
  return { kind: request.kind, title: value.title.trim(), [request.kind === 'quiz' ? 'questions' : 'cards']: cleanItems };
}
