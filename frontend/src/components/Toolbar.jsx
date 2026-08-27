import { useState } from "react";

function Btn({ icon, label, onClick, active, danger, disabled, badge }) {
  return (
    <div style={{ position:"relative", flexShrink:0 }}>
      <button onClick={onClick} disabled={disabled} style={{
        display:"flex", flexDirection:"column", alignItems:"center", gap:3,
        background:"none", border:"none", color:disabled?"#3F3F3F":"white",
        cursor:disabled?"default":"pointer", padding:"4px 8px", borderRadius:8,
        opacity:disabled?0.4:1, transition:"background 0.15s",
      }}>
        <div style={{
          width:40, height:40, borderRadius:"50%", display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:17, transition:"background 0.15s", flexShrink:0,
          background: danger?"#991B1B" : active?"#5B21B6" : "rgba(255,255,255,0.08)",
          border: active&&!danger ? "1px solid #7C3AED" : "1px solid transparent",
        }}>
          {icon}
        </div>
        <span style={{ fontSize:10, color:disabled?"#3F3F3F":"#9CA3AF", whiteSpace:"nowrap" }}>{label}</span>
      </button>
      {badge > 0 && (
        <div style={{ position:"absolute", top:2, right:2, background:"#DC2626", borderRadius:"50%", width:15, height:15, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"white", pointerEvents:"none" }}>
          {badge}
        </div>
      )}
    </div>
  );
}

export default function Toolbar({
  micMuted, onToggleMic, audioOn, onToggleAudio,
  listening, onAskVoice, raisedHand, onRaiseHand,
  screen, onNextSlide, onExplainCode, practicalType,
  loading, hasMod,
  chatOpen, onToggleChat, unread,
  onQuiz, onLeave,
  speechSupported = true,
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ background:"#242424", borderTop:"1px solid #333", flexShrink:0 }}>
      <style>{`
        @media (max-width: 680px) {
          .semai-toolbar-row { flex-wrap: wrap; row-gap: 6px; }
          .semai-toolbar-center { order: 3; width: 100%; overflow-x: auto; justify-content: flex-start !important; -webkit-overflow-scrolling: touch; padding-bottom: 2px; }
          .semai-toolbar-left { order: 1; }
          .semai-toolbar-right { order: 2; margin-left: auto; }
        }
      `}</style>

      {/* Collapse pill */}
      <div onClick={() => setOpen(o => !o)}
        style={{ height:22, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", gap:8 }}>
        <div style={{ width:40, height:4, borderRadius:4, background:"#3A3A3A" }}/>
        <span style={{ fontSize:9, color:"#4B5563", letterSpacing:1 }}>{open ? "▼ HIDE CONTROLS" : "▲ SHOW CONTROLS"}</span>
        <div style={{ width:40, height:4, borderRadius:4, background:"#3A3A3A" }}/>
      </div>

      {open && (
        <div className="semai-toolbar-row" style={{ padding:"6px 14px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          {/* Left — audio */}
          <div className="semai-toolbar-left" style={{ display:"flex", gap:2, flexShrink:0 }}>
            <Btn icon={micMuted?"🔇":"🎙️"}  label={micMuted?"Unmute":"Mute"}     onClick={onToggleMic}    danger={micMuted}/>
            <Btn icon={audioOn?"🔊":"🔈"}    label={audioOn?"Voice On":"Voice Off"} onClick={onToggleAudio} danger={!audioOn}/>
          </div>

          {/* Centre — scrolls horizontally on narrow screens instead of squeezing/overlapping */}
          <div className="semai-toolbar-center" style={{ display:"flex", gap:2, alignItems:"center" }}>
            <Btn icon="🗣️" label={!speechSupported ? "Voice N/A" : listening ? "Listening…" : "Ask SEMAI"}
              onClick={onAskVoice} active={listening} disabled={micMuted || !speechSupported}/>
            <Btn icon="✋" label={raisedHand?"Lower Hand":"Raise Hand"}  onClick={onRaiseHand} active={raisedHand}/>
            {screen==="slides" && <Btn icon="▶" label="Next Slide"    onClick={onNextSlide}   disabled={loading||!hasMod}/>}
            {screen==="ide"    && <Btn icon="📋" label={practicalType==="code" ? "Explain Code" : "Explain Again"}  onClick={onExplainCode} disabled={loading||!hasMod}/>}
            <Btn icon="🧠" label="Quiz Me"  onClick={onQuiz}       disabled={loading||!hasMod}/>
            <Btn icon="💬" label="Q&A Chat" onClick={onToggleChat}  active={chatOpen} badge={unread}/>
          </div>

          {/* Right — leave */}
          <div className="semai-toolbar-right" style={{ flexShrink:0 }}>
            <button onClick={onLeave}
              style={{ background:"#991B1B", border:"none", borderRadius:8, padding:"8px 14px", color:"white", cursor:"pointer", fontSize:12, fontWeight:700 }}>
              Leave
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
