import React, { useState } from "react";
import { CalendarDays, ArrowRight, Check, Plus, Clock3, ArrowUpRight, CalendarCheck } from "lucide-react";
import { createStudyPlan } from "../lib/learning.js";
import { PageHeading } from "./ui.jsx";
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
function StudyPlan({ state, setState, onToast, onLearn }) {
  const future = /* @__PURE__ */ new Date();
  future.setDate(future.getDate() + 14);
  const [editing, setEditing] = useState(!state.plan), [topics, setTopics] = useState(""), [examDate, setExamDate] = useState(state.plan?.examDate || localDate(future)), [minutes, setMinutes] = useState(state.plan?.minutesPerDay || 45);
  const plan = state.plan, tasks = plan?.days.flatMap((d) => d.tasks) || [], done = tasks.filter((t) => t.done).length;
  const tomorrow = /* @__PURE__ */ new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const create = (e) => {
    e.preventDefault();
    try {
      const result = createStudyPlan({ topics, examDate, minutesPerDay: Number(minutes) }, Date.now());
      setState((s) => ({ ...s, plan: result }));
      setEditing(false);
      onToast("Your study plan is ready. One day at a time.");
    } catch (error) {
      onToast(error.message);
    }
  };
  const toggle = (date, id) => setState((s) => ({ ...s, plan: { ...s.plan, days: s.plan.days.map((d) => d.date !== date ? d : { ...d, tasks: d.tasks.map((t) => t.id !== id ? t : { ...t, done: !t.done }) }) } }));
  return <div className="workspace-page plan-page"><PageHeading eyebrow="A CLEAR WAY FORWARD" title="Big goals. Smaller steps." text="Turn your exam date into a plan you can actually follow.">{plan && !editing && <button className="button secondary" onClick={() => setEditing(true)}><Plus size={16} /> New plan</button>}</PageHeading>{editing ? <div className="plan-builder"><div className="plan-builder-intro"><span className="empty-icon"><CalendarDays size={25} /></span><h2>A little structure goes a long way.</h2><p>Tell us what you’re learning and when you need it. We’ll spread study and review sessions across the days you have.</p><div className="plan-note"><Check size={16} /> Works instantly, without an AI request.</div></div><form onSubmit={create}><label className="field-label" htmlFor="plan-topics">What do you need to cover?</label><textarea id="plan-topics" className="text-input" value={topics} onChange={(e) => setTopics(e.target.value)} rows={5} placeholder={"One topic per line, for example:\nCell structure\nPhotosynthesis\nRespiration"} required maxLength={3e3} /><div className="form-two-columns"><div><label className="field-label" htmlFor="exam-date">Exam date</label><input id="exam-date" type="date" min={localDate(tomorrow)} className="text-input" required value={examDate} onChange={(e) => setExamDate(e.target.value)} /></div><div><label className="field-label" htmlFor="daily-minutes">Minutes each day</label><select id="daily-minutes" className="text-input" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{[15, 25, 30, 45, 60, 90, 120].map((n) => <option key={n} value={n}>{n} minutes</option>)}</select></div></div><p className="fine-print">Plans cover up to 90 days and reserve time for recall and review. Adjust your topics and create a fresh plan whenever you need to.</p><div className="modal-actions">{plan && <button type="button" className="button secondary" onClick={() => setEditing(false)}>Keep current plan</button>}<button type="submit" className="button primary">Build my plan <ArrowRight size={17} /></button></div></form></div> : plan && <><div className="plan-summary"><div><span className="blue-icon"><CalendarCheck size={23} /></span><div><h2>{plan.title || "Your study roadmap"}</h2><p>Exam on {(/* @__PURE__ */ new Date(`${plan.examDate}T12:00:00`)).toLocaleDateString(void 0, { day: "numeric", month: "long", year: "numeric" })}</p></div></div><div className="plan-summary-stats"><span><strong>{plan.days.length}</strong>study days</span><span><strong>{plan.minutesPerDay}</strong>min / day</span><span><strong>{done}<small>/{tasks.length}</small></strong>steps complete</span></div><div className="linear-progress"><i style={{ width: `${tasks.length ? done / tasks.length * 100 : 0}%` }} /></div></div><div className="plan-timeline">{plan.days.map((day, index) => {
    const date = /* @__PURE__ */ new Date(`${day.date}T12:00:00`), today = day.date === localDate(/* @__PURE__ */ new Date()), complete = day.tasks.every((t) => t.done);
    return <section key={day.date} className={`plan-day ${today ? "today" : ""} ${complete ? "complete" : ""}`}><div className="plan-date"><span>{date.toLocaleDateString(void 0, { weekday: "short" })}</span><strong>{date.getDate()}</strong><small>{date.toLocaleDateString(void 0, { month: "short" })}</small></div><div className="plan-day-content"><div className="plan-day-heading"><h3>{today ? "Today" : `Day ${index + 1}`}</h3><span>{complete ? <><Check size={13} /> Complete</> : <><Clock3 size={13} /> {day.tasks.reduce((a, t) => a + t.minutes, 0)} min</>}</span></div>{day.tasks.map((task) => <div className={`plan-task ${task.done ? "done" : ""}`} key={task.id}><label><input type="checkbox" checked={task.done} onChange={() => toggle(day.date, task.id)} /><span className="task-check"><Check size={13} /></span><span>{task.title}<small>{task.minutes} minutes</small></span></label><button className="icon-button" aria-label={`Study ${task.title}`} title="Open with tutor" onClick={() => onLearn(`Help me work through this study task: ${task.title}. I have ${task.minutes} minutes. Start with one clear step.`)}><ArrowUpRight size={17} /></button></div>)}</div></section>;
  })}</div></>}
  </div>;
}
export {
  StudyPlan as default
};
