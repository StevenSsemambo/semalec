import { useState } from "react";

const LANG_EXT = { java:"java", python:"py", javascript:"js", typescript:"ts", sql:"sql", cpp:"cpp", c:"c", csharp:"cs", php:"php", ruby:"rb" };

function hl(code, language) {
  let escaped = code.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  if (language !== "java") return escaped; // full syntax highlighting only implemented for Java
  const kw = /\b(public|private|protected|class|interface|extends|implements|new|return|void|int|double|float|boolean|String|char|long|short|byte|if|else|for|while|do|switch|case|break|continue|static|final|abstract|import|package|this|super|try|catch|finally|throw|throws|instanceof|null|true|false|default)\b/g;
  return escaped
    .replace(/(\/\/[^\n]*)/g,           s=>`<span style="color:#6A9955;font-style:italic">${s}</span>`)
    .replace(/(\/\*[\s\S]*?\*\/)/g,     s=>`<span style="color:#6A9955;font-style:italic">${s}</span>`)
    .replace(/(["'])(?:(?!\1)[^\\]|\\.)*\1/g, s=>`<span style="color:#CE9178">${s}</span>`)
    .replace(kw,                         s=>`<span style="color:#569CD6;font-weight:700">${s}</span>`)
    .replace(/\b(\d+\.?\d*[Lf]?)\b/g,   s=>`<span style="color:#B5CEA8">${s}</span>`);
}

// Renders whichever practical section fits the subject: a real code editor for programming
// modules, a worked-example reading panel for everything else, or a friendly empty state.
export default function IDEScreen({ type = "code", language = "java", content = "", note = "", modTitle = "", courseTag = "" }) {
  const [copied, setCopied] = useState(false);

  if (!content || type === "none") {
    return (
      <div style={{ width:"100%", height:"100%", background:"linear-gradient(145deg,#0F0C29,#1A1540)", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10 }}>
        <span style={{ fontSize:32 }}>📘</span>
        <p style={{ color:"#6B7280", fontSize:13 }}>No hands-on exercise for this module — ask SEMAI a question, or explore another module.</p>
      </div>
    );
  }

  if (type === "example") {
    return (
      <div style={{ width:"100%", height:"100%", background:"linear-gradient(145deg,#0F0C29,#1A1540,#0D1B3E)", display:"flex", flexDirection:"column" }}>
        <div style={{ background:"linear-gradient(90deg,#7C3AED,#4338CA)", padding:"18px 32px", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:24 }}>📘</span>
            <div>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.55)", letterSpacing:3, textTransform:"uppercase", marginBottom:3 }}>{modTitle}</div>
              <div style={{ fontSize:20, fontWeight:800, color:"white", lineHeight:1 }}>Worked Example</div>
            </div>
          </div>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>{courseTag}</span>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"30px 40px" }}>
          <p style={{ margin:0, fontSize:15, color:"#E2E8F0", lineHeight:1.9, whiteSpace:"pre-wrap" }}>{content}</p>
        </div>
        {note && (
          <div style={{ padding:"12px 32px", background:"rgba(0,0,0,0.3)", fontSize:12.5, color:"#A78BFA", lineHeight:1.6, flexShrink:0 }}>
            💡 {note}
          </div>
        )}
      </div>
    );
  }

  // type === "code"
  const lines = content.split("\n");
  const filename = `Main.${LANG_EXT[language] || "txt"}`;

  return (
    <div style={{ width:"100%", height:"100%", background:"#1E1E1E", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      {/* Title bar */}
      <div style={{ background:"#323233", display:"flex", alignItems:"center", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"0 14px" }}>
          <div style={{ width:12, height:12, borderRadius:"50%", background:"#FF5F57" }}/>
          <div style={{ width:12, height:12, borderRadius:"50%", background:"#FEBC2E" }}/>
          <div style={{ width:12, height:12, borderRadius:"50%", background:"#28C840" }}/>
        </div>
        <div style={{ background:"#1E1E1E", padding:"8px 18px", fontSize:12, color:"#CCC", borderTop:"2px solid #7C3AED", display:"flex", alignItems:"center", gap:8 }}>
          <span>💻</span> {filename}
        </div>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:10, color:"#555", padding:"0 8px" }}>{courseTag} — {modTitle}</span>
        <button onClick={()=>{navigator.clipboard?.writeText(content);setCopied(true);setTimeout(()=>setCopied(false),1500);}}
          style={{ background:"none", border:"none", padding:"0 16px", color:copied?"#4EC9B0":"#6B7280", cursor:"pointer", fontSize:11, height:"100%" }}>
          {copied?"✓ Copied":"⎘ Copy"}
        </button>
      </div>

      <div style={{ flex:1, display:"flex", overflow:"auto" }}>
        <div style={{ padding:"14px 12px", textAlign:"right", color:"#5A5A5A", fontFamily:"monospace", fontSize:13, lineHeight:1.6, userSelect:"none", background:"#1E1E1E", flexShrink:0 }}>
          {lines.map((_, i) => <div key={i}>{i+1}</div>)}
        </div>
        <pre style={{ flex:1, margin:0, padding:"14px 18px", fontFamily:"'Fira Code',monospace", fontSize:13, lineHeight:1.6, color:"#D4D4D4", whiteSpace:"pre" }}
          dangerouslySetInnerHTML={{ __html: hl(content, language) }} />
      </div>

      {note && (
        <div style={{ background:"#252526", borderTop:"1px solid #333", padding:"10px 18px", fontSize:12, color:"#9CA3AF", lineHeight:1.6, flexShrink:0 }}>
          💡 {note}
        </div>
      )}
    </div>
  );
}
