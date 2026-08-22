import { useRef, useEffect } from "react";

export default function ChatPanel({ messages, input, setInput, onSend, onClose, loading, studentName }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [messages]);

  return (
    <div style={{ width:270, background:"#161616", borderLeft:"1px solid #2D2D2D", display:"flex", flexDirection:"column", flexShrink:0 }}>
      {/* Header */}
      <div style={{ padding:"10px 14px", borderBottom:"1px solid #2D2D2D", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:13, fontWeight:600, color:"white" }}>Q&A — Ask SEMAI</span>
        <button onClick={onClose} style={{ background:"none", border:"none", color:"#6B7280", cursor:"pointer", fontSize:16 }}>✕</button>
      </div>

      {/* Messages */}
      <div ref={ref} style={{ flex:1, overflowY:"auto", padding:12, display:"flex", flexDirection:"column", gap:8 }}>
        {messages.length === 0 && (
          <p style={{ color:"#4B5563", fontSize:12, textAlign:"center", marginTop:24 }}>Ask SEMAI anything about Java!</p>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:m.role==="user"?"flex-end":"flex-start" }}>
            <div style={{ fontSize:9, color:"#374151", marginBottom:2 }}>{m.role==="user"?(studentName||"You"):"SEMAI"}</div>
            <div style={{
              maxWidth:"92%",
              background: m.role==="user" ? "linear-gradient(135deg,#7C3AED,#4F46E5)" : "#1A1A2E",
              border:     m.role==="user" ? "none" : "1px solid #2D2D4A",
              borderRadius: m.role==="user" ? "14px 14px 3px 14px" : "3px 14px 14px 14px",
              padding:"8px 12px", fontSize:12, lineHeight:1.7, color:"#E2E8F0", whiteSpace:"pre-wrap",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", gap:5, paddingLeft:4 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#7C3AED", animation:`pulse 1s ${i*0.2}s infinite` }}/>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding:"10px 12px", borderTop:"1px solid #2D2D2D", display:"flex", gap:8 }}>
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key==="Enter" && !e.shiftKey && input.trim()) { onSend(input); setInput(""); } }}
          placeholder="Type a question…" disabled={loading}
          style={{ flex:1, padding:"9px 12px", borderRadius:10, border:"1px solid #374151", background:"#111", color:"white", fontSize:12, outline:"none" }}
        />
        <button
          onClick={() => { if (input.trim()) { onSend(input); setInput(""); } }}
          disabled={!input.trim() || loading}
          style={{ background:input.trim()&&!loading?"#7C3AED":"#374151", border:"none", borderRadius:10, padding:"9px 14px", color:"white", cursor:input.trim()&&!loading?"pointer":"default", fontSize:13, fontWeight:700 }}>
          ↑
        </button>
      </div>
    </div>
  );
}
