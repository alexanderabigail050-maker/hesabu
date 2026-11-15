import React, { useRef, useState } from "react";
import { Check, Download, Upload, LogOut, ShieldCheck, HardDrive, Trash2, SlidersHorizontal, ArrowUpRight } from "lucide-react";
import { exportWorkspace, importWorkspace, createInitialState, clearWorkspace } from "../lib/storage.js";
import { Modal, PageHeading, downloadText } from "./ui.jsx";
function Settings({ state, setState, status, onToast, onReplace, onLogout }) {
  const [profile, setProfile] = useState({ ...state.profile }), [clearing, setClearing] = useState(false), [confirm, setConfirm] = useState(""), [importing, setImporting] = useState(null), [error, setError] = useState("");
  const input = useRef(null);
  const backup = () => {
    try {
      downloadText(`hesabu-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`, exportWorkspace(state), "application/json");
      onToast("Your workspace backup is downloading.");
    } catch (e) {
      onToast(e.message);
    }
  };
  const importFile = async (file) => {
    if (!file) return;
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error("Choose a backup smaller than 3 MB.");
      const next = importWorkspace(await file.text());
      setImporting(next);
    } catch (e) {
      onToast(e.message);
    } finally {
      if (input.current) input.current.value = "";
    }
  };
  return <div className="workspace-page settings-page"><PageHeading eyebrow="MAKE IT YOURS" title="A workspace that works for you." text="Your pace, your preferences, your data." /><section className="settings-section"><div className="settings-section-heading"><SlidersHorizontal size={20} /><div><h2>Learning preferences</h2><p>Help your tutor find the right level.</p></div></div><form onSubmit={(e) => {
    e.preventDefault();
    setState((s) => ({ ...s, profile }));
    onToast("Learning preferences saved.");
  }}><div className="form-two-columns"><div><label className="field-label" htmlFor="profile-name">What should we call you?</label><input id="profile-name" className="text-input" maxLength={60} value={profile.name} onChange={(e) => setProfile((v) => ({ ...v, name: e.target.value }))} placeholder="Your first name" /></div><div><label className="field-label" htmlFor="profile-language">Tutor language</label><select id="profile-language" className="text-input" value={profile.language} onChange={(e) => setProfile((v) => ({ ...v, language: e.target.value }))}><option>English</option><option>Kiswahili</option></select></div><div><label className="field-label" htmlFor="profile-level">Learning level</label><select id="profile-level" className="text-input" value={profile.level} onChange={(e) => setProfile((v) => ({ ...v, level: e.target.value }))}><option value="secondary">Secondary school</option><option value="university">University</option><option value="advanced">Advanced</option></select></div><div><label className="field-label" htmlFor="profile-goal">Daily focus goal</label><select id="profile-goal" className="text-input" value={profile.dailyGoal} onChange={(e) => setProfile((v) => ({ ...v, dailyGoal: Number(e.target.value) }))}>{[15, 25, 30, 45, 60, 90, 120].map((n) => <option value={n} key={n}>{n} minutes</option>)}</select></div></div><div className="modal-actions"><button className="button primary" type="submit">Save preferences <Check size={16} /></button></div></form></section><section className="settings-section"><div className="settings-section-heading"><HardDrive size={20} /><div><h2>Your local workspace</h2><p>Take your learning with you.</p></div></div><p className="settings-copy">Conversations, notes, cards, and progress stay in this browser. They do not sync between devices. Download a backup before clearing browser data or switching devices.</p><div className="settings-data-stats"><span><strong>{state.conversations.length}</strong>conversations</span><span><strong>{state.notes.length}</strong>notes</span><span><strong>{state.flashcards.length}</strong>cards</span></div><div className="button-row"><button className="button secondary" onClick={backup}><Download size={16} /> Export backup</button><button className="button secondary" onClick={() => input.current?.click()}><Upload size={16} /> Restore backup</button><input type="file" accept=".json,application/json" ref={input} className="visually-hidden" onChange={(e) => importFile(e.target.files[0])} /></div></section><section className="settings-section"><div className="settings-section-heading"><ShieldCheck size={20} /><div><h2>Your AI connection</h2><p>{status?.model || "gpt-5.6-sol"}</p></div></div><div className="connection-detail"><span className={`connection-dot ${status?.ready ? "ready" : ""}`} /><div><strong>{status?.ready ? status.authenticated ? "Connected and unlocked" : "Connected \xB7 study code required" : "Preview mode"}</strong><p>{status?.ready ? "Your AI requests pass through the secure server. The API key is never stored in this browser." : "Your server\u2019s OpenAI connection is not configured. Sample content and local study tools are available."}</p></div>{status?.authenticated && <button className="button secondary" onClick={onLogout}><LogOut size={15} /> Lock AI</button>}</div><p className="fine-print">When you ask the tutor or generate a study set, your recent messages and selected note excerpts are sent to OpenAI. AI may make mistakes. Check important material against your course sources.</p></section><section className="settings-section danger-section"><div><h2>Start fresh</h2><p>Remove the study data saved in this browser.</p></div><button className="button text danger-text" onClick={() => setClearing(true)}><Trash2 size={16} /> Clear workspace</button></section>
    {clearing && <Modal title="Start with a clean page?" onClose={() => {
    setClearing(false);
    setConfirm("");
    setError("");
  }}><p className="modal-copy">This removes your notes, chats, cards, and progress from this browser. Export a backup first if you want to keep them.</p><label className="field-label" htmlFor="confirm-clear">Type CLEAR to continue</label><input id="confirm-clear" className="text-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />{error && <p className="inline-error">{error}</p>}<div className="modal-actions"><button className="button secondary" onClick={backup}>Export first</button><button className="button danger" disabled={confirm !== "CLEAR"} onClick={() => {
    try {
      clearWorkspace();
      onReplace(createInitialState());
      setClearing(false);
      onToast("Your workspace is ready for a fresh start.");
    } catch (e) {
      setError(e.message);
    }
  }}>Clear workspace</button></div></Modal>}
    {importing && <Modal title="Restore this workspace?" onClose={() => setImporting(null)}><p className="modal-copy">This backup contains {importing.conversations.length} conversations, {importing.notes.length} notes, and {importing.flashcards.length} cards. Restoring it replaces the current local workspace.</p><div className="modal-actions"><button className="button secondary" onClick={backup}>Back up current data</button><button className="button primary" onClick={() => {
    onReplace(importing);
    setImporting(null);
    onToast("Your backup has been restored.");
  }}>Restore backup <Check size={16} /></button></div></Modal>}
  </div>;
}
export {
  Settings as default
};
