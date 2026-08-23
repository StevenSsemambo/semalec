// SEMAI slide template — a real lecture slide, not a bulleted outline.
// Design language: a serif display face (Fraunces) for gravitas, carrying the
// "lecture hall" feel, paired with Inter for body copy. Each bullet is parsed into
// a bold lead term + an explanatory clause, styled like a real definition rather
// than a flat list item. A large translucent module glyph and a hand-drawn-style
// amber underline under the title are the slide's one signature flourish.

function parseBullet(raw) {
  const text = (raw || "").trim();
  const sep = text.match(/\s[—–]\s|\s-\s|:\s/);
  if (sep) {
    const idx = text.indexOf(sep[0]);
    return { lead: text.slice(0, idx).trim(), detail: text.slice(idx + sep[0].length).trim() };
  }
  return { lead: text, detail: "" };
}

export default function SlideScreen({ slide, mod, idx, total }) {
  if (!slide) return null;
  const bullets = slide.bullets || [];
  const [lede, ...rest] = bullets;
  const ledeParsed = lede ? parseBullet(lede) : null;

  return (
    <div style={{ width:"100%", height:"100%", background:"radial-gradient(ellipse 120% 90% at 15% 0%, #1A1442 0%, #0B0820 55%, #060414 100%)", display:"flex", flexDirection:"column", fontFamily:"'Inter',system-ui,sans-serif", position:"relative", overflow:"hidden" }}>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .semai-slide-in { animation: semaiSlideIn 0.4s ease-out; }
        }
        @keyframes semaiSlideIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Decorative giant module glyph watermark */}
      <div style={{ position:"absolute", right:-40, top:"50%", transform:"translateY(-50%)", fontSize:280, opacity:0.05, pointerEvents:"none", lineHeight:1 }}>
        {mod?.icon}
      </div>

      {/* Header */}
      <div style={{ padding:"30px 44px 22px", flexShrink:0, position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:11 }}>
            <div style={{ width:38, height:38, borderRadius:11, background:"rgba(124,58,237,0.18)", border:"1px solid rgba(167,139,250,0.35)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:19, flexShrink:0 }}>
              {mod?.icon}
            </div>
            <span style={{ fontSize:11, color:"#9891C4", letterSpacing:3, textTransform:"uppercase", fontWeight:600 }}>{mod?.title}</span>
          </div>
          <div style={{ display:"flex", gap:5 }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{ width: i===idx ? 18 : 5, height:5, borderRadius:3, background: i===idx ? "linear-gradient(90deg,#F0B429,#7C3AED)" : "rgba(255,255,255,0.14)", transition:"width 0.25s" }}/>
            ))}
          </div>
        </div>

        <div key={slide.title} className="semai-slide-in" style={{ position:"relative", display:"inline-block" }}>
          <h1 style={{ margin:0, fontFamily:"'Fraunces',serif", fontOpticalSizing:"auto", fontWeight:640, fontSize:34, color:"#F5F3FF", lineHeight:1.15, letterSpacing:"-0.01em" }}>
            {slide.title}
          </h1>
          <div style={{ height:5, width:"64%", minWidth:120, marginTop:9, borderRadius:4, background:"linear-gradient(90deg, rgba(240,180,41,0.65), rgba(240,180,41,0.05))" }}/>
        </div>
      </div>

      {/* Body */}
      <div key={"body-"+slide.title} className="semai-slide-in" style={{ flex:1, padding:"6px 44px 30px", display:"flex", flexDirection:"column", gap:14, overflowY:"auto", position:"relative", zIndex:1 }}>
        {ledeParsed && (
          <div style={{ background:"linear-gradient(135deg, rgba(124,58,237,0.14), rgba(79,70,229,0.06))", border:"1px solid rgba(167,139,250,0.25)", borderRadius:14, padding:"18px 22px" }}>
            <p style={{ margin:0, fontSize:19, lineHeight:1.55, color:"#F5F3FF" }}>
              <span style={{ fontWeight:700, color:"#D8CCFF" }}>{ledeParsed.lead}</span>
              {ledeParsed.detail && <span style={{ color:"#C4BEE3" }}>{" — " + ledeParsed.detail}</span>}
            </p>
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column" }}>
          {rest.map((b, i) => {
            const { lead, detail } = parseBullet(b);
            return (
              <div key={i} style={{ display:"flex", gap:16, padding:"13px 4px", borderBottom: i < rest.length-1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <div style={{ width:3, borderRadius:2, background:"linear-gradient(180deg,#7C3AED,#4F46E5)", flexShrink:0, marginTop:3 }}/>
                <p style={{ margin:0, fontSize:15.5, lineHeight:1.65, color:"#E4E1F5" }}>
                  <span style={{ fontWeight:650, color:"#F5F3FF" }}>{lead}</span>
                  {detail && <span style={{ color:"#A79FD1" }}>{" — " + detail}</span>}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding:"10px 44px", background:"rgba(0,0,0,0.25)", display:"flex", justifyContent:"space-between", flexShrink:0, position:"relative", zIndex:1 }}>
        <span style={{ fontFamily:"'Fira Code',monospace", fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:0.5 }}>{String(idx+1).padStart(2,"0")} / {String(total).padStart(2,"0")}</span>
        <span style={{ fontFamily:"'Fira Code',monospace", fontSize:10, color:"rgba(255,255,255,0.25)", letterSpacing:0.5 }}>SEMAI · SAYMYTECH</span>
      </div>
    </div>
  );
}
