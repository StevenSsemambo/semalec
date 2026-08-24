import { useState, useRef, useEffect } from "react";

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
// When `steps` + `activeStepIndex` are provided, progressively highlights the portion SEMAI is
// currently narrating and dims what hasn't been reached yet — a real live walkthrough feel
// instead of a static dump of the whole thing at once.
export default function IDEScreen({ type = "code", language = "java", content = "", note = "", modTitle = "", courseTag = "", steps = null, activeStepIndex = -1 }) {
  const [copied, setCopied] = useState(false);
  const activeRef = useRef(null);
  const activeStep = steps && activeStepIndex >= 0 ? steps[activeStepIndex] : null;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior:"smooth", block:"center" });
  }, [activeStepIndex]);

  if (!content || type === "none") {
    return (
      <div style={{ width:"100%", height:"100%", background:"linear-gradient(145deg,#0F0C29,#1A1540)", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:10 }}>
        <span style={{ fontSize:32 }}>📘</span>
        <p style={{ color:"#6B7280", fontSize:13 }}>No hands-on exercise for this module — ask SEMAI a question, or explore another module.</p>
      </div>
    );
  }

  const StepDots = () => steps && steps.length > 1 ? (
    <div style={{ display:"flex", gap:5 }}>
      {steps.map((_, i) => (
        <div key={i} style={{ width: i===activeStepIndex ? 16 : 5, height:5, borderRadius:3, background: i===activeStepIndex ? "linear-gradient(90deg,#F0B429,#7C3AED)" : i < activeStepIndex ? "rgba(167,139,250,0.55)" : "rgba(255,255,255,0.14)", transition:"width 0.25s" }}/>
      ))}
    </div>
  ) : null;

  if (type === "example") {
    // Split content around the active step's verbatim snippet so we can dim what SEMAI
    // hasn't narrated yet and spotlight what's being explained right now.
    let before = content, mid = "", after = "";
    if (activeStep?.snippet) {
      const idx = content.indexOf(activeStep.snippet);
      if (idx !== -1) {
        before = content.slice(0, idx);
        mid = content.slice(idx, idx + activeStep.snippet.length);
        after = content.slice(idx + activeStep.snippet.length);
      }
    }
    const walkthroughActive = !!steps;

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
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <StepDots/>
            <span style={{ fontSize:10, color:"rgba(255,255,255,0.5)" }}>{courseTag}</span>
          </div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"30px 40px" }}>
          <p style={{ margin:0, fontSize:15, lineHeight:1.9, whiteSpace:"pre-wrap" }}>
            <span style={{ color: walkthroughActive ? "rgba(226,232,240,0.32)" : "#E2E8F0" }}>{before}</span>
            {mid && (
              <span ref={activeRef} style={{ color:"#FFF9E8", background:"rgba(240,180,41,0.16)", borderRadius:4, padding:"2px 3px", boxShadow:"0 0 0 1px rgba(240,180,41,0.4)" }}>{mid}</span>
            )}
            <span style={{ color:"rgba(226,232,240,0.2)" }}>{after}</span>
          </p>
        </div>
        {note && !steps && (
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
        {steps && <div style={{ paddingRight:14 }}><StepDots/></div>}
        <span style={{ fontSize:10, color:"#555", padding:"0 8px" }}>{courseTag} — {modTitle}</span>
        <button onClick={()=>{navigator.clipboard?.writeText(content);setCopied(true);setTimeout(()=>setCopied(false),1500);}}
          style={{ background:"none", border:"none", padding:"0 16px", color:copied?"#4EC9B0":"#6B7280", cursor:"pointer", fontSize:11, height:"100%" }}>
          {copied?"✓ Copied":"⎘ Copy"}
        </button>
      </div>

      <div style={{ flex:1, overflow:"auto" }}>
        {lines.map((lineText, i) => {
          const lineNo = i + 1;
          const inActiveStep = activeStep && lineNo >= activeStep.startLine && lineNo <= activeStep.endLine;
          const reached = !steps || !activeStep || lineNo <= activeStep.endLine;
          return (
            <div key={i} ref={inActiveStep && lineNo === activeStep.startLine ? activeRef : null}
              style={{ display:"flex", background: inActiveStep ? "rgba(240,180,41,0.09)" : "transparent", borderLeft: inActiveStep ? "3px solid #F0B429" : "3px solid transparent", opacity: reached ? 1 : 0.22, transition:"opacity 0.3s" }}>
              <div style={{ padding:"2px 12px", textAlign:"right", color:"#5A5A5A", fontFamily:"monospace", fontSize:13, lineHeight:1.6, userSelect:"none", flexShrink:0, minWidth:44 }}>
                {lineNo}
              </div>
              <pre style={{ flex:1, margin:0, padding:"2px 18px 2px 0", fontFamily:"'Fira Code',monospace", fontSize:13, lineHeight:1.6, color:"#D4D4D4", whiteSpace:"pre" }}
                dangerouslySetInnerHTML={{ __html: hl(lineText, language) || "&nbsp;" }} />
            </div>
          );
        })}
      </div>

      {note && !steps && (
        <div style={{ background:"#252526", borderTop:"1px solid #333", padding:"10px 18px", fontSize:12, color:"#9CA3AF", lineHeight:1.6, flexShrink:0 }}>
          💡 {note}
        </div>
      )}
    </div>
  );
}
