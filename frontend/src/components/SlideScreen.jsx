export default function SlideScreen({ slide, mod, idx, total }) {
  if (!slide) return null;
  return (
    <div style={{ width:"100%", height:"100%", background:"linear-gradient(145deg,#0F0C29,#1A1540,#0D1B3E)", display:"flex", flexDirection:"column" }}>
      {/* Header */}
      <div style={{ background:"linear-gradient(90deg,#7C3AED,#4338CA)", padding:"18px 32px", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:26 }}>{mod?.icon}</span>
            <div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.55)", letterSpacing:3, textTransform:"uppercase", marginBottom:3 }}>{mod?.title}</div>
              <div style={{ fontSize:22, fontWeight:800, color:"white", lineHeight:1 }}>{slide.title}</div>
            </div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.15)", borderRadius:20, padding:"4px 16px", fontSize:12, color:"rgba(255,255,255,0.8)", fontFamily:"monospace" }}>
            {idx + 1} / {total}
          </div>
        </div>
      </div>

      {/* Bullets */}
      <div style={{ flex:1, padding:"30px 40px", display:"flex", flexDirection:"column", justifyContent:"center", gap:0, overflowY:"auto" }}>
        {(slide.bullets || []).map((b, i) => (
          <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:16, padding:"11px 0", borderBottom: i < slide.bullets.length-1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}>
            <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(124,58,237,0.2)", border:"1.5px solid rgba(124,58,237,0.55)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:"#A78BFA", flexShrink:0, marginTop:3 }}>
              {i + 1}
            </div>
            <p style={{ margin:0, fontSize:15.5, color:"#E2E8F0", lineHeight:1.8 }}>{b}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding:"9px 32px", background:"rgba(0,0,0,0.3)", display:"flex", justifyContent:"space-between", flexShrink:0 }}>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.22)", letterSpacing:1 }}>MAKERERE UNIVERSITY · TDIT 214</span>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.22)", letterSpacing:1 }}>SEMAI · SAYMYTECH DEVELOPERS</span>
      </div>
    </div>
  );
}
