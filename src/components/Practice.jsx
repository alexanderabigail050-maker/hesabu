import React, { useState } from "react";
import { ArrowRight, Check, X, Sparkles, Brain, ChevronRight, RotateCcw, Target, FileText, FlaskConical, LoaderCircle } from "lucide-react";
import { DEMO_QUIZ } from "../data/demo.js";
import { EmptyState, PageHeading } from "./ui.jsx";
function Practice({ state, setState, generate, onSources, selectedCount, onLearn, onToast, initialTopic = "" }) {
  const [topic, setTopic] = useState(initialTopic), [quiz, setQuiz] = useState(null), [index, setIndex] = useState(0), [selected, setSelected] = useState(null), [checked, setChecked] = useState(false), [answers, setAnswers] = useState([]), [complete, setComplete] = useState(false), [busy, setBusy] = useState(false), [count, setCount] = useState(5);
  const startQuiz = (value, demo = false) => {
    setQuiz({ ...value, demo });
    setIndex(0);
    setSelected(null);
    setChecked(false);
    setAnswers([]);
    setComplete(false);
  };
  const create = async (weakTopics2 = []) => {
    if (!topic.trim() && !selectedCount) {
      onToast("Add a topic or select a note first.");
      return;
    }
    setBusy(true);
    try {
      const result = await generate({ kind: "quiz", topic: topic.trim() || "Key ideas in my selected notes", count, weakTopics: weakTopics2 });
      if (result) startQuiz(result);
    } catch (error) {
      onToast(error.message);
    } finally {
      setBusy(false);
    }
  };
  const next = () => {
    const q = quiz.questions[index], answer = { question: q.question, topic: q.topic, correct: selected === q.answerIndex, selectedIndex: selected, answerIndex: q.answerIndex, explanation: q.explanation };
    const nextAnswers = [...answers, answer];
    setAnswers(nextAnswers);
    if (index === quiz.questions.length - 1) {
      const result = { id: crypto.randomUUID(), title: quiz.title, createdAt: Date.now(), answers: nextAnswers, score: nextAnswers.filter((a) => a.correct).length, total: nextAnswers.length, demo: quiz.demo };
      if (state.quizResults.length >= 500) {
        onToast("Your practice history is full. This result is shown here but was not saved. Export a backup before starting a fresh workspace.");
      } else {
        setState((s) => ({ ...s, quizResults: [result, ...s.quizResults] }));
      }
      setComplete(true);
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
      setChecked(false);
    }
  };
  const question = quiz?.questions[index];
  const score = answers.filter((a) => a.correct).length;
  const weakTopics = [...new Set(answers.filter((a) => !a.correct).map((a) => a.topic))];
  return <div className="workspace-page practice-page"><PageHeading eyebrow="ACTIVE RECALL" title="Don’t just read it. Know it." text="A little challenge now. A stronger memory later." />
    {!quiz && <><div className="generation-panel"><div className="panel-title"><span className="blue-icon"><Brain size={20} /></span><div><h2>Build your next challenge</h2><p>A short quiz helps you spot what needs another look.</p></div></div><label className="field-label" htmlFor="quiz-topic">What are you studying?</label><input id="quiz-topic" className="text-input" maxLength={1800} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="A topic, chapter, or a concept you want to master" /><div className="generation-footer"><button className="button subtle" onClick={onSources}><FileText size={16} />{selectedCount ? `${selectedCount} notes selected` : "Use my notes"}</button><label className="small-select"><span>Questions</span><select aria-label="Number of questions" value={count} onChange={(e) => setCount(Number(e.target.value))}><option value={5}>5</option><option value={8}>8</option><option value={10}>10</option></select></label><button className="button primary" disabled={busy} onClick={() => create()}>{busy ? <LoaderCircle size={17} className="spinning" /> : <Sparkles size={17} />} {busy ? "Building your quiz\u2026" : "Generate quiz"}</button></div></div><div className="sample-strip"><span className="sample-icon"><FlaskConical size={19} /></span><div><strong>See how active recall feels</strong><p>Try a five-question photosynthesis quiz. A fixed sample, ready without AI.</p></div><button className="button secondary" onClick={() => {
    setTopic("Photosynthesis");
    startQuiz(DEMO_QUIZ, true);
  }}>Try sample <ArrowRight size={16} /></button></div><div className="practice-principles"><div><span>01</span><h3>Think before you tap</h3><p>Retrieval starts before the answer appears.</p></div><div><span>02</span><h3>Understand the why</h3><p>Every answer comes with an explanation.</p></div><div><span>03</span><h3>Come back stronger</h3><p>Your missed topics become the next step.</p></div></div>{state.quizResults.length > 0 && <section className="history-section"><h2>Recent practice</h2>{state.quizResults.slice(0, 5).map((result) => <div className="history-row" key={result.id}><span className="small-icon"><Target size={17} /></span><div><strong>{result.title}</strong><small>{new Date(result.createdAt).toLocaleDateString(void 0, { month: "short", day: "numeric" })}{result.demo ? " \xB7 Sample quiz" : ""}</small></div><span className="score-pill">{result.score}/{result.total}</span></div>)}</section>}</>}
    {quiz && !complete && <section className="quiz-panel"><div className="quiz-meta"><span>{quiz.demo ? "SAMPLE QUIZ" : "YOUR PRACTICE"} <i>·</i> {quiz.title}</span><button className="button text" onClick={() => setQuiz(null)}>End practice <X size={15} /></button></div><div className="quiz-progress-head"><span>Question {index + 1} <span>of {quiz.questions.length}</span></span><span>{answers.filter((a) => a.correct).length} correct so far</span></div><div className="linear-progress"><i style={{ width: `${index / quiz.questions.length * 100}%` }} /></div><span className="topic-label">{question.topic}</span><h2 className="quiz-question">{question.question}</h2><div className="quiz-options">{question.options.map((option, i) => <button key={i} className={`quiz-option ${selected === i ? "selected" : ""} ${checked && i === question.answerIndex ? "correct" : ""} ${checked && selected === i && selected !== question.answerIndex ? "wrong" : ""}`} onClick={() => !checked && setSelected(i)} disabled={checked} aria-pressed={selected === i}><span className="option-letter">{String.fromCharCode(65 + i)}</span><span>{option}</span>{checked && i === question.answerIndex ? <Check size={20} /> : checked && selected === i ? <X size={20} /> : null}</button>)}</div>{checked && <div className={`answer-explanation ${selected === question.answerIndex ? "is-correct" : "is-wrong"}`} role="status"><strong>{selected === question.answerIndex ? "That\u2019s it. You\u2019ve got it." : "A useful place to learn."}</strong><p>{question.explanation}</p>{question.source && <small>{question.source}</small>}</div>}<div className="quiz-action"><span>{checked ? "Understanding the reason is the real win." : "Choose the answer you think is right."}</span><button className="button primary" disabled={selected === null} onClick={checked ? next : () => setChecked(true)}>{checked ? index === quiz.questions.length - 1 ? "See my results" : "Next question" : "Check answer"}<ArrowRight size={17} /></button></div></section>}
    {complete && <section className="results-panel"><div className="result-orbit"><span>{score}<small>/{answers.length}</small></span></div><p className="eyebrow">PRACTICE COMPLETE{quiz.demo ? " \xB7 SAMPLE QUIZ" : ""}</p><h2>{score === answers.length ? "That knowledge is sticking." : "A clearer picture of what\u2019s next."}</h2><p>{weakTopics.length ? `You\u2019ve found ${weakTopics.length} ${weakTopics.length === 1 ? "topic" : "topics"} worth another look. Every gap is a useful starting point.` : "You answered every question correctly. Revisit this topic later to see what stays with you."}</p>{weakTopics.length > 0 && <div className="weak-topics"><h3>Give these a little more attention</h3>{weakTopics.map((t) => <button key={t} onClick={() => onLearn(`Help me understand ${t}. I missed this in a quiz. Explain the key idea, then ask me one short question.`)}>{t}<ChevronRight size={16} /></button>)}</div>}<div className="result-actions"><button className="button secondary" onClick={() => {
    setQuiz(null);
    setComplete(false);
  }}><RotateCcw size={16} /> New practice</button>{weakTopics.length > 0 && <button className="button primary" disabled={busy} onClick={() => create(weakTopics)}>{busy ? <LoaderCircle className="spinning" size={16} /> : <Sparkles size={16} />} Practise weak topics</button>}</div><div className="result-breakdown">{answers.map((a, i) => <details key={i}><summary><span className={`result-check ${a.correct ? "correct" : "wrong"}`}>{a.correct ? <Check size={14} /> : <X size={14} />}</span><span>{a.question}</span><ChevronRight size={15} /></summary><p>{a.explanation}</p></details>)}</div></section>}
  </div>;
}
export {
  Practice as default
};
