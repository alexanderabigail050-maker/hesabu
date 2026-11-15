import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, MessageSquareText, Brain, Layers3, CalendarDays, FileText, Settings2, ChevronDown, PanelLeftClose, Menu, ArrowUp, ArrowRight, ArrowUpRight, Sparkles, Lightbulb, Waypoints, AudioLines, AlignLeft, Paperclip, X, Check, Copy, Download, Square, RotateCcw, LoaderCircle, LockKeyhole, CheckCircle2, AlertCircle, Trash2, Compass, ChevronRight, Command, ShieldCheck } from "lucide-react";
import { createInitialState, loadState, saveState } from "./lib/storage.js";
import { getStats } from "./lib/learning.js";
import { getStatus, login, logout, streamChat, generateStudy } from "./lib/api.js";
import { DEMO_RESPONSE, DEMO_TOPIC } from "./data/demo.js";
import { Mark, Modal, SourcePicker, downloadText } from "./components/ui.jsx";
import Markdown from "./components/Markdown.jsx";
import FocusTimer from "./components/FocusTimer.jsx";
import Practice from "./components/Practice.jsx";
import Flashcards from "./components/Flashcards.jsx";
import StudyPlan from "./components/StudyPlan.jsx";
import Notes from "./components/Notes.jsx";
import Settings from "./components/Settings.jsx";
const MODES = [{ id: "explain", label: "Explain it", icon: Lightbulb, description: "Make a difficult idea feel simple." }, { id: "socratic", label: "Guide me", icon: Waypoints, description: "Find the answer, one good question at a time." }, { id: "teachback", label: "Teach back", icon: AudioLines, description: "Explain what you know. Find what\u2019s missing." }, { id: "summarize", label: "Summarise", icon: AlignLeft, description: "Find the signal in your notes." }];
const NAV = [{ id: "learn", label: "Learn", icon: MessageSquareText }, { id: "practice", label: "Practice", icon: Brain }, { id: "flashcards", label: "Flashcards", icon: Layers3 }, { id: "plan", label: "Study plan", icon: CalendarDays }, { id: "notes", label: "My notes", icon: FileText }];
const VIEW_TITLES = { learn: "Learning workspace", practice: "Practice studio", flashcards: "Memory space", plan: "Study roadmap", notes: "Your notes", settings: "Preferences" };
const PROMPTS = [{ label: "Understand a concept", text: "Help me understand photosynthesis. Start with the big picture, then explain it in simple steps.", icon: Lightbulb, detail: "Break the complicated into clear." }, { label: "Find the gaps", text: "I want to learn by teaching back. Ask me which topic I would like to explain, then help me find the gaps in my understanding.", mode: "teachback", icon: AudioLines, detail: "See what you really understand." }, { label: "Make a study plan", view: "plan", icon: CalendarDays, detail: "Give your next exam a clear path." }];
function useToast() {
  const [toast, setToast] = useState(null), timer = useRef(null);
  const notify = useCallback((message) => {
    clearTimeout(timer.current);
    setToast({ message, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), 6e3);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [toast, notify, () => setToast(null)];
}
function App() {
  const [initial] = useState(() => {
    try {
      const saved = loadState();
      saved.conversations = saved.conversations.map((c) => ({ ...c, messages: c.messages.map((m) => m.status === "streaming" ? { ...m, status: "stopped", stopped: true } : m) }));
      return { state: saved, error: "" };
    } catch (error) {
      return { state: createInitialState(), error: error.message };
    }
  });
  const [state, setState] = useState(initial.state), [view, setView] = useState("learn"), [currentId, setCurrentId] = useState(null), [mode, setMode] = useState("explain"), [input, setInput] = useState(""), [sidebarOpen, setSidebarOpen] = useState(false), [sidebarCollapsed, setSidebarCollapsed] = useState(false), [sourcePicker, setSourcePicker] = useState(false), [selectedIds, setSelectedIds] = useState([]), [sourceOnly, setSourceOnly] = useState(false), [searchOpen, setSearchOpen] = useState(false), [query, setQuery] = useState(""), [status, setStatus] = useState({ ready: false, model: "gpt-5.6-sol", authRequired: true, authenticated: false }), [statusLoading, setStatusLoading] = useState(true), [busy, setBusy] = useState(false), [authOpen, setAuthOpen] = useState(false), [password, setPassword] = useState(""), [authBusy, setAuthBusy] = useState(false), [authError, setAuthError] = useState(""), [storageWarning, setStorageWarning] = useState(initial.error), [storageEnabled, setStorageEnabled] = useState(!initial.error), [deleteId, setDeleteId] = useState(null), [focusOpen, setFocusOpen] = useState(false);
  const [toast, notify, clearToast] = useToast();
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 3e4);
    return () => clearInterval(timer);
  }, []);
  const controllerRef = useRef(null), authResolveRef = useRef(null), inputRef = useRef(null), chatEndRef = useRef(null), scrollRef = useRef(null), autoscrollRef = useRef(true), latestStateRef = useRef(state), storageEnabledRef = useRef(storageEnabled);
  latestStateRef.current = state;
  storageEnabledRef.current = storageEnabled;
  const conversation = state.conversations.find((c) => c.id === currentId) || null;
  const stats = useMemo(() => getStats(state, clock), [state, clock]);
  const selectedNotes = state.notes.filter((n) => selectedIds.includes(n.id));
  const currentMode = MODES.find((m) => m.id === mode) || MODES[0];
  const displayName = state.profile.name.trim();
  const loadStatus = useCallback(async () => {
    try {
      const result = await getStatus();
      setStatus(result);
      return result;
    } catch (error) {
      setStatus({ ready: false, model: "gpt-5.6-sol", authRequired: true, authenticated: false, reason: "The AI connection could not be reached." });
      return null;
    } finally {
      setStatusLoading(false);
    }
  }, []);
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);
  useEffect(() => {
    const flush = () => {
      if (!storageEnabledRef.current) return;
      try {
        saveState(latestStateRef.current);
      } catch {
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  useEffect(() => {
    if (!storageEnabled) return;
    const timer = setTimeout(() => {
      try {
        saveState(state);
        setStorageWarning("");
      } catch (error) {
        setStorageWarning(error.message);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [state, storageEnabled]);
  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "auto";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 180)}px`;
  }, [input]);
  useEffect(() => {
    if (autoscrollRef.current && conversation?.messages.length) chatEndRef.current?.scrollIntoView({ behavior: busy ? "instant" : "smooth", block: "end" });
  }, [conversation?.messages, busy]);
  useEffect(() => {
    autoscrollRef.current = true;
  }, [currentId]);
  useEffect(() => () => {
    controllerRef.current?.abort();
    authResolveRef.current?.(false);
  }, []);
  const navigate = (id) => {
    setView(id);
    setSidebarOpen(false);
    if (id === "settings") setFocusOpen(false);
  };
  const newSession = () => {
    setCurrentId(null);
    setView("learn");
    setInput("");
    setMode("explain");
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 30);
  };
  const learn = (prompt) => {
    setCurrentId(null);
    setView("learn");
    setMode("explain");
    setInput(prompt);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 40);
  };
  const openConversation = (c) => {
    setCurrentId(c.id);
    setMode(c.mode || "explain");
    setView("learn");
    setInput("");
    setSidebarOpen(false);
  };
  const sample = () => {
    if (state.conversations.length >= 60) {
      notify("Your workspace has 60 conversations. Export a backup and delete an older conversation to make room.");
      return;
    }
    const now = Date.now(), id = crypto.randomUUID();
    const item = { id, title: "Making sense of photosynthesis", mode: "explain", demo: true, createdAt: now, updatedAt: now, messages: [{ id: crypto.randomUUID(), role: "user", content: "Explain photosynthesis simply. Help me see how the pieces fit together.", createdAt: now, demo: true }, { id: crypto.randomUUID(), role: "assistant", content: DEMO_RESPONSE, createdAt: now, demo: true }] };
    setState((s) => ({ ...s, conversations: [item, ...s.conversations] }));
    setCurrentId(id);
    setMode("explain");
    setView("learn");
    setInput("");
    setSidebarOpen(false);
  };
  const cancelAuth = () => {
    setAuthOpen(false);
    setPassword("");
    setAuthError("");
    authResolveRef.current?.(false);
    authResolveRef.current = null;
  };
  const ensureAI = async () => {
    let current = status;
    if (statusLoading) current = await loadStatus();
    if (!current?.ready) {
      notify("The AI connection is not configured yet. You can explore the sample session and use the local study tools.");
      return false;
    }
    if (!current.authRequired || current.authenticated) return true;
    if (authResolveRef.current) return false;
    setAuthOpen(true);
    setAuthError("");
    return new Promise((resolve) => {
      authResolveRef.current = resolve;
    });
  };
  const unlock = async (e) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      await login(password);
      const next = await getStatus();
      setStatus(next);
      if (!next.authenticated) throw new Error("The session could not be verified. Please try again.");
      setAuthOpen(false);
      setPassword("");
      authResolveRef.current?.(true);
      authResolveRef.current = null;
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  };
  const getSources = () => {
    let remaining = 3e4;
    return selectedNotes.map((n) => {
      const text = n.content.slice(0, Math.min(12e3, remaining));
      remaining -= text.length;
      return { id: n.id, title: n.title, content: text };
    }).filter((n) => n.content);
  };
  const payloadBase = () => ({ level: state.profile.level, language: state.profile.language, notes: getSources(), sourceOnly });
  const prepareHistory = (messages) => {
    const result = messages.filter((m) => !m.error && m.content.trim()).map(({ role, content }) => ({ role, content: content.slice(0, 12e3) })).slice(-24);
    let total = result.reduce((a, m) => a + m.content.length, 0);
    while (total > 36e3 && result.length > 1) total -= result.shift().content.length;
    return result;
  };
  const send = async (text = input, { retry = false } = {}) => {
    const value = text.trim();
    if (!value || busy) return;
    if (sourceOnly && !selectedNotes.length) {
      notify("Select at least one note to use \u201COnly my notes\u201D.");
      setSourcePicker(true);
      return;
    }
    if (!await ensureAI()) return;
    if (!conversation && state.conversations.length >= 60) {
      notify("Your workspace has 60 conversations. Export a backup and delete an older conversation before starting a new one.");
      return;
    }
    const now = Date.now(), id = conversation?.id || crypto.randomUUID(), assistantId = crypto.randomUUID();
    const base = retry ? (conversation?.messages || []).slice(0, -2) : conversation?.messages || [];
    if (base.length >= 98) {
      notify("This conversation is full. Start a new session to continue learning.");
      return;
    }
    const userMessage = { id: crypto.randomUUID(), role: "user", content: value.slice(0, 6e3), createdAt: now }, assistantMessage = { id: assistantId, role: "assistant", content: "", createdAt: now, status: "streaming" };
    const item = { ...conversation || {}, id, title: conversation?.title || value.slice(0, 52), createdAt: conversation?.createdAt || now, updatedAt: now, mode, messages: [...base, userMessage, assistantMessage], demo: false };
    setState((s) => ({ ...s, conversations: [item, ...s.conversations.filter((c) => c.id !== id)] }));
    setCurrentId(id);
    setInput("");
    setBusy(true);
    autoscrollRef.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    const updateAssistant = (patch) => setState((s) => ({ ...s, conversations: s.conversations.map((c) => c.id !== id ? c : { ...c, updatedAt: Date.now(), messages: c.messages.map((m) => m.id !== assistantId ? m : { ...m, ...typeof patch === "function" ? patch(m) : patch }) }) }));
    try {
      await streamChat({ ...payloadBase(), messages: prepareHistory([...base, userMessage]), mode }, { signal: controller.signal, onDelta: (delta) => updateAssistant((m) => ({ content: m.content + delta })) });
      updateAssistant({ status: "complete" });
    } catch (error) {
      if (controller.signal.aborted) updateAssistant({ stopped: true, status: "stopped" });
      else {
        updateAssistant({ error: error.message, status: "error" });
        if (error.status === 401) {
          setStatus((s) => ({ ...s, authenticated: false }));
        }
        notify(error.message);
      }
    } finally {
      setBusy(false);
      controllerRef.current = null;
    }
  };
  const generate = async (request) => {
    if (sourceOnly && !selectedNotes.length) {
      notify("Select at least one note to use \u201COnly my notes\u201D.");
      setSourcePicker(true);
      return null;
    }
    if (!await ensureAI()) return null;
    try {
      return await generateStudy({ ...payloadBase(), ...request });
    } catch (error) {
      if (error.status === 401) setStatus((s) => ({ ...s, authenticated: false }));
      throw error;
    }
  };
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      notify("Copied to clipboard.");
    } catch {
      notify("Your browser could not copy this text. Select the text to copy it manually.");
    }
  };
  const exportChat = () => {
    if (!conversation) return;
    downloadText(`hesabu-${conversation.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 45) || "conversation"}.md`, `# ${conversation.title}

${conversation.messages.map((m) => `## ${m.role === "user" ? "You" : "Hesabu AI"}${m.demo ? " (fixed sample)" : ""}

${m.content}${m.error ? `

Response error: ${m.error}` : ""}${m.stopped ? "\n\nResponse stopped by learner." : ""}`).join("\n\n---\n\n")}`);
  };
  const completedFocus = (minutes) => {
    if (state.focusSessions.length >= 2e3) {
      notify("Focus complete. Your session history is full, so this session was not saved. Export a backup before starting a fresh workspace.");
      return;
    }
    setState((s) => ({ ...s, focusSessions: [{ id: crypto.randomUUID(), createdAt: Date.now(), minutes }, ...s.focusSessions] }));
    notify(`${minutes} minutes of focus. That\u2019s a step forward.`);
  };
  const replaceWorkspace = (next) => {
    setState(next);
    setStorageEnabled(true);
    setStorageWarning("");
    setSelectedIds([]);
    setCurrentId(null);
    setView("learn");
  };
  const todayLabel = (/* @__PURE__ */ new Date()).toLocaleDateString(void 0, { weekday: "long", month: "short", day: "numeric" });
  const composer = <div className={`composer-block ${conversation ? "chat-composer-block" : ""}`}><div className="composer" onClick={() => inputRef.current?.focus()}><textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={6e3} rows={2} placeholder={mode === "teachback" ? "Explain a concept in your own words\u2026" : mode === "summarize" ? "Paste your notes, or ask for the key ideas\u2026" : mode === "socratic" ? "What would you like to work through together?" : "Ask anything. Make sense of everything."} aria-label="Your question" onKeyDown={(e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }} /><div className="composer-toolbar"><div className="composer-tools"><button className={`composer-attach ${selectedNotes.length ? "has-notes" : ""}`} aria-label="Choose notes to attach" title="Use your notes" onClick={(e) => {
    e.stopPropagation();
    setSourcePicker(true);
  }}><Paperclip size={17} />{selectedNotes.length > 0 && <span>{selectedNotes.length}</span>}</button><span className="composer-divider" /><span className="composer-mode"><currentMode.icon size={14} />{currentMode.label}</span>{sourceOnly && <span className="notes-only-badge">Notes only</span>}</div><div className="composer-submit"><span className="enter-hint">{input.length > 5600 ? `${input.length}/6,000` : "\u21B5 to send"}</span>{busy ? <button className="send-button stop" aria-label="Stop response" onClick={(e) => {
    e.stopPropagation();
    controllerRef.current?.abort();
  }}><Square size={15} fill="currentColor" /></button> : <button className="send-button" aria-label="Send message" disabled={!input.trim() || statusLoading} onClick={(e) => {
    e.stopPropagation();
    send();
  }}><ArrowUp size={20} /></button>}</div></div></div><div className="composer-caption"><span>{selectedNotes.length ? `${selectedNotes.length} ${selectedNotes.length === 1 ? "note" : "notes"} selected \xB7 excerpt context` : "A little curiosity goes a long way."}</span><span>{conversation ? "Uses recent messages \xB7 verify important answers" : "Your pace. Your way."}</span></div></div>;
  return <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${sidebarOpen ? "mobile-sidebar-open" : ""}`}>
    <a className="skip-link" href="#main-content">Skip to learning workspace</a>
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className="sidebar" aria-label="Main navigation"><div className="sidebar-brand"><button className="brand-button" onClick={newSession} aria-label="Hesabu AI home"><Mark size={30} /><span>hesabu<span>ai</span></span></button><button className="icon-button sidebar-collapse" title="Collapse sidebar" aria-label="Collapse sidebar" onClick={() => {
    setSidebarCollapsed(true);
    setSidebarOpen(false);
  }}><PanelLeftClose size={17} /></button><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={20} /></button></div><button className="new-session" onClick={newSession}><Plus size={18} /><span>New session</span><kbd>＋</kbd></button><button className="sidebar-search" onClick={() => setSearchOpen(true)}><Search size={17} /><span>Search anything</span><kbd>⌘ K</kbd></button><p className="sidebar-section-title">YOUR WORKSPACE</p><nav className="main-navigation">{NAV.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><item.icon size={19} /><span>{item.label}</span>{item.id === "flashcards" && stats.dueCards > 0 && <span className="nav-count">{stats.dueCards}</span>}{view === item.id && <span className="nav-active-dot" />}</button>)}</nav><div className="sidebar-recents"><div className="sidebar-section-title"><span>RECENT SESSIONS</span>{state.conversations.length > 0 && <button aria-label="Search recent sessions" onClick={() => setSearchOpen(true)}><Search size={13} /></button>}</div>{state.conversations.length ? state.conversations.slice(0, 7).map((c) => <div key={c.id} className={`recent-item ${currentId === c.id && view === "learn" ? "active" : ""}`}><button onClick={() => openConversation(c)} title={c.title}><span className="recent-dot" />{c.title}</button><button className="delete-conversation" aria-label={`Delete ${c.title}`} onClick={() => setDeleteId(c.id)}><X size={13} /></button></div>) : <div className="recents-empty">Good questions belong here.<br />Your first session is a click away.</div>}</div><div className="sidebar-bottom"><button className="sidebar-study-tip" onClick={() => navigate("flashcards")}><span className="tip-icon"><Sparkles size={16} /></span><span><strong>Little steps. Lasting progress.</strong><small>Make room for a daily review.</small></span><ArrowUpRight size={14} /></button><button className={`profile-button ${view === "settings" ? "active" : ""}`} onClick={() => navigate("settings")}><span className="profile-avatar">{displayName ? displayName.charAt(0).toUpperCase() : <span>h<span>↗</span></span>}</span><span><strong>{displayName || "Your learning space"}</strong><small>Local workspace</small></span><Settings2 size={17} /></button></div></aside>
    <div className="main-shell"><header className="topbar"><div className="topbar-start"><button className="icon-button menu-button" onClick={() => {
    if (window.innerWidth <= 900) setSidebarOpen(true);
    else setSidebarCollapsed((v) => !v);
  }} aria-label="Open navigation"><Menu size={20} /></button><span className="breadcrumb-label">{VIEW_TITLES[view]}</span><span className="topbar-divider" /><span className="model-label"><span className={`model-dot ${status.ready ? "live" : ""}`} />{status.model === "gpt-5.6-sol" ? "GPT-5.6 Sol" : status.model}{!status.ready && <small>{statusLoading ? "Checking" : "Preview"}</small>}</span></div><div className="topbar-actions"><button className="topbar-search icon-button" aria-label="Search workspace" onClick={() => setSearchOpen(true)}><Search size={18} /></button><button className="focus-mobile-button button subtle" onClick={() => setFocusOpen((v) => !v)}><Compass size={16} /> Focus</button><span className="private-indicator"><ShieldCheck size={14} /><span>Your space to learn</span></span><button className="topbar-avatar" aria-label="Open preferences" onClick={() => navigate("settings")}>{displayName ? displayName[0].toUpperCase() : "Y"}</button></div></header>
      {storageWarning && <div className="storage-banner" role="alert"><AlertCircle size={16} /><span>Local save paused. {storageWarning}</span><button onClick={() => navigate("settings")}>Manage data</button></div>}
      <div className={`content-layout ${view === "learn" ? "with-rail" : ""}`}><main id="main-content" className={`main-content ${view === "learn" ? "learn-content" : ""}`} ref={scrollRef} onScroll={(e) => {
    const node = e.currentTarget;
    autoscrollRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 180;
  }}>
        {view === "learn" && <div className={`learn-page ${conversation ? "has-conversation" : "welcome-page"}`}>
          {!conversation ? <><div className="welcome-intro"><span className="welcome-eyebrow"><span />A CLEARER WAY TO LEARN</span><div className="hero-symbol"><Mark size={66} /><i className="symbol-satellite one" /><i className="symbol-satellite two" /></div><h1>Make it <span>click.</span></h1><p>{displayName ? `A little clarity, ${displayName}. A lot of possibility.` : "A little clarity. A lot of possibility."}<br /><span>Your personal space to understand, practise, and grow.</span></p></div><div className="mode-tabs" aria-label="Learning mode">{MODES.map((item) => <button key={item.id} className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)} title={item.description} aria-pressed={mode === item.id}><item.icon size={16} />{item.label}</button>)}</div>{composer}<div className="starter-prompts">{PROMPTS.map((p, i) => <button key={i} onClick={() => {
    if (p.view) navigate(p.view);
    else {
      setInput(p.text);
      setMode(p.mode || "explain");
      inputRef.current?.focus();
    }
  }}><p.icon size={18} /><strong>{p.label}</strong><span>{p.detail}</span><ArrowUpRight size={15} className="prompt-arrow" /></button>)}</div><div className="explore-sample"><span>Curious how it feels?</span><button onClick={sample}>Explore a sample session <ArrowRight size={14} /></button></div><div className="learning-loop"><span>UNDERSTAND</span><i /><span>PRACTISE</span><i /><span>REMEMBER</span></div></> : <><div className="conversation-heading"><div><span className="eyebrow">{conversation.demo ? "SAMPLE SESSION" : "YOUR LEARNING SESSION"}</span><h1>{conversation.title}</h1></div><button className="icon-button" title="Download conversation" aria-label="Download conversation as Markdown" onClick={exportChat}><Download size={18} /></button></div>{conversation.demo && <div className="sample-notice"><FlaskIcon /><span>This is a fixed sample, created to show the learning experience. New questions use your configured AI connection.</span></div>}<div className="chat-messages">{conversation.messages.map((message, i) => <article className={`message ${message.role === "user" ? "user-message" : "assistant-message"}`} key={message.id}><div className="message-avatar">{message.role === "assistant" ? <Mark size={22} /> : <span>{displayName ? displayName[0].toUpperCase() : "Y"}</span>}</div><div className="message-body"><div className="message-label"><strong>{message.role === "user" ? "You" : "Hesabu"}</strong>{message.role === "assistant" && <span>{message.demo ? "Fixed sample" : message.error ? "Response interrupted" : currentMode.label}</span>}</div>{message.content ? <Markdown text={message.content} /> : busy && i === conversation.messages.length - 1 ? <div className="thinking-state" role="status"><span /><span /><span /><small>Making the pieces fit…</small></div> : null}{message.stopped && <p className="message-status"><Square size={12} /> Response stopped. You can send another question.</p>}{message.error && <div className="message-error"><AlertCircle size={16} /><span>{message.error}</span></div>}{message.role === "assistant" && (!busy || i !== conversation.messages.length - 1) && <div className="message-actions">{message.content && <button aria-label="Copy response" title="Copy response" onClick={() => copy(message.content)}><Copy size={15} /></button>}{i === conversation.messages.length - 1 && <><button title="Try again" aria-label="Retry response" onClick={() => send(conversation.messages[i - 1]?.content || "", { retry: true })}><RotateCcw size={15} /></button>{message.content && !message.error && <button className="message-followup" onClick={() => {
    setInput("Ask me one question to check whether I understood that.");
    inputRef.current?.focus();
  }}><Brain size={14} /> Check my understanding</button>}</>}</div>}</div></article>)}</div><div ref={chatEndRef} /><div className="chat-bottom"><div className="conversation-mode-tabs">{MODES.map((item) => <button className={mode === item.id ? "active" : ""} key={item.id} onClick={() => setMode(item.id)} title={item.description}><item.icon size={14} />{item.label}</button>)}</div>{composer}</div></>}
        </div>}
        {view === "practice" && <Practice state={state} setState={setState} generate={generate} onSources={() => setSourcePicker(true)} selectedCount={selectedNotes.length} onLearn={learn} onToast={notify} />}
        {view === "flashcards" && <Flashcards state={state} setState={setState} generate={generate} onSources={() => setSourcePicker(true)} selectedCount={selectedNotes.length} onToast={notify} />}
        {view === "plan" && <StudyPlan state={state} setState={setState} onToast={notify} onLearn={learn} />}
        {view === "notes" && <Notes state={state} setState={setState} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onToast={notify} onLearn={learn} />}
        {view === "settings" && <Settings state={state} setState={setState} status={status} onToast={notify} onReplace={replaceWorkspace} onLogout={async () => {
    try {
      await logout();
      setStatus((s) => ({ ...s, authenticated: false }));
      notify("AI locked. Your local study tools are still available.");
    } catch (error) {
      notify(error.message);
    }
  }} />}
      </main>
      <aside className={`focus-rail ${view !== "learn" ? "rail-hidden" : ""} ${focusOpen ? "mobile-focus-open" : ""}`} aria-label="Today’s focus"><div className="rail-heading"><div><span className="eyebrow">A LITTLE EVERY DAY</span><h2>Today’s focus</h2><p>{todayLabel}</p></div><button className="icon-button mobile-close" aria-label="Close focus panel" onClick={() => setFocusOpen(false)}><X size={20} /></button></div><FocusTimer onComplete={completedFocus} todayMinutes={stats.todayFocusMinutes} goal={state.profile.dailyGoal} /><section className="next-step-card"><div className="rail-section-heading"><h3>Your next small step</h3><ArrowUpRight size={15} /></div>{stats.weakTopics.length ? <><p>A little attention here could help.</p>{stats.weakTopics.slice(0, 2).map((t) => <button key={t.topic} onClick={() => learn(`Help me revisit ${t.topic}. Start simply, then test my understanding with one question.`)}><span className="step-count"><Brain size={14} /></span><span>{t.topic}<small>{t.correct}/{t.total} correct in practice</small></span><ChevronRight size={14} /></button>)}</> : <><p>Start where you are. Build from there.</p><button onClick={() => navigate("notes")}><span className="step-count">01</span><span>Bring your notes<small>Your knowledge, connected.</small></span><ChevronRight size={14} /></button><button onClick={() => navigate("practice")}><span className="step-count">02</span><span>Test one idea<small>Find out what’s sticking.</small></span><ChevronRight size={14} /></button></>}{stats.dueCards > 0 && <button onClick={() => navigate("flashcards")}><span className="step-count"><Layers3 size={14} /></span><span>{stats.dueCards} cards ready<small>A quick refresh for your memory.</small></span><ChevronRight size={14} /></button>}</section><div className="rail-micro-stats"><div><strong>{stats.questionsAnswered}</strong><span>questions answered</span></div><div><strong>{stats.focusMinutes}<small>m</small></strong><span>total focus</span></div></div><div className="rail-footnote"><Mark size={17} /><p>Understanding is a process.<br />You’re in the right place.</p></div></aside>
      </div>
    </div>
    {toast && <div className="toast" role="status" key={toast.id}><CheckCircle2 size={18} /><span>{toast.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={clearToast}><X size={15} /></button></div>}
    {sourcePicker && <SourcePicker notes={state.notes} selectedIds={selectedIds} setSelectedIds={setSelectedIds} sourceOnly={sourceOnly} setSourceOnly={setSourceOnly} onClose={() => setSourcePicker(false)} onAdd={() => navigate("notes")} onToast={notify} />}
    {authOpen && <Modal title="Unlock your learning companion" description="Enter your shared study code to use the AI tools." onClose={cancelAuth} className="auth-modal"><div className="auth-symbol"><LockKeyhole size={28} /></div><form onSubmit={unlock}><label className="field-label" htmlFor="study-code">Study access code</label><input id="study-code" className="text-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required maxLength={500} placeholder="Enter your study code" />{authError && <p className="inline-error" role="alert">{authError}</p>}<p className="fine-print">Get this code from the person who set up your workspace. Your question will continue after you unlock.</p><div className="modal-actions"><button className="button secondary" type="button" onClick={cancelAuth}>Maybe later</button><button className="button primary" disabled={authBusy || !password} type="submit">{authBusy ? <LoaderCircle className="spinning" size={16} /> : <LockKeyhole size={16} />} {authBusy ? "Unlocking\u2026" : "Unlock AI"}</button></div></form></Modal>}
    {searchOpen && <Modal title="Find your next thought" className="search-modal" onClose={() => {
    setSearchOpen(false);
    setQuery("");
  }}><div className="search-input command-search"><Search size={20} /><input aria-label="Search conversations and notes" placeholder="Search conversations, notes, and tools…" value={query} onChange={(e) => setQuery(e.target.value)} /><kbd>ESC</kbd></div><div className="command-results">{NAV.filter((n) => !query || n.label.toLowerCase().includes(query.toLowerCase())).map((n) => <button key={n.id} onClick={() => {
    navigate(n.id);
    setSearchOpen(false);
    setQuery("");
  }}><n.icon size={18} /><span>{n.label}<small>Workspace</small></span><ArrowRight size={16} /></button>)}{state.conversations.filter((c) => !query || `${c.title} ${c.messages.map((m) => m.content).join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6).map((c) => <button key={c.id} onClick={() => {
    openConversation(c);
    setSearchOpen(false);
    setQuery("");
  }}><MessageSquareText size={18} /><span>{c.title}<small>Conversation</small></span><ArrowRight size={16} /></button>)}{state.notes.filter((n) => query && `${n.title} ${n.content}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5).map((n) => <button key={n.id} onClick={() => {
    navigate("notes");
    setSearchOpen(false);
    setQuery("");
  }}><FileText size={18} /><span>{n.title}<small>Note</small></span><ArrowRight size={16} /></button>)}{query && !NAV.some((n) => n.label.toLowerCase().includes(query.toLowerCase())) && !state.conversations.some((c) => `${c.title} ${c.messages.map((m) => m.content).join(" ")}`.toLowerCase().includes(query.toLowerCase())) && !state.notes.some((n) => `${n.title} ${n.content}`.toLowerCase().includes(query.toLowerCase())) && <p className="small-empty">No matches yet. Try another word or phrase.</p>}</div><div className="command-footer">Search stays on this device.<span>Hesabu AI</span></div></Modal>}
    {deleteId && <Modal title="Delete this conversation?" onClose={() => setDeleteId(null)}><p className="modal-copy">This removes the conversation from this browser. Export it first if you want to keep a copy.</p><div className="modal-actions"><button className="button secondary" onClick={() => setDeleteId(null)}>Keep conversation</button><button className="button danger" onClick={() => {
    setState((s) => ({ ...s, conversations: s.conversations.filter((c) => c.id !== deleteId) }));
    if (currentId === deleteId) setCurrentId(null);
    setDeleteId(null);
    notify("Conversation deleted.");
  }}><Trash2 size={15} /> Delete</button></div></Modal>}
  </div>;
}
function FlaskIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M9 3h6M10 3v6l-6 10a1.5 1.5 0 0 0 1.3 2h13.4A1.5 1.5 0 0 0 20 19L14 9V3M7 15h10" /></svg>;
}
export {
  App as default
};
