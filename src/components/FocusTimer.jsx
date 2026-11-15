import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Clock3, Check } from "lucide-react";
function FocusTimer({ onComplete, todayMinutes, goal }) {
  const [duration, setDuration] = useState(25), [remaining, setRemaining] = useState(1500), [running, setRunning] = useState(false), [finished, setFinished] = useState(false);
  const endAt = useRef(0), onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (!running) return;
    endAt.current = Date.now() + remaining * 1e3;
    let delivered = false;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1e3));
      setRemaining(seconds);
      if (!seconds && !delivered) {
        delivered = true;
        setRunning(false);
        setFinished(true);
        onCompleteRef.current(duration);
      }
    };
    const interval = setInterval(tick, 250);
    tick();
    return () => clearInterval(interval);
  }, [running]);
  const reset = () => {
    setRunning(false);
    setRemaining(duration * 60);
    setFinished(false);
  };
  const toggle = () => {
    if (finished) {
      setRemaining(duration * 60);
      setFinished(false);
    }
    setRunning((v) => !v);
  };
  const progress = 1 - remaining / (duration * 60);
  return <section className="focus-card"><div className="rail-card-label"><span><Clock3 size={15} /> FOCUS SESSION</span><span className={`status-dot ${running ? "active" : ""}`} /></div><div className="timer-face"><svg viewBox="0 0 180 180" aria-hidden="true"><circle className="timer-track" cx="90" cy="90" r="76" /><circle className="timer-progress" cx="90" cy="90" r="76" strokeDasharray="477.52" strokeDashoffset={477.52 * (1 - progress)} /></svg><div><span className="timer-digits">{String(Math.floor(remaining / 60)).padStart(2, "0")}<span>:</span>{String(remaining % 60).padStart(2, "0")}</span><span className="timer-caption">{finished ? "Nicely done." : running ? "One thing at a time." : "Your time to go deeper."}</span></div></div><div className="timer-presets" aria-label="Session duration">{[15, 25, 45].map((min) => <button key={min} className={duration === min ? "active" : ""} disabled={running} onClick={() => {
    setDuration(min);
    setRemaining(min * 60);
    setFinished(false);
  }}>{min} min</button>)}</div><div className="timer-controls"><button className={`button ${running ? "secondary" : "primary"}`} onClick={toggle}>{running ? <Pause size={15} /> : finished ? <Check size={15} /> : <Play size={15} />} {running ? "Pause session" : finished ? "Start another" : "Start focus"}</button><button className="icon-button reset-timer" aria-label="Reset focus timer" title="Reset timer" onClick={reset}><RotateCcw size={17} /></button></div><div className="daily-progress"><span>Today’s focus</span><strong>{todayMinutes}<span> / {goal} min</span></strong><div><i style={{ width: `${Math.min(100, todayMinutes / goal * 100)}%` }} /></div></div></section>;
}
export {
  FocusTimer as default
};
