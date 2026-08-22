import { useState, useRef, useCallback, useEffect } from "react";

// ── Browser TTS ───────────────────────────────────────────────────────────────
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices() || [];
  const preferred = [
    "Samantha","Karen","Moira","Tessa","Fiona","Allison","Ava",
    "Google UK English Female","Microsoft Zira","Microsoft Hazel",
    "Google US English",
  ];
  for (const name of preferred) {
    const v = vs.find(v => v.name.includes(name));
    if (v) return v;
  }
  return vs.find(v => v.lang.startsWith("en") && v.name.toLowerCase().includes("female"))
      || vs.find(v => v.lang.startsWith("en"))
      || vs[0]
      || null;
}

function cleanForSpeech(text) {
  return text
    .replace(/```[\s\S]*?```/g, ". The code is now shown on your screen.")
    .replace(/`[^`]+`/g, "")
    .replace(/[*_~#\[\]>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // NOTE: no length truncation here — a full slide explanation runs ~150-260 words,
  // and cutting it short is exactly what caused SEMAI to stop mid-explanation.
}

// Chrome (and some other browsers) silently stops speaking a single very long utterance
// after roughly 15 seconds — a long-standing Web Speech API bug, not a text-length limit
// as such. The fix is to never hand it one giant utterance: split into sentence-sized
// chunks and queue them, so each individual utterance stays short and plays reliably.
function splitIntoSpeechChunks(text, maxLen = 200) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
  const chunks = [];
  let current = "";
  for (let s of sentences) {
    s = s.trim();
    if (!s) continue;
    if (s.length > maxLen) {
      let rest = s;
      while (rest.length > maxLen) {
        let cut = rest.lastIndexOf(",", maxLen);
        if (cut < maxLen * 0.4) cut = rest.lastIndexOf(" ", maxLen);
        if (cut <= 0) cut = maxLen;
        chunks.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1).trim();
      }
      if (rest) chunks.push(rest);
      continue;
    }
    if ((current + " " + s).trim().length > maxLen) {
      if (current) chunks.push(current.trim());
      current = s;
    } else {
      current = (current + " " + s).trim();
    }
  }
  if (current) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

export function useVoice() {
  const [speaking,  setSpeaking]  = useState(false);
  const [listening, setListening] = useState(false);
  const [caption,   setCaption]   = useState("");
  const [audioOn,   setAudioOn]   = useState(true);
  const [micMuted,  setMicMuted]  = useState(false);
  const recogRef = useRef(null);
  const speechIdRef = useRef(0); // guards against a stale queue firing callbacks after cancel()/a newer speak()

  // Pre-load voices on mount
  useEffect(() => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }, []);

  const speak = useCallback((text, onDone) => {
    if (!audioOn || !window.speechSynthesis) { onDone?.(); return; }
    window.speechSynthesis.cancel();
    const mySpeechId = ++speechIdRef.current;

    const clean = cleanForSpeech(text);
    const chunks = splitIntoSpeechChunks(clean);
    if (chunks.length === 0) { onDone?.(); return; }

    const go = () => {
      if (speechIdRef.current !== mySpeechId) return; // superseded by a newer speak() call
      const voice = pickVoice();
      setSpeaking(true);
      chunks.forEach((chunk, i) => {
        const utt = new SpeechSynthesisUtterance(chunk);
        utt.rate   = 0.98;
        utt.pitch  = 1.0;
        utt.volume = 1.0;
        if (voice) utt.voice = voice;
        utt.onstart = () => {
          if (speechIdRef.current !== mySpeechId) return;
          setCaption(chunk.slice(0, 110) + (chunk.length > 110 ? "…" : ""));
        };
        const isLast = i === chunks.length - 1;
        utt.onend = () => {
          if (speechIdRef.current !== mySpeechId) return;
          if (isLast) { setSpeaking(false); setCaption(""); onDone?.(); }
        };
        utt.onerror = () => {
          if (speechIdRef.current !== mySpeechId) return;
          if (isLast) { setSpeaking(false); setCaption(""); onDone?.(); }
        };
        window.speechSynthesis.speak(utt);
      });
    };

    if (window.speechSynthesis.getVoices().length) go();
    else { window.speechSynthesis.onvoiceschanged = go; setTimeout(go, 800); }
  }, [audioOn]);

  const stopSpeaking = useCallback(() => {
    speechIdRef.current++; // invalidate any in-flight queued callbacks
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setCaption("");
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioOn(on => { if (on) { speechIdRef.current++; window.speechSynthesis?.cancel(); } return !on; });
  }, []);

  // ── Speech recognition ────────────────────────────────────────────────────
  const startListening = useCallback((onResult, opts = {}) => {
    if (micMuted) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { if (!opts.silent) alert("Please use Chrome for voice input."); return; }
    window.speechSynthesis?.cancel();
    const r = new SR();
    r.lang = "en-US"; r.continuous = false; r.interimResults = false;
    r.onresult = e => { onResult(e.results[0][0].transcript); };
    r.onend    = () => setListening(false);
    r.onerror  = () => setListening(false);
    try { r.start(); recogRef.current = r; setListening(true); } catch { setListening(false); }
  }, [micMuted]);

  const stopListening = useCallback(() => {
    recogRef.current?.stop();
    setListening(false);
  }, []);

  const toggleMic = useCallback(() => {
    setMicMuted(m => !m);
    if (listening) stopListening();
  }, [listening, stopListening]);

  return {
    speak, stopSpeaking, speaking, caption,
    audioOn, toggleAudio,
    listening, startListening, stopListening,
    micMuted, toggleMic,
  };
}
