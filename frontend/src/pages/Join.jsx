import { useState, useEffect } from "react";
import { getCourses } from "../api";

export default function Join({ onJoin, onBack }) {
  const [name,     setName]     = useState("");
  const [courses,  setCourses]  = useState([]);
  const [courseId, setCourseId] = useState("");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    getCourses()
      .then(d => {
        const list = d.courses || [];
        setCourses(list);
        if (list.length) setCourseId(list[0].id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight:"100vh", background:"#0F0C29", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        input:focus,select:focus{outline:none;border-color:#7C3AED!important;box-shadow:0 0 0 2px rgba(124,58,237,0.2)!important}
      `}</style>

      <div style={{ textAlign:"center", width:"90%", maxWidth:400, padding:20 }}>
        {onBack && (
          <button onClick={onBack} style={{ background:"none", border:"none", color:"#4B5563", fontSize:12, cursor:"pointer", marginBottom:10, padding:0 }}>
            ← Back
          </button>
        )}
        {/* Logo */}
        <div style={{ width:76, height:76, borderRadius:22, background:"linear-gradient(135deg,#7C3AED,#4F46E5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:38, margin:"0 auto 20px", boxShadow:"0 0 40px rgba(124,58,237,0.45)", animation:"float 3s ease-in-out infinite" }}>☕</div>
        <h1 style={{ color:"white", fontSize:28, fontWeight:900, margin:"0 0 4px" }}>SEMAI</h1>
        <p style={{ color:"#A78BFA", fontSize:11, letterSpacing:3, margin:"0 0 4px" }}>AI JAVA LECTURER</p>
        <p style={{ color:"#4B5563", fontSize:11, margin:"0 0 24px" }}>SayMyTech Developers · Makerere University</p>

        <div style={{ background:"#1A1640", borderRadius:16, padding:24, border:"1px solid #2D2757" }}>
          <p style={{ color:"#9CA3AF", fontSize:13, margin:"0 0 16px" }}>Join today's lecture</p>

          {/* Name */}
          <label style={{ display:"block", color:"#6B7280", fontSize:11, textAlign:"left", marginBottom:4 }}>YOUR NAME</label>
          <input value={name} onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&name.trim()&&onJoin(name.trim(),courseId)}
            placeholder="Enter your name…" autoFocus
            style={{ width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid #3730A3", background:"#0F0C29", color:"white", fontSize:14, marginBottom:14, boxSizing:"border-box" }}/>

          {/* Course select */}
          <label style={{ display:"block", color:"#6B7280", fontSize:11, textAlign:"left", marginBottom:4 }}>COURSE</label>
          <select value={courseId} onChange={e=>setCourseId(e.target.value)}
            style={{ width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid #3730A3", background:"#0F0C29", color:"white", fontSize:13, marginBottom:18, boxSizing:"border-box" }}>
            {loading
              ? <option value="">Loading courses…</option>
              : courses.length
                ? courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)
                : <option value="">No courses available yet</option>
            }
          </select>

          <button onClick={()=>name.trim()&&courseId&&onJoin(name.trim(),courseId)} disabled={!name.trim()||!courseId}
            style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background:(name.trim()&&courseId)?"linear-gradient(135deg,#7C3AED,#4F46E5)":"#2D2757", color:(name.trim()&&courseId)?"white":"#6B7280", fontSize:14, fontWeight:700, cursor:(name.trim()&&courseId)?"pointer":"default" }}>
            Join Lecture →
          </button>
        </div>

        <p style={{ color:"#2D2757", fontSize:10, marginTop:14 }}>By Ssemambo Steven · SayMyTech Developers</p>
      </div>
    </div>
  );
}
