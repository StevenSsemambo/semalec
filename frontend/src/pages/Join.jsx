import { useState, useEffect } from "react";
import { getCourses, getInstitutions, resolveInstitution } from "../api";
import { supabase, signUpStudent, signInStudent, signOutStudent, getStudentSession, getLecturerProfile } from "../supabaseClient";

export default function Join({ onJoin, onBack, onTerms, onPrivacy }) {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [profile, setProfile] = useState(null);

  const [authMode, setAuthMode] = useState("signin"); // signin | signup
  const [authForm, setAuthForm] = useState({ email:"", password:"", name:"", institution:"" });
  const [authStatus, setAuthStatus] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [knownInstitutions, setKnownInstitutions] = useState([]);

  const [courses,  setCourses]  = useState([]);
  const [courseId, setCourseId] = useState("");
  const [loadingCourses, setLoadingCourses] = useState(false);

  useEffect(() => { getInstitutions().then(setKnownInstitutions).catch(()=>{}); }, []);

  useEffect(() => {
    getStudentSession().then(s => setSession(s ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    getLecturerProfile(session.user.id).then(setProfile); // same profiles table for both roles
  }, [session]);

  useEffect(() => {
    if (!profile?.institution_id) { setCourses([]); setCourseId(""); return; }
    setLoadingCourses(true);
    getCourses(profile.institution_id)
      .then(d => {
        const list = d.courses || [];
        setCourses(list);
        setCourseId(list.length ? list[0].id : "");
        setLoadingCourses(false);
      })
      .catch(() => setLoadingCourses(false));
  }, [profile]);

  async function submitAuth() {
    setAuthStatus(""); setAuthLoading(true);
    try {
      if (authMode === "signup") {
        if (!authForm.name.trim()) throw new Error("Name is required.");
        if (!authForm.institution.trim()) throw new Error("Institution is required.");
        if (!agreed) throw new Error("Please agree to the Terms and Privacy Policy to continue.");
        const inst = await resolveInstitution(authForm.institution);
        await signUpStudent({ ...authForm, institution: inst.name, institutionId: inst.id });
        setAuthStatus("✅ Account created! Check your email to confirm, then sign in.");
        setAuthMode("signin");
      } else {
        await signInStudent(authForm);
      }
    } catch (err) {
      setAuthStatus(`❌ ${err.message || "Something went wrong."}`);
    }
    setAuthLoading(false);
  }

  const inputStyle = { width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid #3730A3", background:"#0F0C29", color:"white", fontSize:13, marginBottom:12, boxSizing:"border-box" };

  return (
    <div style={{ minHeight:"100vh", background:"#0F0C29", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        input:focus,select:focus{outline:none;border-color:#7C3AED!important;box-shadow:0 0 0 2px rgba(124,58,237,0.2)!important}
      `}</style>

      <div style={{ textAlign:"center", width:"90%", maxWidth:400, padding:20 }}>
        {onBack && (
          <button onClick={onBack} style={{ background:"none", border:"none", color:"#4B5563", fontSize:12, cursor:"pointer", marginBottom:10, padding:0 }}>← Back</button>
        )}
        <div style={{ width:76, height:76, borderRadius:22, background:"linear-gradient(135deg,#7C3AED,#4F46E5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:38, margin:"0 auto 20px", boxShadow:"0 0 40px rgba(124,58,237,0.45)", animation:"float 3s ease-in-out infinite" }}>☕</div>
        <h1 style={{ color:"white", fontSize:28, fontWeight:900, margin:"0 0 4px" }}>SEMAI</h1>
        <p style={{ color:"#A78BFA", fontSize:11, letterSpacing:3, margin:"0 0 4px" }}>AI LECTURER</p>
        <p style={{ color:"#4B5563", fontSize:11, margin:"0 0 24px" }}>SayMyTech Developers</p>

        {session === undefined ? (
          <p style={{ color:"#6B7280", fontSize:13 }}>Checking your session…</p>

        ) : !session ? (
          <div style={{ background:"#1A1640", borderRadius:16, padding:24, border:"1px solid #2D2757", textAlign:"left" }}>
            <div style={{ display:"flex", gap:0, marginBottom:16, borderBottom:"1px solid #2D2757" }}>
              {["signin","signup"].map(m => (
                <button key={m} onClick={()=>{setAuthMode(m); setAuthStatus("");}}
                  style={{ flex:1, background:"none", border:"none", borderBottom:authMode===m?"2px solid #7C3AED":"2px solid transparent", color:authMode===m?"#A78BFA":"#6B7280", cursor:"pointer", padding:"8px 0", fontSize:12.5, fontWeight:authMode===m?600:400 }}>
                  {m==="signin" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            {authMode==="signup" && (
              <>
                <label style={{ display:"block", color:"#6B7280", fontSize:11, marginBottom:4 }}>YOUR NAME</label>
                <input value={authForm.name} onChange={e=>setAuthForm(f=>({...f,name:e.target.value}))} style={inputStyle}/>

                <label style={{ display:"block", color:"#6B7280", fontSize:11, marginBottom:4 }}>SCHOOL / INSTITUTION</label>
                <input value={authForm.institution} onChange={e=>setAuthForm(f=>({...f,institution:e.target.value}))}
                  placeholder="e.g. Makerere University" list="known-institutions-student" style={inputStyle}/>
                <datalist id="known-institutions-student">
                  {knownInstitutions.map(i => <option key={i.id} value={i.name}/>)}
                </datalist>
              </>
            )}

            <label style={{ display:"block", color:"#6B7280", fontSize:11, marginBottom:4 }}>EMAIL</label>
            <input type="email" value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))} style={inputStyle}/>

            <label style={{ display:"block", color:"#6B7280", fontSize:11, marginBottom:4 }}>PASSWORD</label>
            <input type="password" value={authForm.password} onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&submitAuth()} style={{...inputStyle, marginBottom:16}}/>

            {authStatus && <p style={{ color: authStatus.startsWith("✅")?"#34D399":"#F87171", fontSize:12, marginBottom:12 }}>{authStatus}</p>}

            {authMode==="signup" && (
              <label style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:14, cursor:"pointer" }}>
                <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ marginTop:2, flexShrink:0 }}/>
                <span style={{ fontSize:11, color:"#6B7280", lineHeight:1.5 }}>
                  I agree to the{" "}
                  {onTerms ? <button onClick={onTerms} style={{ background:"none", border:"none", color:"#A78BFA", fontSize:11, cursor:"pointer", padding:0, textDecoration:"underline" }}>Terms</button> : "Terms"}
                  {" "}and{" "}
                  {onPrivacy ? <button onClick={onPrivacy} style={{ background:"none", border:"none", color:"#A78BFA", fontSize:11, cursor:"pointer", padding:0, textDecoration:"underline" }}>Privacy Policy</button> : "Privacy Policy"}.
                </span>
              </label>
            )}

            <button onClick={submitAuth} disabled={authLoading || !authForm.email || !authForm.password || (authMode==="signup" && !agreed)}
              style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background:authLoading?"#374151":"linear-gradient(135deg,#7C3AED,#4F46E5)", color:"white", fontSize:14, fontWeight:700, cursor:authLoading?"default":"pointer" }}>
              {authLoading ? "Please wait…" : authMode==="signin" ? "Sign In →" : "Create Account →"}
            </button>
          </div>

        ) : (
          <div style={{ background:"#1A1640", borderRadius:16, padding:24, border:"1px solid #2D2757" }}>
            <p style={{ color:"#9CA3AF", fontSize:13, margin:"0 0 4px" }}>Welcome back, {profile?.name || session.user.email}</p>
            <p style={{ color:"#4B5563", fontSize:11, margin:"0 0 16px" }}>{profile?.institution || "…"}</p>

            <label style={{ display:"block", color:"#6B7280", fontSize:11, textAlign:"left", marginBottom:4 }}>COURSE</label>
            <select value={courseId} onChange={e=>setCourseId(e.target.value)} style={{...inputStyle, marginBottom:18}}>
              {loadingCourses
                ? <option value="">Loading courses…</option>
                : courses.length
                  ? courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)
                  : <option value="">No courses available yet for your institution</option>
              }
            </select>

            <button onClick={()=>courseId && onJoin(profile?.name || session.user.email, courseId, session.user.id)} disabled={!courseId}
              style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background:courseId?"linear-gradient(135deg,#7C3AED,#4F46E5)":"#2D2757", color:courseId?"white":"#6B7280", fontSize:14, fontWeight:700, cursor:courseId?"pointer":"default", marginBottom:10 }}>
              Join Lecture →
            </button>
            <button onClick={()=>signOutStudent()}
              style={{ width:"100%", background:"none", border:"none", color:"#4B5563", fontSize:11.5, cursor:"pointer" }}>
              Not you? Sign out
            </button>
          </div>
        )}

        <p style={{ color:"#2D2757", fontSize:10, marginTop:14 }}>By Ssemambo Steven · SayMyTech Developers</p>
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
