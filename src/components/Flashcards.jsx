import React, { useEffect, useState } from "react";
import { Layers3, Plus, Sparkles, ArrowRight, RotateCcw, Trash2, FileText, LoaderCircle, Check, FlipHorizontal2 } from "lucide-react";
import { getDueCards, makeFlashcards, reviewCard } from "../lib/learning.js";
import { DEMO_FLASHCARDS } from "../data/demo.js";
import { EmptyState, Modal, PageHeading } from "./ui.jsx";
function Flashcards({ state, setState, generate, onSources, selectedCount, onToast }) {
  const [topic, setTopic] = useState(""), [busy, setBusy] = useState(false), [flipped, setFlipped] = useState(false), [reviewed, setReviewed] = useState([]), [all, setAll] = useState(false), [manual, setManual] = useState(false), [front, setFront] = useState(""), [back, setBack] = useState(""), [manualTopic, setManualTopic] = useState("");
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 3e4);
    return () => clearInterval(timer);
  }, []);
  const due = getDueCards(state.flashcards, clock), queue = all ? state.flashcards.filter((c) => !reviewed.includes(c.id)) : due, card = queue[0];
  const add = (cards) => {
    if (state.flashcards.length + cards.length > 1500) {
      onToast("Your card collection is full. Export a backup and remove a few cards before adding more.");
      return false;
    }
    setState((s) => ({ ...s, flashcards: [...makeFlashcards(cards), ...s.flashcards] }));
    setReviewed([]);
    setFlipped(false);
    setClock(Date.now());
    return true;
  };
  const generateCards = async () => {
    if (state.flashcards.length + 8 > 1500) {
      onToast("Make room for eight cards before generating. Export a backup and remove older cards.");
      return;
    }
    if (!topic.trim() && !selectedCount) {
      onToast("Add a topic or select a note first.");
      return;
    }
    setBusy(true);
    try {
      const result = await generate({ kind: "flashcards", topic: topic.trim() || "Key ideas in my selected notes", count: 8 });
      if (result && add(result.cards)) {
        onToast(`${result.cards.length} cards are ready to review.`);
      }
    } catch (error) {
      onToast(error.message);
    } finally {
      setBusy(false);
    }
  };
  const rate = (rating) => {
    try {
      const updated = reviewCard(card, rating, Date.now());
      setState((s) => ({ ...s, flashcards: s.flashcards.map((c) => c.id === card.id ? updated : c) }));
      setReviewed((v) => [...v, card.id]);
      setFlipped(false);
      setClock(Date.now());
    } catch (error) {
      onToast(error.message);
    }
  };
  const sample = () => {
    if (state.flashcards.some((c) => c.demo)) {
      setAll(true);
      setReviewed([]);
      setFlipped(false);
      onToast("Your sample cards are already here.");
      return;
    }
    if (add(DEMO_FLASHCARDS.cards.map((c) => ({ ...c, demo: true })))) onToast("Sample photosynthesis cards added.");
  };
  return <div className="workspace-page flashcards-page"><PageHeading eyebrow="SPACED REVIEW" title="Make the important things stay." text="Small cards. A lasting understanding."><button className="button secondary" onClick={() => setManual(true)}><Plus size={16} /> Add a card</button></PageHeading><div className="card-generator"><Sparkles size={19} /><input aria-label="Flashcard topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Turn any topic into a set of review cards…" maxLength={1800} /><button className="icon-button" aria-label={`Select notes, ${selectedCount} selected`} title="Use my notes" onClick={onSources}><FileText size={18} />{selectedCount > 0 && <i className="attachment-dot" />}</button><button className="button primary" disabled={busy} onClick={generateCards}>{busy ? <LoaderCircle size={16} className="spinning" /> : <Plus size={16} />} {busy ? "Creating\u2026" : "Create cards"}</button></div><div className="review-toolbar"><div className="segmented-control"><button className={!all ? "active" : ""} onClick={() => {
    setAll(false);
    setReviewed([]);
    setFlipped(false);
  }}>Due now <span>{due.length}</span></button><button className={all ? "active" : ""} onClick={() => {
    setAll(true);
    setReviewed([]);
    setFlipped(false);
  }}>All cards <span>{state.flashcards.length}</span></button></div>{reviewed.length > 0 && <span className="review-count"><Check size={14} />{reviewed.length} reviewed this session</span>}</div>
    {card ? <div className="review-area"><div className="review-card-stack"><div className="card-underlay" /><button className={`review-card ${flipped ? "flipped" : ""}`} onClick={() => setFlipped((v) => !v)} aria-label={flipped ? "Hide answer" : "Reveal answer"}><div className="review-card-top"><span>{card.topic || "Your review"}{card.demo ? " \xB7 Sample" : ""}</span><span>{flipped ? "ANSWER" : "QUESTION"}</span></div><div className="review-card-content">{flipped ? card.back : card.front}</div><div className="review-card-bottom"><span><FlipHorizontal2 size={16} />{flipped ? "Tap to see question" : "Think first. Tap to reveal."}</span>{flipped && card.source && <small>{card.source}</small>}</div></button></div><div className={`card-rating ${flipped ? "revealed" : ""}`}><p>{flipped ? "How well did you remember?" : "Try to answer out loud before revealing."}</p>{flipped ? <div className="rating-buttons"><button onClick={() => rate("again")}><span className="rating-dot again" />Again<small>In 10 minutes</small></button><button onClick={() => rate("hard")}><span className="rating-dot hard" />Hard<small>A shorter interval</small></button><button onClick={() => rate("good")}><span className="rating-dot good" />Got it<small>A longer interval</small></button><button onClick={() => rate("easy")}><span className="rating-dot easy" />Easy<small>Give it more time</small></button></div> : <button className="button secondary" onClick={() => setFlipped(true)}>Reveal answer <ArrowRight size={16} /></button>}</div><div className="card-footer"><span>{queue.length} {queue.length === 1 ? "card" : "cards"} left · {card.reviews || 0} previous reviews</span><button className="button text danger-text" onClick={() => {
    setState((s) => ({ ...s, flashcards: s.flashcards.filter((c) => c.id !== card.id) }));
    setFlipped(false);
    onToast("Card removed.");
  }}><Trash2 size={14} /> Remove card</button></div></div> : <div className="empty-panel"><EmptyState icon={reviewed.length ? Check : Layers3} title={reviewed.length ? "A little review, a lot of progress." : state.flashcards.length ? "You\u2019re all caught up." : "A home for your aha moments."} text={state.flashcards.length ? "Your next cards will appear when they are due. Add a new set or review ahead." : "Create cards from your notes, write one yourself, or try a ready-made sample."}>{state.flashcards.length ? <button className="button secondary" onClick={() => {
    setAll(true);
    setReviewed([]);
    setFlipped(false);
  }}><RotateCcw size={16} /> Review all cards</button> : <button className="button secondary" onClick={sample}>Try sample cards <ArrowRight size={16} /></button>}</EmptyState></div>}
    <div className="quiet-info"><Layers3 size={16} /><p>Your rating adjusts the next review date. “Again” brings a card back sooner. “Easy” gives it more space.</p></div>
    {manual && <Modal title="Keep a thought worth remembering" onClose={() => setManual(false)}><form onSubmit={(e) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;
    if (!add([{ front: front.trim(), back: back.trim(), topic: manualTopic.trim() || "My cards", source: "" }])) return;
    setFront("");
    setBack("");
    setManualTopic("");
    setManual(false);
    onToast("Card added to your next review.");
  }}><label className="field-label" htmlFor="manual-front">Question or prompt</label><textarea id="manual-front" className="text-input" value={front} onChange={(e) => setFront(e.target.value)} required maxLength={2e3} rows={3} /><label className="field-label" htmlFor="manual-back">Answer</label><textarea id="manual-back" className="text-input" value={back} onChange={(e) => setBack(e.target.value)} required maxLength={4e3} rows={4} /><label className="field-label" htmlFor="manual-topic">Topic</label><input id="manual-topic" className="text-input" value={manualTopic} onChange={(e) => setManualTopic(e.target.value)} maxLength={100} placeholder="e.g. Biology" /><div className="modal-actions"><button type="button" className="button secondary" onClick={() => setManual(false)}>Cancel</button><button className="button primary" type="submit">Save card <Check size={16} /></button></div></form></Modal>}
  </div>;
}
export {
  Flashcards as default
};
