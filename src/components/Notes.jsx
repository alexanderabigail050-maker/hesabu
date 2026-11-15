import React, { useRef, useState } from "react";
import { Upload, FileText, Plus, Search, ArrowUpRight, Check, Trash2, LoaderCircle, BookOpen, X, FlaskConical } from "lucide-react";
import { readNoteFile } from "../lib/files.js";
import { DEMO_NOTE } from "../data/demo.js";
import { EmptyState, Modal, PageHeading } from "./ui.jsx";
function Notes({ state, setState, selectedIds, setSelectedIds, onToast, onLearn }) {
  const [query, setQuery] = useState(""), [uploading, setUploading] = useState(false), [dragging, setDragging] = useState(false), [editor, setEditor] = useState(null), [title, setTitle] = useState(""), [content, setContent] = useState(""), [deleting, setDeleting] = useState(null);
  const inputRef = useRef(null);
  const select = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((ids) => ids.filter((v) => v !== id));
      return;
    }
    if (selectedIds.length >= 3) {
      onToast("Choose up to three notes at a time.");
      return;
    }
    setSelectedIds((ids) => [...ids, id]);
  };
  const upload = async (files) => {
    if (!files.length) return;
    if (files.length > 5) {
      onToast("Choose up to five files at a time.");
      return;
    }
    if (state.notes.length + files.length > 30) {
      onToast("Your notes collection has a limit of 30. Export a backup and remove older notes to make room.");
      return;
    }
    setUploading(true);
    try {
      const loaded = [];
      for (const file of [...files].slice(0, 5)) {
        try {
          loaded.push(await readNoteFile(file));
        } catch (error) {
          onToast(`${file.name}: ${error.message}`);
        }
      }
      if (loaded.length) {
        setState((s) => ({ ...s, notes: [...loaded, ...s.notes] }));
        setSelectedIds((ids) => [.../* @__PURE__ */ new Set([...ids, ...loaded.map((n) => n.id)])].slice(0, 3));
        onToast(`${loaded.length === 1 ? loaded[0].title : `${loaded.length} notes`} added to your workspace.`);
        const warnings = loaded.flatMap((n) => n.warnings || []);
        if (warnings.length) setTimeout(() => onToast(warnings[0]), 1800);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const openEditor = (note) => {
    setEditor(note || { id: null });
    setTitle(note?.title || "");
    setContent(note?.content || "");
  };
  const save = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    if (!editor.id && state.notes.length >= 30) {
      onToast("Your notes collection is full. Export a backup and remove older notes to make room.");
      return;
    }
    const note = { ...editor, id: editor.id || crypto.randomUUID(), title: title.trim(), content: content.trim(), createdAt: editor.createdAt || Date.now(), warnings: [] };
    setState((s) => ({ ...s, notes: editor.id ? s.notes.map((n) => n.id === note.id ? note : n) : [note, ...s.notes] }));
    if (!editor.id) setSelectedIds((ids) => [.../* @__PURE__ */ new Set([...ids, note.id])].slice(0, 3));
    setEditor(null);
    onToast("Note saved.");
  };
  const sample = () => {
    const existing = state.notes.find((n) => n.demo);
    if (existing) {
      openEditor(existing);
      return;
    }
    if (state.notes.length >= 30) {
      onToast("Remove a note to make room for the sample.");
      return;
    }
    const note = { ...DEMO_NOTE, id: crypto.randomUUID(), createdAt: Date.now(), demo: true };
    setState((s) => ({ ...s, notes: [note, ...s.notes] }));
    setSelectedIds((ids) => [...ids, note.id].slice(0, 3));
    onToast("Sample photosynthesis note added.");
  };
  const notes = state.notes.filter((n) => `${n.title} ${n.content}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="workspace-page notes-page"><PageHeading eyebrow="YOUR LEARNING MATERIAL" title="Everything starts with a good source." text="Bring your course material. Give every question a little more context."><button className="button secondary" onClick={() => openEditor(null)}><Plus size={16} /> Write a note</button><button className="button primary" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? <LoaderCircle size={16} className="spinning" /> : <Upload size={16} />} Upload notes</button></PageHeading><input type="file" className="visually-hidden" ref={inputRef} accept=".pdf,.txt,.md,.markdown,text/plain,text/markdown,application/pdf" multiple onChange={(e) => upload(e.target.files)} /><div className={`upload-dropzone ${dragging ? "dragging" : ""}`} onDragOver={(e) => {
    e.preventDefault();
    setDragging(true);
  }} onDragLeave={() => setDragging(false)} onDrop={(e) => {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files);
  }}><span><Upload size={23} /></span><div><strong>{uploading ? "Reading your material\u2026" : "Drop a little knowledge here"}</strong><p>Text PDFs, .txt, or .md · up to 10 MB each · scanned PDFs need selectable text</p></div><button className="button text" disabled={uploading} onClick={() => inputRef.current?.click()}>Browse files <ArrowUpRight size={15} /></button></div><div className="notes-toolbar"><div className="search-input"><Search size={17} /><input aria-label="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a note or a phrase…" /></div><span>{selectedIds.length} selected for AI</span></div>
    {notes.length ? <div className="note-grid">{notes.map((note) => <article className={`note-card ${selectedIds.includes(note.id) ? "selected" : ""}`} key={note.id}><div className="note-card-top"><span className="note-file-icon"><FileText size={23} /></span><button className={`note-selector ${selectedIds.includes(note.id) ? "selected" : ""}`} aria-label={`${selectedIds.includes(note.id) ? "Unselect" : "Select"} ${note.title} for AI`} aria-pressed={selectedIds.includes(note.id)} onClick={() => select(note.id)}><Check size={13} /></button></div><button className="note-open" onClick={() => openEditor(note)}><h2>{note.title}</h2><p>{note.content.slice(0, 190)}</p></button><div className="note-card-bottom"><span>{note.demo ? "Sample note" : `${Math.round(note.content.length / 5).toLocaleString()} words, approx.`}</span><button className="icon-button" aria-label={`Open ${note.title}`} onClick={() => openEditor(note)}><ArrowUpRight size={17} /></button></div>{note.warnings?.length > 0 && <p className="note-warning">{note.warnings[0]}</p>}</article>)}</div> : state.notes.length ? <EmptyState icon={Search} title="No matching notes" text="Try a different title or phrase." /> : <div className="empty-panel"><EmptyState icon={BookOpen} title="Your notes, with more possibilities." text="Upload a chapter, paste lecture notes, or start with a sample. Then select your material for explanations, quizzes, and cards."><button className="button secondary" onClick={sample}><FlaskConical size={16} /> Add a sample note</button></EmptyState></div>}
    <div className="quiet-info"><FileText size={16} /><p>Notes are stored on this device. Only selected excerpts are sent to OpenAI when you use an AI tool. Export a backup in Settings to keep a copy.</p></div>
    {editor && <Modal title={editor.id ? "Your note" : "A new page of understanding"} description={editor.demo ? "A fixed sample note for exploring the workspace." : void 0} className="note-editor-modal" onClose={() => setEditor(null)}><form onSubmit={save}><label className="field-label" htmlFor="note-title">Title</label><input id="note-title" className="text-input" required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="e.g. Biology — Photosynthesis" /><label className="field-label" htmlFor="note-content">Your notes <span>{content.length.toLocaleString()} / 30,000</span></label><textarea id="note-content" className="text-input note-editor" rows={14} value={content} onChange={(e) => setContent(e.target.value)} maxLength={3e4} required placeholder="Paste your course notes, a chapter excerpt, or your own summary…" /><div className="modal-actions">{editor.id && <button className="button text danger-text" type="button" onClick={() => {
    setDeleting(editor);
    setEditor(null);
  }}><Trash2 size={15} /> Delete</button>}<button className="button secondary" type="button" onClick={() => setEditor(null)}>Cancel</button><button className="button primary" type="submit">Save note <Check size={16} /></button></div></form></Modal>}
    {deleting && <Modal title="Delete this note?" onClose={() => setDeleting(null)}><p className="modal-copy">“{deleting.title}” will be removed from this workspace. Your original file is unaffected.</p><div className="modal-actions"><button className="button secondary" onClick={() => setDeleting(null)}>Keep note</button><button className="button danger" onClick={() => {
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== deleting.id) }));
    setSelectedIds((ids) => ids.filter((id) => id !== deleting.id));
    setDeleting(null);
    onToast("Note deleted.");
  }}>Delete note <Trash2 size={15} /></button></div></Modal>}
  </div>;
}
export {
  Notes as default
};
