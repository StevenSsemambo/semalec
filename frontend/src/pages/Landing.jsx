export default function Landing({ onPick, onTerms, onPrivacy }) {
  return (
    <div style={{ minHeight:"100vh", background:"#0F0C29", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .semai-role-card:hover{border-color:#7C3AED!important;transform:translateY(-2px)}
      `}</style>

      <div style={{ textAlign:"center", width:"90%", maxWidth:440, padding:20 }}>
        <div style={{ width:76, height:76, borderRadius:22, background:"linear-gradient(135deg,#7C3AED,#4F46E5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:38, margin:"0 auto 20px", boxShadow:"0 0 40px rgba(124,58,237,0.45)", animation:"float 3s ease-in-out infinite" }}>☕</div>
        <h1 style={{ color:"white", fontSize:28, fontWeight:900, margin:"0 0 4px" }}>SEMAI</h1>
        <p style={{ color:"#A78BFA", fontSize:11, letterSpacing:3, margin:"0 0 4px" }}>AI LECTURER</p>
        <p style={{ color:"#4B5563", fontSize:11, margin:"0 0 30px" }}>SayMyTech Developers · Makerere University</p>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <button className="semai-role-card" onClick={()=>onPick("student")}
            style={{ textAlign:"left", display:"flex", alignItems:"center", gap:16, background:"#1A1640", border:"1px solid #2D2757", borderRadius:16, padding:"20px 22px", cursor:"pointer", transition:"all 0.15s" }}>
            <span style={{ fontSize:30 }}>🎓</span>
            <span>
              <span style={{ display:"block", color:"white", fontSize:15, fontWeight:700, marginBottom:2 }}>I'm a Student</span>
              <span style={{ display:"block", color:"#6B7280", fontSize:12 }}>Join a live lecture</span>
            </span>
            <span style={{ marginLeft:"auto", color:"#4B5563", fontSize:18 }}>→</span>
          </button>

          <button className="semai-role-card" onClick={()=>onPick("lecturer")}
            style={{ textAlign:"left", display:"flex", alignItems:"center", gap:16, background:"#1A1640", border:"1px solid #2D2757", borderRadius:16, padding:"20px 22px", cursor:"pointer", transition:"all 0.15s" }}>
            <span style={{ fontSize:30 }}>🧑‍🏫</span>
            <span>
              <span style={{ display:"block", color:"white", fontSize:15, fontWeight:700, marginBottom:2 }}>I'm a Lecturer</span>
              <span style={{ display:"block", color:"#6B7280", fontSize:12 }}>Sign in to add or manage course units</span>
            </span>
            <span style={{ marginLeft:"auto", color:"#4B5563", fontSize:18 }}>→</span>
          </button>
        </div>

        <p style={{ color:"#2D2757", fontSize:10, marginTop:20 }}>By Ssemambo Steven · SayMyTech Developers</p>
        {(onTerms || onPrivacy) && (
          <p style={{ fontSize:10, marginTop:6 }}>
            {onTerms && <button onClick={onTerms} style={{ background:"none", border:"none", color:"#4B5563", fontSize:10, cursor:"pointer", padding:0, textDecoration:"underline" }}>Terms</button>}
            {onTerms && onPrivacy && <span style={{ color:"#2D2757", margin:"0 6px" }}>·</span>}
            {onPrivacy && <button onClick={onPrivacy} style={{ background:"none", border:"none", color:"#4B5563", fontSize:10, cursor:"pointer", padding:0, textDecoration:"underline" }}>Privacy</button>}
          </p>
        )}
      </div>
    </div>
  );
}
