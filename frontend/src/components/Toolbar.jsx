import { useState } from "react";

function Btn({ icon, label, onClick, active, danger, disabled, badge }) {
  return (
    <div style={{ position:"relative" }}>
      <button onClick={onClick} disabled={disabled} style={{
        display:"flex", flexDirection:"column", alignItems:"center", gap:3,
        background:"none", border:"none", color:disabled?"#3F3F3F":"white",
        cursor:disabled?"default":"pointer", padding:"4px 10px", borderRadius:8,
        opacity:disabled?0.4:1, transition:"background 0.15s",
      }}>
        <div style={{
          width:40, height:40, borderRadius:"50%", display:"flex", alignItems:"center",
          justifyContent:"center", fontSize:17, transition:"background 0.15s",
          background: danger?"#991B1B" : active?"#5B21B6" : "rgba(255,255,255,0.08)",
          border: active&&!danger ? "1px solid #7C3AED" : "1px solid transparent",
        }}>
          {icon}
        </div>
        <span style={{ fontSize:10, color:disabled?"#3F3F3F":"#9CA3AF", whiteSpace:"nowrap" }}>{label}</span>
      </button>
      {badge > 0 && (
        <div style={{ position:"absolute", top:2, right:4, background:"#DC2626", borderRadius:"50%", width:15, height:15, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"white", pointerEvents:"none" }}>
          {badge}
        </div>
      )}
    </div>
  );
}

export default function Toolbar({
  micMuted, onToggleMic, audioOn, onToggleAudio,
  listening, onAskVoice, raisedHand, onRaiseHand,
  screen, onNextSlide, onExplainCode,
  loading, hasMod,
  chatOpen, onToggleChat, unread,
  onQuiz, onLeave,
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ background:"#242424", borderTop:"1px solid #333", flexShrink:0 }}>
      {/* Collapse pill */}
      <div onClick={() => setOpen(o => !o)}
        style={{ height:22, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", gap:8 }}>
        <div style={{ width:40, height:4, borderRadius:4, background:"#3A3A3A" }}/>
        <span style={{ fontSize:9, color:"#4B5563", letterSpacing:1 }}>{open ? "▼ HIDE CONTROLS" : "▲ SHOW CONTROLS"}</span>
        <div style={{ width:40, height:4, borderRadius:4, background:"#3A3A3A" }}/>
      </div>

      {open && (
        <div style={{ padding:"6px 14px 10px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          {/* Left — audio */}
          <div style={{ display:"flex", gap:2 }}>
            <Btn icon={micMuted?"🔇":"🎙️"}  label={micMuted?"Unmute":"Mute"}     onClick={onToggleMic}    danger={micMuted}/>
            <Btn icon={audioOn?"🔊":"🔈"}    label={audioOn?"Voice On":"Voice Off"} onClick={onToggleAudio} danger={!audioOn}/>
          </div>

          {/* Centre */}
          <div style={{ display:"flex", gap:2, alignItems:"center" }}>
            <Btn icon="🗣️" label={listening?"Listening…":"Ask SEMAI"} onClick={onAskVoice}  active={listening} disabled={micMuted}/>
            <Btn icon="✋" label={raisedHand?"Lower Hand":"Raise Hand"}  onClick={onRaiseHand} active={raisedHand}/>
            {screen==="slides" && <Btn icon="▶" label="Next Slide"    onClick={onNextSlide}   disabled={loading||!hasMod}/>}
            {screen==="ide"    && <Btn icon="📋" label="Explain Code"  onClick={onExplainCode} disabled={loading||!hasMod}/>}
            <Btn icon="🧠" label="Quiz Me"  onClick={onQuiz}       disabled={loading||!hasMod}/>
            <Btn icon="💬" label="Q&A Chat" onClick={onToggleChat}  active={chatOpen} badge={unread}/>
          </div>

          {/* Right — leave */}
          <button onClick={onLeave}
            style={{ background:"#991B1B", border:"none", borderRadius:8, padding:"8px 14px", color:"white", cursor:"pointer", fontSize:12, fontWeight:700 }}>
            Leave
          </button>
        </div>
      )}
    </div>
  );
}
