import { useState, useEffect, useCallback } from "react";
import { getCourse } from "../api";
import { useVoice } from "../hooks/useVoice";
import { useSEMAI } from "../hooks/useSEMAI";
import SlideScreen from "../components/SlideScreen";
import IDEScreen   from "../components/IDEScreen";
import ChatPanel   from "../components/ChatPanel";
import Toolbar     from "../components/Toolbar";

const fmt = s => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

export default function Lecture({ studentName, courseId, onLeave, onAdmin }) {
  const [course,   setCourse]   = useState(null);
  const [screen,   setScreen]   = useState("welcome"); // welcome | menu | slides | ide
  const [mod,      setMod]      = useState(null);
  const [slideIdx, setSlideIdx] = useState(0);
  const [secs,     setSecs]     = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput,setChatInput]= useState("");
  const [unread,   setUnread]   = useState(0);
  const [raisedHand,setRaisedHand]=useState(false);
  const [handMsg,  setHandMsg]  = useState("");
  const [drawerOpen,setDrawerOpen]=useState(false);

  const voice = useVoice();
  const semai = useSEMAI({ courseId, studentName, speak: voice.speak });

  // Load course
  useEffect(() => {
    getCourse(courseId)
      .then(c => { setCourse(c); })
      .catch(() => {});
  }, [courseId]);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setSecs(s => s+1), 1000);
    return () => clearInterval(t);
  }, []);

  // Unread badge
  useEffect(() => {
    if (!chatOpen && semai.messages.length > 0 && semai.messages.at(-1).role==="assistant") {
      setUnread(n => n+1);
    }
  }, [semai.messages]);

  // ── Intro on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!course) return;
    const intro = `Hello ${studentName}, and welcome! I am SEMAI, your AI lecturer for ${course.title}, created by Steven Ssemambo of SayMyTech Developers. I am here to guide you through this course from start to finish. I will begin with the theory slides, then switch to the live code editor so we can practise together. You can ask me anything at any time by typing or speaking. Let us begin, class!`;
    setTimeout(() => {
      voice.speak(intro, () => setScreen("menu"));
    }, 600);
    setScreen("welcome");
  }, [course]);

  // ── Start module ──────────────────────────────────────────────────────────
  const startMod = useCallback((m) => {
    setMod(m); setSlideIdx(0); setScreen("slides"); setDrawerOpen(false);
    const firstSlide = m.slides[0];
    voice.speak(`Excellent choice! Let us begin with ${m.title}.`, () => {
      if (firstSlide) {
        semai.teachSlide({
          courseTitle: course?.title, moduleTitle: m.title,
          slideTitle: firstSlide.title, bullets: firstSlide.bullets,
        });
      }
    });
  }, [voice, semai, course]);

  // ── Slide navigation ──────────────────────────────────────────────────────
  const nextSlide = useCallback(() => {
    if (!mod) return;
    const next = slideIdx + 1;
    if (next < mod.slides.length) {
      setSlideIdx(next);
      const s = mod.slides[next];
      semai.teachSlide({
        courseTitle: course?.title, moduleTitle: mod.title,
        slideTitle: s.title, bullets: s.bullets,
      });
    } else {
      setScreen("ide");
      voice.speak(`Well done, class! You have covered all the slides for ${mod.title}. I am now switching to the live code editor. Watch the screen carefully as I walk you through the code.`);
    }
  }, [mod, slideIdx, voice, semai, course]);

  const prevSlide = () => { if (slideIdx > 0) setSlideIdx(s => s-1); };

  const goIDE = () => {
    setScreen("ide");
    voice.speak("I am switching to the code editor now. Follow each line as I explain it.");
  };

  const goSlides = () => {
    setSlideIdx(0); setScreen("slides");
    voice.speak(`Let us go back to the slides for ${mod?.title}.`);
  };

  // ── Ask SEMAI ─────────────────────────────────────────────────────────────
  const askSemai = useCallback((text) => {
    const ctx = mod ? `Currently on: ${mod.title}, slide ${slideIdx+1}: ${mod.slides[slideIdx]?.title || "code demo"}.` : "";
    semai.ask(text, ctx);
    if (!chatOpen) setUnread(0);
  }, [semai, mod, slideIdx, chatOpen]);

  // ── Voice ask ─────────────────────────────────────────────────────────────
  const handleVoiceAsk = () => {
    voice.startListening(text => askSemai(text));
  };

  // ── Raise hand ────────────────────────────────────────────────────────────
  const toggleHand = () => {
    const next = !raisedHand; setRaisedHand(next);
    if (next) { setHandMsg(`${studentName} raised their hand ✋`); setTimeout(()=>setHandMsg(""),5000); }
  };

  // ── Quiz ──────────────────────────────────────────────────────────────────
  const quiz = () => {
    setChatOpen(true); setUnread(0);
    askSemai(`Give me a short quiz question about ${mod?.title || "Java"} based on what we have covered so far.`);
  };

  if (!course) return (
    <div style={{ minHeight:"100vh", background:"#0F0C29", display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontFamily:"system-ui" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:32, marginBottom:12 }}>☕</div>
        <p style={{ color:"#6B7280" }}>Loading your lecture…</p>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#1C1C1C", fontFamily:"'Segoe UI',system-ui,sans-serif", color:"white", overflow:"hidden" }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideR{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        @keyframes slideL{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes wave{from{height:4px}to{height:18px}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:#111}::-webkit-scrollbar-thumb{background:#374151;border-radius:4px}
        input,textarea{user-select:text!important}
      `}</style>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div style={{ background:"#242424", height:46, display:"flex", alignItems:"center", padding:"0 14px", justifyContent:"space-between", flexShrink:0, borderBottom:"1px solid #333" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"#16A34A", animation:"pulse 2s infinite" }}/>
          <span style={{ fontWeight:700, fontSize:13 }}>SEMAI — {course.title}</span>
          {mod && <span style={{ background:"#312E81", border:"1px solid #4338CA", borderRadius:20, padding:"1px 10px", fontSize:10, color:"#A5B4FC" }}>{mod.icon} {mod.title}</span>}
          {screen==="slides" && mod && <span style={{ fontSize:10, color:"#4B5563" }}>Slide {slideIdx+1}/{mod.slides.length}</span>}
          {screen==="ide"    && <span style={{ fontSize:10, color:"#4B5563" }}>📂 Code Editor</span>}
        </div>
        <span style={{ color:"#4B5563", fontSize:12, fontFamily:"monospace", position:"absolute", left:"50%", transform:"translateX(-50%)" }}>{fmt(secs)}</span>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {voice.speaking && (
            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
              {[1,2,3,2,1].map((h,i)=>(
                <div key={i} style={{ width:3, borderRadius:3, background:"#7C3AED", animation:`wave ${0.3+h*0.06}s ${i*0.07}s ease-in-out infinite alternate`, minHeight:4 }}/>
              ))}
              <span style={{ fontSize:10, color:"#7C3AED", marginLeft:4 }}>SEMAI speaking</span>
            </div>
          )}
          <span style={{ color:"#4B5563", fontSize:11 }}>👤 {studentName}</span>
          <button onClick={()=>setDrawerOpen(o=>!o)}
            style={{ background:drawerOpen?"#7C3AED":"#374151", border:"none", borderRadius:7, padding:"5px 11px", color:"white", cursor:"pointer", fontSize:12 }}>
            ☰ Modules
          </button>
          <button onClick={onAdmin}
            style={{ background:"#1F2937", border:"1px solid #374151", borderRadius:7, padding:"5px 11px", color:"#9CA3AF", cursor:"pointer", fontSize:11 }}>
            ⚙️ Admin
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative" }}>

        {/* Drawer backdrop */}
        {drawerOpen && <div onClick={()=>setDrawerOpen(false)} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)", zIndex:20, backdropFilter:"blur(1px)" }}/>}

        {/* ── Module drawer ─────────────────────────────────────────────── */}
        {drawerOpen && (
          <div style={{ position:"absolute", top:0, left:0, bottom:0, width:240, background:"#161616", borderRight:"1px solid #2D2D2D", zIndex:25, overflowY:"auto", animation:"slideR 0.2s ease", boxShadow:"6px 0 24px rgba(0,0,0,0.6)" }}>
            <div style={{ padding:"12px 14px 8px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:"1px solid #2D2D2D" }}>
              <span style={{ color:"#6B7280", fontSize:10, letterSpacing:2 }}>MODULES</span>
              <button onClick={()=>setDrawerOpen(false)} style={{ background:"#2D2D2D", border:"none", borderRadius:6, width:22, height:22, color:"#9CA3AF", cursor:"pointer", fontSize:13 }}>✕</button>
            </div>
            {(course.modules || []).map(m => (
              <button key={m.id} onClick={()=>startMod(m)}
                style={{ width:"100%", textAlign:"left", padding:"11px 14px", background:mod?.id===m.id?"#1E1B4B":"none", border:"none", borderLeft:mod?.id===m.id?"3px solid #7C3AED":"3px solid transparent", color:mod?.id===m.id?"#A78BFA":"#9CA3AF", cursor:"pointer", fontSize:12, fontWeight:mod?.id===m.id?600:400, display:"flex", justifyContent:"space-between" }}>
                <span><span style={{ marginRight:7 }}>{m.icon}</span>{m.title}</span>
                {m.hours && <span style={{ fontSize:10, color:"#4B5563" }}>{m.hours}</span>}
              </button>
            ))}
          </div>
        )}

        {/* ── Main screen — 100% clean, no tiles ───────────────────────── */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          <div style={{ flex:1, overflow:"hidden" }}>

            {/* Welcome */}
            {screen==="welcome" && (
              <div style={{ width:"100%", height:"100%", background:"linear-gradient(145deg,#0F0C29,#1A1540)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20 }}>
                <div style={{ width:80, height:80, borderRadius:22, background:"linear-gradient(135deg,#7C3AED,#4F46E5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:40, boxShadow:"0 0 50px rgba(124,58,237,0.5)" }}>☕</div>
                <div style={{ textAlign:"center" }}>
                  <h2 style={{ color:"white", fontSize:22, fontWeight:800, margin:"0 0 6px" }}>Welcome, {studentName}</h2>
                  <p style={{ color:"#A78BFA", fontSize:13, margin:"0 0 4px" }}>{course.title}</p>
                  <p style={{ color:"#4B5563", fontSize:12, margin:0 }}>{course.institution} · SayMyTech · SEMAI</p>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, background:"rgba(124,58,237,0.1)", border:"1px solid rgba(124,58,237,0.3)", borderRadius:12, padding:"10px 20px" }}>
                  {voice.speaking
                    ? <><div style={{ display:"flex", alignItems:"center", gap:3 }}>{[1,2,3,2,1].map((h,i)=><div key={i} style={{ width:3, borderRadius:3, background:"#7C3AED", animation:`wave ${0.3+h*0.06}s ${i*0.07}s ease-in-out infinite alternate`, minHeight:4 }}/>)}</div><span style={{ color:"#A78BFA", fontSize:13 }}>SEMAI is welcoming you…</span></>
                    : <span style={{ color:"#4B5563", fontSize:12 }}>Preparing your lecture…</span>
                  }
                </div>
              </div>
            )}

            {/* Module menu */}
            {screen==="menu" && (
              <div style={{ width:"100%", height:"100%", background:"#111", overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center", padding:"28px 20px", gap:16 }}>
                <div style={{ textAlign:"center" }}>
                  <h3 style={{ color:"white", fontSize:16, fontWeight:700, margin:"0 0 4px" }}>Choose a module to begin</h3>
                  <p style={{ color:"#6B7280", fontSize:12, margin:0 }}>SEMAI will guide you through slides then live code</p>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12, width:"100%", maxWidth:680 }}>
                  {(course.modules || []).map(m => (
                    <button key={m.id} onClick={()=>startMod(m)}
                      style={{ background:"linear-gradient(145deg,#1A1A2E,#16213E)", border:"1px solid #2D2D4A", borderRadius:14, padding:"18px 16px", textAlign:"left", cursor:"pointer", color:"white" }}>
                      <div style={{ fontSize:26, marginBottom:10 }}>{m.icon}</div>
                      <div style={{ fontSize:13, fontWeight:600, color:"#E2E8F0", marginBottom:4 }}>{m.title}</div>
                      {m.hours && <div style={{ fontSize:10, color:"#4B5563", marginBottom:4 }}>{m.hours}</div>}
                      <div style={{ fontSize:10, color:"#374151" }}>{(m.slides||[]).length} slides + live code</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {screen==="slides" && mod && <SlideScreen slide={mod.slides[slideIdx]} mod={mod} idx={slideIdx} total={mod.slides.length}/>}
            {screen==="ide"    && mod && <IDEScreen type={mod.practicalType} language={mod.practicalLanguage} content={mod.practical} note={mod.practicalNote} modTitle={mod.title} courseTag={course.id?.toUpperCase()}/>}
          </div>

          {/* Slide / IDE nav */}
          {(screen==="slides"||screen==="ide") && mod && (
            <div style={{ background:"#1A1A1A", borderTop:"1px solid #2D2D2D", padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div style={{ display:"flex", gap:6 }}>
                {screen==="slides" && <>
                  <button onClick={prevSlide} disabled={slideIdx===0 || semai.preparing}
                    style={{ background:"#2D2D2D", border:"none", borderRadius:7, padding:"6px 14px", color:"white", cursor:(slideIdx===0||semai.preparing)?"default":"pointer", fontSize:12, opacity:(slideIdx===0||semai.preparing)?0.35:1 }}>← Prev</button>
                  <button onClick={nextSlide} disabled={semai.preparing}
                    style={{ background:"#7C3AED", border:"none", borderRadius:7, padding:"6px 14px", color:"white", cursor:semai.preparing?"default":"pointer", fontSize:12, fontWeight:600, opacity:semai.preparing?0.6:1 }}>
                    {semai.preparing ? "Teaching…" : slideIdx < mod.slides.length-1 ? "Next Slide →" : (mod.practicalType === "code" ? "Open Code Editor →" : mod.practicalType === "example" ? "Open Worked Example →" : "Finish Module ✓")}
                  </button>
                  {mod.practicalType !== "none" && mod.practical && (
                    <button onClick={goIDE} disabled={semai.preparing}
                      style={{ background:"#1F2937", border:"1px solid #374151", borderRadius:7, padding:"6px 14px", color:"#9CA3AF", cursor:semai.preparing?"default":"pointer", fontSize:12, opacity:semai.preparing?0.5:1 }}>Skip to {mod.practicalType === "code" ? "Code" : "Example"}</button>
                  )}
                </>}
                {screen==="ide" && (
                  <button onClick={goSlides}
                    style={{ background:"#2D2D2D", border:"none", borderRadius:7, padding:"6px 14px", color:"white", cursor:"pointer", fontSize:12 }}>← Back to Slides</button>
                )}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>{ setChatOpen(true); setUnread(0); }}
                  style={{ background:"#1F2937", border:"1px solid #374151", borderRadius:7, padding:"6px 14px", color:"#9CA3AF", cursor:"pointer", fontSize:12 }}>💬 Q&A</button>
                <button onClick={()=>{ setScreen("menu"); setMod(null); }}
                  style={{ background:"#1F2937", border:"1px solid #374151", borderRadius:7, padding:"6px 14px", color:"#9CA3AF", cursor:"pointer", fontSize:12 }}>All Modules</button>
              </div>
            </div>
          )}
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <ChatPanel
            messages={semai.messages}
            input={chatInput} setInput={setChatInput}
            onSend={askSemai}
            onClose={()=>{ setChatOpen(false); setUnread(0); }}
            loading={semai.loading}
            studentName={studentName}
          />
        )}
      </div>

      {/* Preparing indicator — shown while SEMAI composes the full explanation before speaking */}
      {semai.preparing && !voice.speaking && (
        <div style={{ position:"fixed", bottom:toolbarHeight()+8, left:"50%", transform:"translateX(-50%)", background:"rgba(9,9,20,0.92)", border:"1px solid #7C3AED", borderRadius:12, padding:"10px 20px", zIndex:50, display:"flex", alignItems:"center", gap:10, pointerEvents:"none" }}>
          <div style={{ width:14, height:14, borderRadius:"50%", border:"2px solid #7C3AED", borderTopColor:"transparent", animation:"spin 0.8s linear infinite" }}/>
          <span style={{ fontSize:12.5, color:"#A78BFA", fontStyle:"italic" }}>SEMAI is preparing the explanation…</span>
        </div>
      )}

      {/* Voice caption */}
      {voice.speaking && voice.caption && (
        <div style={{ position:"fixed", bottom:toolbarHeight()+8, left:"50%", transform:"translateX(-50%)", background:"rgba(9,9,20,0.92)", border:"1px solid #7C3AED", borderRadius:12, padding:"10px 20px", maxWidth:"65%", zIndex:50, display:"flex", alignItems:"center", gap:12, backdropFilter:"blur(8px)", pointerEvents:"none" }}>
          <div style={{ display:"flex", alignItems:"center", gap:3, flexShrink:0 }}>
            {[1,2,3,2,1].map((h,i)=><div key={i} style={{ width:3, borderRadius:3, background:"#7C3AED", animation:`wave ${0.3+h*0.06}s ${i*0.07}s ease-in-out infinite alternate`, minHeight:4 }}/>)}
          </div>
          <span style={{ fontSize:12.5, color:"#E2E8F0", fontStyle:"italic", lineHeight:1.5 }}>{voice.caption}</span>
        </div>
      )}

      {/* Hand banner */}
      {handMsg && (
        <div style={{ position:"fixed", top:56, left:"50%", transform:"translateX(-50%)", background:"#422006", border:"1px solid #D97706", borderRadius:20, padding:"5px 18px", fontSize:12, color:"#FCD34D", zIndex:40, whiteSpace:"nowrap" }}>
          {handMsg}
        </div>
      )}

      <Toolbar
        micMuted={voice.micMuted}    onToggleMic={voice.toggleMic}
        audioOn={voice.audioOn}      onToggleAudio={voice.toggleAudio}
        listening={voice.listening}  onAskVoice={handleVoiceAsk}
        raisedHand={raisedHand}      onRaiseHand={toggleHand}
        screen={screen}
        onNextSlide={nextSlide}
        onExplainCode={()=>mod&&voice.speak(mod.practicalNote||"Let us walk through this together.")}
        loading={semai.loading || semai.preparing} hasMod={!!mod}
        chatOpen={chatOpen}          onToggleChat={()=>{ setChatOpen(o=>!o); setUnread(0); }}
        unread={unread}
        onQuiz={quiz}
        onLeave={onLeave}
      />
    </div>
  );
}

// Rough toolbar height for caption offset
function toolbarHeight() { return 80; }
