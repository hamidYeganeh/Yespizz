"use client";
// Adapted from Bencho (MIT), https://bencho.dev/licence
import "./voice-note.css";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon, Send, X } from "@repo/icons";

/* ══ Voice note ═══════════════════════════════════════════
   Hold to record. The pill opens into a bar and the level
   rises in it as bars, newest on the right. Let go and the
   recording becomes a clip: press play and the bars light up
   as the playhead passes them, drag across them to scrub.
   Slide left while holding and it is thrown away — the bars
   collapse and the pill closes back to where it started.

   ── ORIGINAL BENCHO CONCEPT (before microphone integration) ───────────────────────
   Nothing listens. The level is a stand-in shaped like speech —
   syllables inside phrases, with pauses — so the block is about
   the gesture and the shapes, and asks nobody for a microphone.

   ── THE PLAYHEAD IS A NUMBER, NOT A RENDER ──────────────
   Progress is one CSS variable on the wave, and each bar
   decides its own brightness from it and its index in calc().
   Playing costs no React renders at all. */

/* 56 tall and 17px type, the Slide to confirm pill's size, so the
   pills on the wall read as one family */
const H = 56;
const IDLE_W = 216;
const OPEN_W = 300;
/* one bar per sample while recording */
const SAMPLE = 70;
/* pointer travel, in px, that throws the recording away */
const CANCEL = 90;
/* shorter than this is a tap, not a recording */
const MIN_MS = 500;
const MAX_MS = 30000;

type Phase = "idle" | "rec" | "cancel" | "clip";
type Clip = { raw: number[]; ms: number; blob: Blob };

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* n bars from however many samples, each the loudest it covers */
function resample(src: number[], n: number) {
  if (!src.length) return Array(n).fill(0);
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * src.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * src.length) / n));
    let m = 0;
    for (let k = a; k < b && k < src.length; k++) m = Math.max(m, src[k]!);
    return m;
  });
}

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/* ── play into pause, drawn ─────────────────────────────────
   The same two quadrilaterals, wound the same way: the pause's
   bars, and the play triangle split down its own axis. */
function PlayMark({ on }: { on: boolean }) { return <Icon name={on ? "pause" : "play"} size={20} />; }
function MicMark() { return <Icon name="microphone" size={21} />; }

export function VoiceNote({
  /* how many bars the wave is drawn with */
  bars = 28, onSend,
  /* how tall a given level draws, 0..100 */
  gain = 60,
  /* how far the pill overshoots as it opens and closes, 0..100 */
  bounce = 40,
  corner = H / 2,
}: {
  onSend: (blob: Blob) => void;
  bars?: number;
  gain?: number;
  bounce?: number;
  corner?: number;
}) {
  const t = useTranslations("Application.settings");
  const capture = useRef<MediaRecorder | null>(null);
  const context = useRef<AudioContext | null>(null);
  const request = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [failed, setFailed] = useState(false);
  function freeInput() {
    const rec = capture.current;
    if (rec?.state === "recording") rec.stop();
    rec?.stream.getTracks().forEach(track => track.stop());
    capture.current = null;
    if (context.current) void context.current.close().catch(() => {});
    context.current = null;
  }
  const [phase, setPhase] = useState<Phase>("idle");
  const [levels, setLevels] = useState<number[]>([]);
  const [ms, setMs] = useState(0);
  const [clip, setClip] = useState<Clip | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);

  const ph = useRef<Phase>("idle");
  const raw = useRef<number[]>([]);
  const t0 = useRef(0);
  const timer = useRef(0);
  const later = useRef(0);
  const x0 = useRef(0);
  const wave = useRef<HTMLDivElement>(null);
  const time = useRef<HTMLSpanElement>(null);
  const prog = useRef(0);
  const praf = useRef(0);
  const scrub = useRef(false);
  const clipRef = useRef<Clip | null>(null);
  clipRef.current = clip;

  const go = (p: Phase) => {
    ph.current = p;
    setPhase(p);
  };

  const n = Math.round(clamp(bars, 12, 48));
  const g = 0.4 + (clamp(gain, 0, 100) / 100) * 1.2;
  const r = clamp(corner, 0, H / 2);
  /* the play disc sits 6 inside: concentric once there is a
     curve to follow, square with the pill when there is not */
  const inner = Math.max(0, r - 6 * Math.min(1, r / 12));

  useEffect(() => () => {
    ++request.current;
    freeInput();
    clearInterval(timer.current);
    clearTimeout(later.current);
    cancelAnimationFrame(praf.current);
  }, []);

  useEffect(() => {
    if (!clip) return;
    const url = URL.createObjectURL(clip.blob);
    const player = new Audio(url);
    audio.current = player;
    player.onended = () => { prog.current = 1; paintProg(); stopPlay(); };
    return () => {
      player.pause();
      player.onended = null;
      audio.current = null;
      URL.revokeObjectURL(url);
    };
  }, [clip]);

  const paintProg = () => {
    wave.current?.style.setProperty("--prog", prog.current.toFixed(4));
    const c = clipRef.current;
    if (time.current && c) {
      const p = prog.current;
      time.current.textContent = fmt(p > 0 && p < 1 ? p * c.ms : c.ms);
    }
  };

  const stopPlay = () => {
    cancelAnimationFrame(praf.current);
    praf.current = 0;
    audio.current?.pause();
    setPlaying(false);
  };

  const close = (_how: "whisk" | "tock") => {
    go("cancel");
    clearTimeout(later.current);
    later.current = window.setTimeout(() => {
      setClip(null);
      pullRef.current = 0;
    setPull(0);
      go("idle");
    }, 360);
  };

  const end = (cancel: boolean) => {
    if (ph.current !== "rec") return;
    clearInterval(timer.current);
    const rec = capture.current;
    const took = performance.now() - t0.current;
    if (!rec && t0.current > 0) return;
    if (cancel || !rec || took < MIN_MS) {
      ++request.current;
      freeInput();
      close("whisk");
      return;
    }
    // The final dataavailable event arrives before stop.
    freeInput();
  };

  const begin = async () => {
    if (ph.current !== "idle") return;
    const ticket = ++request.current;
    setFailed(false);
    t0.current = 0;
    raw.current = [];
    setLevels([]);
    setMs(0);
    pullRef.current = 0;
    setPull(0);
    go("rec");
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (ticket !== request.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const rec = new MediaRecorder(stream);
      capture.current = rec;
      const ctx = new AudioContext();
      context.current = ctx;
      const analyser = ctx.createAnalyser();
      ctx.createMediaStreamSource(stream).connect(analyser);
      void ctx.resume().catch(() => {});
      const samples = new Uint8Array(analyser.fftSize);
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        if (ticket !== request.current) return;
        clearInterval(timer.current);
        freeInput();
        if (!chunks.length) { setFailed(true); close("tock"); return; }
        prog.current = 0;
        setClip({ raw: raw.current.slice(), ms: Math.min(MAX_MS, performance.now()-t0.current), blob: new Blob(chunks,{type:rec.mimeType}) });
        pullRef.current = 0;
        setPull(0);
        go("clip");
      };
      rec.start();
      t0.current = performance.now();
      timer.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        let power = 0;
        for (const sample of samples) power += ((sample - 128) / 128) ** 2;
        raw.current.push(Math.min(1, Math.sqrt(power / samples.length) * 4));
        setLevels(raw.current.slice(-64));
        const elapsed = performance.now() - t0.current;
        setMs(elapsed);
        if (elapsed >= MAX_MS) end(false);
      }, SAMPLE);
    } catch {
      stream?.getTracks().forEach(track => track.stop());
      if (ticket === request.current) {freeInput(); setFailed(true); go("idle");}
    }
  };

  const toggle = async () => {
    const player = audio.current;
    const c = clipRef.current;
    if (!player || !c) return;
    if (!player.paused) { stopPlay(); return; }
    if (prog.current >= 1) { player.currentTime = 0; prog.current = 0; }
    try { await player.play(); } catch { return; }
    if (player !== audio.current || player.paused) return;
    setPlaying(true);
    const step = () => {
      if (!scrub.current) prog.current = Math.min(1, player.currentTime * 1000 / c.ms);
      paintProg();
      if (!player.paused) praf.current = requestAnimationFrame(step);
    };
    step();
  };

  const seek = (clientX: number) => {
    const el = wave.current;
    const c = clipRef.current;
    if (!el || !c) return;
    const b = el.getBoundingClientRect();
    prog.current = clamp((clientX - b.left) / b.width, 0, 1);
    if (audio.current) audio.current.currentTime = prog.current * c.ms / 1000;
    paintProg();
  };

  const discard = () => {
    stopPlay();
    close("whisk");
  };

  /* ── the bars ─────────────────────────────────────────── */
  const bar = (v: number, i: number, key: string | number) => (
    <i
      key={key}
      className="vn-bar"
      style={{ "--l": clamp(v * g, 0, 1).toFixed(3), "--i": i } as React.CSSProperties}
    />
  );

  /* recording: the last n samples, right-aligned, and the rest
     of the row the resting dot a bar starts from */
  const recBars = () => {
    const start = raw.current.length - levels.length;
    const out = [];
    for (let j = 0; j < n; j++) {
      const k = levels.length - n + j;
      out.push(k >= 0 ? bar(levels[k]!, j, start + k) : bar(0, j, `e${j}`));
    }
    return out;
  };

  const shift = -pull * CANCEL * 0.5;
  const armed = pull >= 1;
  const open = phase !== "idle";
  const showClip = clip && (phase === "clip" || phase === "cancel");

  return (
    <div className="vn-frame">
      <div
        className="vn"
        data-phase={phase}
        role={phase === "idle" || phase === "rec" ? "button" : undefined}
        tabIndex={phase === "idle" || phase === "rec" ? 0 : -1}
        aria-label={phase === "rec" ? t("recordHelp") : phase === "idle" ? t("holdVoice") : undefined}
        style={{
          "--w": `${open ? OPEN_W : IDLE_W}px`,
          "--r": `${r}px`,
          "--inner": `${inner}px`,
          "--ov": (1 + (clamp(bounce, 0, 100) / 100) * 0.7).toFixed(3),
          "--pull": pull.toFixed(3),
        } as React.CSSProperties}
        onPointerDown={(e) => {
          if (ph.current !== "idle") return;
          try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a scripted pointer */ }
          x0.current = e.clientX;
          begin();
        }}
        onPointerMove={(e) => {
          if (ph.current !== "rec") return;
          const p = clamp((x0.current - e.clientX) / CANCEL, 0, 1);
          /* all the way arms it — a tick as it catches — and
             sliding back disarms; letting go is what decides */
          pullRef.current = p;
          setPull(p);
        }}
        onPointerUp={(e) => {
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* never captured */ }
          end(pullRef.current >= 1);
        }}
        onPointerCancel={() => end(true)}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat && ph.current === "idle") {
            e.preventDefault();
            begin();
          } else if (e.key === "Escape" && ph.current === "rec") {
            end(true);
          }
        }}
        onKeyUp={(e) => {
          /* only while recording: the play and discard buttons
             inside act on keyup, and this would swallow it */
          if ((e.key === " " || e.key === "Enter") && ph.current === "rec") {
            e.preventDefault();
            end(false);
          }
        }}
        onBlur={() => { if (ph.current === "rec") end(true); }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {phase === "idle" && (
          <span key="idle" className="vn-in vn-idle">
            <MicMark />
            {t("holdVoice")}
          </span>
        )}

        {(phase === "rec" || (phase === "cancel" && !clip)) && (
          <span key="rec" className="vn-in vn-rec" style={{ translate: `${shift}px 0` }}>
            <span className="vn-dot" />
            <span className="vn-time">{fmt(ms)}</span>
            <span className="vn-wave" style={{ "--n": n } as React.CSSProperties}>{recBars()}</span>
          </span>
        )}

        {/* slid all the way: the cancel mark takes the dot's
            place. It sits on the pill rather than in the sliding
            row, which by now has gone half out of the left edge */}
        {(phase === "rec" || (phase === "cancel" && !clip)) && (
          <span className="vn-cancel" data-on={armed || undefined} aria-hidden="true">
            <X size={16} />
          </span>
        )}

        {showClip && (
          <span key="clip" className="vn-in vn-clip">
            <button
              type="button"
              className="vn-play"
              aria-label={t(playing ? "pauseVoice" : "playVoice")}
              onClick={toggle}
            >
              <PlayMark on={playing} />
            </button>
            <span
              ref={wave}
              className="vn-wave vn-scrub"
              style={{ "--n": n, "--prog": prog.current } as React.CSSProperties}
              onPointerDown={(e) => {
                try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* a scripted pointer */ }
                scrub.current = true;
                seek(e.clientX);
              }}
              onPointerMove={(e) => { if (scrub.current) seek(e.clientX); }}
              onPointerUp={(e) => {
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* never captured */ }
                scrub.current = false;
              }}
              onPointerCancel={() => { scrub.current = false; }}
            >
              {resample(clip.raw, n).map((v, i) => bar(v, i, i))}
            </span>
            <span ref={time} className="vn-time">{fmt(clip.ms)}</span>
            <button type="button" className="vn-x" aria-label={t("cancel")} onClick={discard}>
              <X size={18} />
            </button>
          </span>
        )}
      </div>
      <span
        className="vn-hint"
        data-on={phase === "rec" || undefined}
        data-armed={(phase === "rec" && armed) || undefined}
        style={{ "--pull": pull.toFixed(3) } as React.CSSProperties}
        aria-hidden="true"
      >
        {phase === "rec" && armed ? t("releaseCancel") : t("slideCancel")}
      </span>
      {phase === "clip" && clip && <button className="vn-send" type="button" aria-label={t("send")} onClick={() => { stopPlay(); onSend(clip.blob); }}><Send size={20} /></button>}
      {failed && <span role="alert" className="vn-error">{t("micError")}</span>}
    </div>
  );
}
