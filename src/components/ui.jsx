import React, { useEffect, useRef } from "react";
import { X, ArrowUpRight, Check, FileText } from "lucide-react";
function Mark({ className = "", size = 32 }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`hesabu-mark ${className}`} aria-hidden="true"><path d="M24 3c2.7 12.2 8.8 18.3 21 21-12.2 2.7-18.3 8.8-21 21C21.3 32.8 15.2 26.7 3 24 15.2 21.3 21.3 15.2 24 3Z" fill="currentColor" /><path d="m24 15 9 9-9 9-9-9 9-9Z" fill="#090D15" /><path d="M24 20v8m-4-4h8" stroke="currentColor" strokeWidth="2" /></svg>;
}
function Modal({ title, children, onClose, className = "", description }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (ref.current?.querySelector('input:not([type="checkbox"]),textarea,select') || ref.current?.querySelector('button,[tabindex="0"]'))?.focus();
    const handleKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const nodes = [...ref.current?.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]') || []].filter((n) => n.getClientRects().length);
        if (!nodes.length) {
          e.preventDefault();
          return;
        }
        if (e.shiftKey && (document.activeElement === nodes[0] || !ref.current.contains(document.activeElement))) {
          e.preventDefault();
          nodes.at(-1).focus();
        }
        if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
          e.preventDefault();
          nodes[0].focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return <div className="modal-backdrop" onMouseDown={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}><section className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}><header className="modal-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></header>{children}</section></div>;
}
function EmptyState({ icon: Icon, title, text, children }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={24} /></span><h3>{title}</h3><p>{text}</p>{children}</div>;
}
function PageHeading({ eyebrow, title, text, children }) {
  return <header className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{text && <p className="page-description">{text}</p>}</div>{children && <div className="page-heading-actions">{children}</div>}</header>;
}
function SourcePicker({ notes, selectedIds, setSelectedIds, sourceOnly, setSourceOnly, onClose, onAdd, onToast }) {
  return <Modal title="Learn from your notes" description="Choose the material for your next question, quiz, or card set." onClose={onClose}>
    <div className="source-list">{notes.length ? notes.map((note) => <label key={note.id} className={`source-item ${selectedIds.includes(note.id) ? "selected" : ""}`}><input type="checkbox" checked={selectedIds.includes(note.id)} onChange={(e) => {
    if (e.target.checked && selectedIds.length >= 3) {
      onToast("Choose up to three notes at a time.");
      return;
    }
    setSelectedIds(e.target.checked ? [...selectedIds, note.id] : selectedIds.filter((id) => id !== note.id));
  }} /><FileText size={20} /><span><strong>{note.title}</strong><small>{note.content.length.toLocaleString()} characters{note.demo ? " \xB7 Sample note" : ""}</small></span>{selectedIds.includes(note.id) && <Check size={17} />}</label>) : <div className="small-empty">No notes here yet. Add a PDF, text file, or paste your own notes.</div>}</div>
    <label className="toggle-line"><span><strong>Only use my notes</strong><small>Ask the tutor to say when the selected material does not cover an answer.</small></span><input type="checkbox" role="switch" checked={sourceOnly} onChange={(e) => setSourceOnly(e.target.checked)} /></label>
    <p className="fine-print">Your files stay in this browser. Selected text is sent to OpenAI when you use an AI tool. Long notes use an excerpt of up to 12,000 characters each, within a 30,000 character total.</p>
    <div className="modal-actions"><button className="button secondary" onClick={() => {
    onClose();
    onAdd();
  }}>Add notes <ArrowUpRight size={16} /></button><button className="button primary" onClick={onClose}>Use {selectedIds.length || "no"} {selectedIds.length === 1 ? "note" : "notes"} <Check size={16} /></button></div>
  </Modal>;
}
function downloadText(name, text, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2e3);
}
export {
  EmptyState,
  Mark,
  Modal,
  PageHeading,
  SourcePicker,
  downloadText
};
