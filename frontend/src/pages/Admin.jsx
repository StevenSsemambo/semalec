import { useState, useEffect, useRef } from "react";
import { getCourses, getCourse, deleteCourse, saveCourse, generateCourse, generateModule, uploadCourseSource, getInstitutions, resolveInstitution, getInstitutionLecturers, getInstitutionStudents, setLecturerAdmin, getInstitutionProgressSummary, getInstitutionUsage } from "../api";
import { supabase, signUpLecturer, signInLecturer, signOutLecturer, getLecturerProfile, getCourseProgress } from "../supabaseClient";

export default function Admin({ onBack, onTerms, onPrivacy }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = signed out
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState("signin"); // signin | signup
  const [agreed, setAgreed] = useState(false);
  const [authForm, setAuthForm] = useState({ email:"", password:"", name:"", institution:"" });
  const [authStatus, setAuthStatus] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [knownInstitutions, setKnownInstitutions] = useState([]);

  useEffect(() => { getInstitutions().then(setKnownInstitutions).catch(()=>{}); }, []);

  const [courses, setCourses] = useState([]);
  const [tab, setTab] = useState("list"); // list | generate | edit | progress | institution
  const [progressCourseId, setProgressCourseId] = useState("");
  const [progressRows, setProgressRows] = useState([]);
  const [progressLoading, setProgressLoading] = useState(false);

  const [instLecturers, setInstLecturers] = useState([]);
  const [instStudents, setInstStudents] = useState([]);
  const [instProgress, setInstProgress] = useState([]);
  const [instUsage, setInstUsage] = useState([]);
  const [instLoading, setInstLoading] = useState(false);

  useEffect(() => {
    if (tab !== "institution" || !profile?.is_admin || !profile?.institution_id) return;
    setInstLoading(true);
    Promise.all([
      getInstitutionLecturers(profile.institution_id),
      getInstitutionStudents(profile.institution_id),
      getInstitutionProgressSummary(profile.institution_id),
    ]).then(async ([lecturers, students, progress]) => {
      setInstLecturers(lecturers);
      setInstStudents(students);
      setInstProgress(progress);
      const usage = await getInstitutionUsage([...lecturers, ...students].map(p => p.id)).catch(() => []);
      setInstUsage(usage);
      setInstLoading(false);
    }).catch(() => setInstLoading(false));
  }, [tab, profile]);

  const toggleLecturerAdmin = async (id, current) => {
    try {
      await setLecturerAdmin(id, !current);
      setInstLecturers(list => list.map(l => l.id === id ? { ...l, is_admin: !current } : l));
    } catch (err) { alert(err.message); }
  };

  useEffect(() => {
    if (tab !== "progress") return;
    if (!progressCourseId && courses.length) setProgressCourseId(courses[0].id);
  }, [tab, courses]);

  useEffect(() => {
    if (tab !== "progress" || !progressCourseId) return;
    setProgressLoading(true);
    getCourseProgress(progressCourseId)
      .then(rows => { setProgressRows(rows); setProgressLoading(false); })
      .catch(() => setProgressLoading(false));
  }, [tab, progressCourseId]);

  const [genForm, setGenForm] = useState({ title:"", lecturer:"", institution:"", sourceText:"" });
  const [genStatus, setGenStatus] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  // ── Edit-existing-course state ──────────────────────────────────────────
  const [editingCourse, setEditingCourse] = useState(null); // full course object being edited, or null
  const [editLoading, setEditLoading] = useState(false);
  const [editStatus, setEditStatus] = useState("");

  // ── Add-module-via-AI state (within Edit mode) ──────────────────────────
  const [showAddModule, setShowAddModule] = useState(false);
  const [newModForm, setNewModForm] = useState({ moduleTitle:"", sourceText:"" });
  const [newModLoading, setNewModLoading] = useState(false);
  const [newModStatus, setNewModStatus] = useState("");

  // ── Auth session ─────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      getLecturerProfile(session.user.id).then(p => {
        setProfile(p);
        if (p) setGenForm(f => ({ ...f, lecturer: p.name, institution: p.institution || "" }));
      });
    } else {
      setProfile(null);
    }
  }, [session]);

  const load = () => getCourses().then(d => setCourses(d.courses || []));
  useEffect(() => { if (session) load(); }, [session]);

  const submitAuth = async () => {
    setAuthLoading(true); setAuthStatus("");
    try {
      if (authMode === "signup") {
        if (!authForm.name.trim()) throw new Error("Name is required.");
        if (!authForm.institution.trim()) throw new Error("Institution is required.");
        if (!agreed) throw new Error("Please agree to the Terms and Privacy Policy to continue.");
        const inst = await resolveInstitution(authForm.institution);
        await signUpLecturer({ ...authForm, institution: inst.name, institutionId: inst.id, isAdmin: inst.created });
        setAuthStatus("✅ Account created! Check your email to confirm, then sign in.");
        setAuthMode("signin");
      } else {
        await signInLecturer(authForm);
      }
    } catch (err) {
      setAuthStatus(`❌ ${err.message || "Something went wrong."}`);
    }
    setAuthLoading(false);
  };

  const signOut = async () => { await signOutLecturer(); };

  const del = async (id) => {
    if (!confirm("Delete this course? This removes it for everyone using the app.")) return;
    try { await deleteCourse(id); load(); } catch (err) { alert(err.message); }
  };

  // ── Edit flow ────────────────────────────────────────────────────────────
  const startEdit = async (id) => {
    setTab("edit"); setEditingCourse(null); setEditStatus("");
    setShowAddModule(false); setNewModForm({ moduleTitle:"", sourceText:"" }); setNewModStatus("");
    try {
      const course = await getCourse(id);
      setEditingCourse(course);
    } catch (err) {
      setEditStatus(`❌ ${err.message}`);
    }
  };

  const updateField = (key, value) => setEditingCourse(c => ({ ...c, [key]: value }));

  const updateModule = (mi, key, value) => setEditingCourse(c => {
    const modules = [...c.modules];
    modules[mi] = { ...modules[mi], [key]: value };
    return { ...c, modules };
  });

  const generateAndAddModule = async () => {
    if (!newModForm.moduleTitle.trim()) { setNewModStatus("❌ Give the new module a topic/title."); return; }
    if (!newModForm.sourceText.trim()) { setNewModStatus("❌ Describe or paste what this module should cover."); return; }
    setNewModLoading(true); setNewModStatus("");
    try {
      const module = await generateModule({
        courseTitle: editingCourse.title,
        subject: editingCourse.subject,
        moduleTitle: newModForm.moduleTitle,
        sourceText: newModForm.sourceText,
      });
      setEditingCourse(c => ({ ...c, modules: [...c.modules, module] }));
      setNewModForm({ moduleTitle:"", sourceText:"" });
      setShowAddModule(false);
      setNewModStatus("");
    } catch (err) {
      setNewModStatus(`❌ ${err.message || "Generation failed — please try again."}`);
    }
    setNewModLoading(false);
  };

  const removeModule = (mi) => {
    if (!confirm("Remove this module? This won't take effect until you save.")) return;
    setEditingCourse(c => ({ ...c, modules: c.modules.filter((_, i) => i !== mi) }));
  };

  const moveModule = (mi, dir) => setEditingCourse(c => {
    const modules = [...c.modules];
    const target = mi + dir;
    if (target < 0 || target >= modules.length) return c;
    [modules[mi], modules[target]] = [modules[target], modules[mi]];
    return { ...c, modules };
  });

  const updateSlide = (mi, si, key, value) => setEditingCourse(c => {
    const modules = [...c.modules];
    const slides = [...modules[mi].slides];
    slides[si] = { ...slides[si], [key]: value };
    modules[mi] = { ...modules[mi], slides };
    return { ...c, modules };
  });

  const updateBullets = (mi, si, text) => updateSlide(mi, si, "bullets", text.split("\n"));

  const addSlide = (mi) => setEditingCourse(c => {
    const modules = [...c.modules];
    modules[mi] = { ...modules[mi], slides: [...modules[mi].slides, { title: "New slide", bullets: [""] }] };
    return { ...c, modules };
  });

  const removeSlide = (mi, si) => setEditingCourse(c => {
    const modules = [...c.modules];
    modules[mi] = { ...modules[mi], slides: modules[mi].slides.filter((_, i) => i !== si) };
    return { ...c, modules };
  });

  const saveEdits = async () => {
    if (!editingCourse) return;
    if (!editingCourse.title.trim()) { setEditStatus("❌ Course title is required."); return; }
    setEditLoading(true); setEditStatus("");
    try {
      const payload = {
        ...editingCourse,
        modules: editingCourse.modules.map(m => ({
          ...m,
          slides: m.slides.map(s => ({ ...s, bullets: s.bullets.filter(b => b.trim()) })),
        })),
      };
      await saveCourse(payload);
      setEditStatus("✅ Changes saved!");
      load();
      setTimeout(() => { setTab("list"); setEditingCourse(null); }, 700);
    } catch (err) {
      setEditStatus(`❌ ${err.message || "Save failed — please try again."}`);
    }
    setEditLoading(false);
  };

  // ── Generate flow ────────────────────────────────────────────────────────
  const genInp = (field) => ({
    value: genForm[field],
    onChange: e => setGenForm(f => ({ ...f, [field]: e.target.value })),
    style: { width:"100%", padding:"10px 13px", borderRadius:9, border:"1px solid #374151", background:"#111827", color:"white", fontSize:13, outline:"none", boxSizing:"border-box", marginBottom:12 },
  });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true); setGenStatus("");
    try {
      const { text } = await uploadCourseSource(file);
      setGenForm(f => ({ ...f, sourceText: f.sourceText ? `${f.sourceText}\n\n${text}` : text }));
      setGenStatus(`✅ Extracted text from ${file.name} — review it below before generating.`);
    } catch (err) {
      setGenStatus(`❌ ${err.message}`);
    }
    setUploadLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const runGenerate = async () => {
    if (!genForm.title.trim()) { setGenStatus("❌ Course title is required."); return; }
    if (!genForm.sourceText.trim()) { setGenStatus("❌ Describe the content, or upload a PDF/file first."); return; }
    setGenLoading(true); setGenStatus(""); setPreview(null);
    try {
      const course = await generateCourse(genForm);
      setPreview(course);
      setGenStatus(`✅ Generated ${course.modules.length} module${course.modules.length===1?"":"s"}${course.subject ? ` for ${course.subject}` : ""} — review below, then save.`);
    } catch (err) {
      setGenStatus(`❌ ${err.message || "Generation failed — please try again."}`);
    }
    setGenLoading(false);
  };

  const savePreview = async () => {
    if (!preview) return;
    setGenLoading(true);
    try {
      await saveCourse({ title: genForm.title, ...preview });
      setGenStatus("✅ Course unit saved! It's now available to every student on the Join screen.");
      setPreview(null);
      setGenForm(f => ({ title:"", lecturer:f.lecturer, institution:f.institution, sourceText:"" }));
      load();
      setTab("list");
    } catch (err) {
      setGenStatus(`❌ ${err.message || "Save failed — please try again."}`);
    }
    setGenLoading(false);
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (session === undefined) {
    return <div style={{ height:"100vh", background:"#0F0C29", display:"flex", alignItems:"center", justifyContent:"center", color:"#6B7280", fontFamily:"system-ui" }}>Loading…</div>;
  }

  // ── Sign in / sign up gate ───────────────────────────────────────────────
  if (!session) {
    return (
      <div style={{ minHeight:"100vh", background:"#0F0C29", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
        <div style={{ width:"90%", maxWidth:380, padding:20 }}>
          <div style={{ textAlign:"center", marginBottom:20 }}>
            <div style={{ width:64, height:64, borderRadius:18, background:"linear-gradient(135deg,#7C3AED,#4F46E5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto 14px" }}>🎓</div>
            <h2 style={{ color:"white", fontSize:20, fontWeight:800, margin:"0 0 4px" }}>Lecturer {authMode === "signup" ? "Sign Up" : "Sign In"}</h2>
            <p style={{ color:"#6B7280", fontSize:12, margin:0 }}>Any subject welcome — programming, business, science, law, and more.</p>
          </div>
          <div style={{ background:"#1A1640", borderRadius:16, padding:22, border:"1px solid #2D2757" }}>
            {authMode === "signup" && (
              <>
                <label style={{ display:"block", color:"#6B7280", fontSize:11, marginBottom:4 }}>YOUR NAME *</label>
                <input value={authForm.name} onChange={e=>setAuthForm(f=>({...f,name:e.target.value}))}
                  placeholder="e.g. Ssemambo Steven"
                  style={{ width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid #3730A3", background:"#0F0C29", color:"white", fontSize:14, marginBottom:12, boxSizing:"border-box" }}/>
                <label style={{ display:"block", color:"#6B7280", fontSize:11, marginBottom:4 }}>INSTITUTION *</label>
                <input value={authForm.institution} onChange={e=>setAuthForm(f=>({...f,institution:e.target.value}))}
                  placeholder="e.g. Makerere University Business School" list="known-institutions"
                  style={{ width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid #3730A3", background:"#0F0C29", color:"white", fontSize:14, marginBottom:4, boxSizing:"border-box" }}/>
                <datalist id="known-institutions">
                  {knownInstitutions.map(i => <option key={i.id} value={i.name}/>)}
                </datalist>
                <p style={{ color:"#4B5563", fontSize:10.5, margin:"0 0 12px" }}>Pick your school if it's already registered, or type a new one — your courses stay separate from other institutions.</p>
              </>
            )}
            <label style={{ display:"block", color:"#6B7280", fontSize:11, marginBottom:4 }}>EMAIL *</label>
            <input type="email" value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))}
              placeholder="you@example.com"
              style={{ width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid #3730A3", background:"#0F0C29", color:"white", fontSize:14, marginBottom:12, boxSizing:"border-box" }}/>
            <label style={{ display:"block", color:"#6B7280", fontSize:11, marginBottom:4 }}>PASSWORD *</label>
            <input type="password" value={authForm.password} onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&submitAuth()} placeholder="At least 6 characters"
              style={{ width:"100%", padding:"11px 14px", borderRadius:10, border:"1px solid #3730A3", background:"#0F0C29", color:"white", fontSize:14, marginBottom:16, boxSizing:"border-box" }}/>

            {authStatus && <p style={{ color: authStatus.startsWith("✅")?"#34D399":"#F87171", fontSize:12, marginBottom:12 }}>{authStatus}</p>}

            {authMode === "signup" && (
              <label style={{ display:"flex", alignItems:"flex-start", gap:8, marginBottom:14, cursor:"pointer" }}>
                <input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)} style={{ marginTop:2, flexShrink:0 }}/>
                <span style={{ fontSize:11, color:"#6B7280", lineHeight:1.5 }}>
                  I agree to the{" "}
                  {onTerms ? <button onClick={onTerms} style={{ background:"none", border:"none", color:"#A78BFA", fontSize:11, cursor:"pointer", padding:0, textDecoration:"underline" }}>Terms</button> : "Terms"}
                  {" "}and{" "}
                  {onPrivacy ? <button onClick={onPrivacy} style={{ background:"none", border:"none", color:"#A78BFA", fontSize:11, cursor:"pointer", padding:0, textDecoration:"underline" }}>Privacy Policy</button> : "Privacy Policy"}, and confirm I have my institution's authorization to create lecturer accounts and enroll students.
                </span>
              </label>
            )}

            <button onClick={submitAuth} disabled={authLoading || !authForm.email.trim() || !authForm.password.trim() || (authMode==="signup" && !agreed)}
              style={{ width:"100%", padding:"13px", borderRadius:10, border:"none", background:authLoading?"#374151":"linear-gradient(135deg,#7C3AED,#4F46E5)", color:"white", fontSize:14, fontWeight:700, cursor:authLoading?"default":"pointer", marginBottom:12 }}>
              {authLoading ? "Please wait…" : authMode === "signup" ? "Create Account →" : "Sign In →"}
            </button>

            <button onClick={()=>{ setAuthMode(m=>m==="signup"?"signin":"signup"); setAuthStatus(""); }}
              style={{ width:"100%", background:"none", border:"none", color:"#6B7280", fontSize:12, cursor:"pointer" }}>
              {authMode === "signup" ? "Already have an account? Sign in" : "New here? Create a lecturer account"}
            </button>
          </div>
          <button onClick={onBack} style={{ display:"block", margin:"14px auto 0", background:"none", border:"none", color:"#4B5563", fontSize:12, cursor:"pointer" }}>← Back</button>
          {(onTerms || onPrivacy) && (
            <p style={{ textAlign:"center", fontSize:10, marginTop:8 }}>
              {onTerms && <button onClick={onTerms} style={{ background:"none", border:"none", color:"#4B5563", fontSize:10, cursor:"pointer", padding:0, textDecoration:"underline" }}>Terms</button>}
              {onTerms && onPrivacy && <span style={{ color:"#2D2757", margin:"0 6px" }}>·</span>}
              {onPrivacy && <button onClick={onPrivacy} style={{ background:"none", border:"none", color:"#4B5563", fontSize:10, cursor:"pointer", padding:0, textDecoration:"underline" }}>Privacy</button>}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Signed in ────────────────────────────────────────────────────────────
  const displayName = profile?.name || session.user.email;

  return (
    <div style={{ minHeight:"100vh", background:"#0F0C29", fontFamily:"'Segoe UI',system-ui,sans-serif", color:"white" }}>
      <div style={{ background:"#161616", borderBottom:"1px solid #2D2D2D", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>🎓</span>
          <span style={{ fontWeight:700, fontSize:15 }}>SEMAI Admin</span>
          <span style={{ color:"#4B5563", fontSize:11 }}>· {displayName}{profile?.institution ? ` · ${profile.institution}` : ""}</span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={signOut} style={{ background:"#2D2D2D", border:"none", borderRadius:8, padding:"6px 14px", color:"#9CA3AF", cursor:"pointer", fontSize:12 }}>Sign out</button>
          <button onClick={onBack} style={{ background:"#1F2937", border:"1px solid #374151", borderRadius:8, padding:"6px 14px", color:"#9CA3AF", cursor:"pointer", fontSize:12 }}>← Back</button>
        </div>
      </div>

      <div style={{ maxWidth:740, margin:"30px auto", padding:"0 20px 60px" }}>
        <div style={{ display:"flex", gap:0, marginBottom:20, borderBottom:"1px solid #2D2D2D" }}>
          {["list","generate","progress", ...(profile?.is_admin ? ["institution"] : []), ...(tab==="edit" ? ["edit"] : [])].map(t => (
            <button key={t} onClick={()=>{ if (t!=="edit") setTab(t); }} style={{ background:"none", border:"none", borderBottom:tab===t?"2px solid #7C3AED":"2px solid transparent", color:tab===t?"#A78BFA":"#6B7280", cursor:t==="edit"?"default":"pointer", padding:"9px 18px", fontSize:13, fontWeight:tab===t?600:400 }}>
              {t==="list" ? `📚 All Course Units (${courses.length})` : t==="generate" ? "✨ Add a Course Unit" : t==="progress" ? "📊 Student Progress" : t==="institution" ? "🏛️ Institution" : `✏️ Editing: ${editingCourse?.title || "…"}`}
            </button>
          ))}
        </div>

        {tab==="list" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <p style={{ color:"#4B5563", fontSize:11, margin:"0 0 6px" }}>
              This list is shared — every course unit added by any lecturer appears here and on every
              student's Join screen. You can only delete units you created yourself.
            </p>
            {courses.length === 0 && <p style={{ color:"#4B5563", textAlign:"center", marginTop:30 }}>No courses yet. Try "Add a Course Unit" above.</p>}
            {courses.map(c => {
              const isMine = c.lecturer && (c.lecturer === profile?.name || c.lecturer === session.user.email);
              return (
                <div key={c.id} style={{ background:"#1A1A2E", border:"1px solid #2D2D4A", borderRadius:12, padding:"16px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:3 }}>{c.title}</div>
                    <div style={{ color:"#6B7280", fontSize:11 }}>
                      {c.moduleCount} modules{c.subject ? ` · ${c.subject}` : ""}{c.lecturer ? ` · by ${c.lecturer}` : ""}
                    </div>
                    {c.description && <div style={{ color:"#4B5563", fontSize:11, marginTop:3 }}>{c.description.slice(0,90)}…</div>}
                  </div>
                  {isMine && (
                    <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                      <button onClick={()=>startEdit(c.id)} style={{ background:"#374151", border:"none", borderRadius:7, padding:"6px 12px", color:"white", cursor:"pointer", fontSize:11 }}>Edit</button>
                      <button onClick={()=>del(c.id)} style={{ background:"#991B1B", border:"none", borderRadius:7, padding:"6px 12px", color:"white", cursor:"pointer", fontSize:11 }}>Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab==="generate" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"#1A1A2E", border:"1px solid #2D2D4A", borderRadius:14, padding:24 }}>
              <h3 style={{ margin:"0 0 4px", fontSize:15, color:"#A78BFA" }}>Add a new course unit</h3>
              <p style={{ color:"#6B7280", fontSize:12, margin:"0 0 18px" }}>
                Works for any subject — programming, business, marketing, accounting, history, science,
                law, anything you teach. Every course you add becomes its own separate unit and appears
                as a new option on the Join screen for every student. Upload your slides or a syllabus
                PDF, paste your notes, or just describe the topics you want covered — SEMAI will design
                the modules, slides, and a fitting hands-on exercise (code for technical subjects, a
                worked example for everything else).
              </p>

              <label style={{ fontSize:11, color:"#6B7280" }}>COURSE TITLE *</label>
              <input {...genInp("title")} placeholder="e.g. BUS 220 — Principles of Marketing"/>

              <label style={{ fontSize:11, color:"#6B7280" }}>LECTURER NAME</label>
              <input {...genInp("lecturer")} placeholder="e.g. Ssemambo Steven"/>

              <label style={{ fontSize:11, color:"#6B7280" }}>INSTITUTION</label>
              <input {...genInp("institution")} placeholder="e.g. Makerere University"/>

              <label style={{ fontSize:11, color:"#6B7280" }}>UPLOAD SLIDES / SYLLABUS (PDF or .txt)</label>
              <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:12 }}>
                <input ref={fileInputRef} type="file" accept=".pdf,.txt" onChange={handleFile}
                  style={{ fontSize:12, color:"#9CA3AF" }}/>
                {uploadLoading && <span style={{ fontSize:11, color:"#A78BFA" }}>Extracting text…</span>}
              </div>

              <label style={{ fontSize:11, color:"#6B7280" }}>OR PASTE YOUR COURSE / MODULE OUTLINE *</label>
              <p style={{ color:"#4B5563", fontSize:11, margin:"2px 0 6px" }}>
                Paste a syllabus, lecture notes, or just describe the concepts you want SEMAI to teach —
                the more detail you give, the closer the generated slides will match your actual lecture.
              </p>
              <textarea value={genForm.sourceText} onChange={e=>setGenForm(f=>({...f,sourceText:e.target.value}))}
                placeholder="Paste a course outline like:&#10;&#10;Module 1: Introduction to the 4 Ps — product, price, place, promotion, with real brand examples.&#10;Module 2: Market Segmentation — demographic, psychographic, and behavioural segmentation, case study.&#10;Module 3: Digital Marketing Basics — SEO, social media, email campaigns, measuring ROI.&#10;&#10;...or just describe the topics you want covered."
                rows={9}
                style={{ width:"100%", padding:"10px 13px", borderRadius:9, border:"1px solid #374151", background:"#111827", color:"white", fontSize:13, outline:"none", boxSizing:"border-box", resize:"vertical", marginBottom:14 }}/>

              {genStatus && <p style={{ color: genStatus.startsWith("✅")?"#34D399":"#F87171", fontSize:12, marginBottom:10 }}>{genStatus}</p>}

              <button onClick={runGenerate} disabled={genLoading}
                style={{ background:genLoading?"#374151":"linear-gradient(135deg,#7C3AED,#4F46E5)", border:"none", borderRadius:10, padding:"12px 24px", color:"white", cursor:genLoading?"default":"pointer", fontSize:13, fontWeight:700 }}>
                {genLoading ? "SEMAI is designing your course…" : "✨ Generate Course"}
              </button>
            </div>

            {preview && (
              <div style={{ background:"#1A1A2E", border:"1px solid #2D2D4A", borderRadius:14, padding:24 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6, flexWrap:"wrap", gap:10 }}>
                  <div>
                    <h3 style={{ margin:0, fontSize:15, color:"#A78BFA" }}>Preview: {genForm.title}</h3>
                    <p style={{ color:"#6B7280", fontSize:12, margin:"4px 0 0" }}>{preview.description}{preview.subject ? ` · ${preview.subject}` : ""}</p>
                  </div>
                  <button onClick={savePreview} disabled={genLoading}
                    style={{ background:"#7C3AED", border:"none", borderRadius:9, padding:"10px 18px", color:"white", cursor:"pointer", fontSize:12, fontWeight:700, whiteSpace:"nowrap", flexShrink:0 }}>
                    ✅ Save Course
                  </button>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:12, marginTop:16 }}>
                  {preview.modules.map((m, i) => (
                    <div key={m.id} style={{ background:"#111827", border:"1px solid #2D2D4A", borderRadius:10, padding:14 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                        <span style={{ fontSize:18 }}>{m.icon}</span>
                        <span style={{ fontWeight:600, fontSize:13 }}>{i+1}. {m.title}</span>
                        <span style={{ color:"#4B5563", fontSize:11, marginLeft:"auto" }}>{m.slides.length} slides</span>
                      </div>
                      {m.slides.map((s, si) => (
                        <div key={si} style={{ marginBottom:8, paddingLeft:10, borderLeft:"2px solid #2D2D4A" }}>
                          <div style={{ fontSize:12, color:"#E2E8F0", fontWeight:600, marginBottom:2 }}>{s.title}</div>
                          <ul style={{ margin:0, paddingLeft:16, color:"#9CA3AF", fontSize:11.5, lineHeight:1.6 }}>
                            {s.bullets.map((b, bi) => <li key={bi}>{b}</li>)}
                          </ul>
                        </div>
                      ))}
                      {m.practicalType !== "none" && m.practical && (
                        <details style={{ marginTop:8 }}>
                          <summary style={{ cursor:"pointer", fontSize:11, color:"#7C3AED" }}>
                            View {m.practicalType === "code" ? `code demo (${m.practicalLanguage || "code"})` : "worked example"}
                          </summary>
                          <pre style={{ background:"#0A0A0A", borderRadius:7, padding:10, fontSize:11, color:"#D4D4D4", overflowX:"auto", marginTop:6, fontFamily:"'Fira Code',monospace", whiteSpace:"pre-wrap" }}>{m.practical}</pre>
                          {m.practicalNote && <p style={{ color:"#6B7280", fontSize:11, marginTop:6 }}>{m.practicalNote}</p>}
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab==="edit" && (
          !editingCourse ? (
            <p style={{ color:"#6B7280", textAlign:"center", marginTop:30 }}>{editStatus || "Loading course…"}</p>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background:"#1A1A2E", border:"1px solid #2D2D4A", borderRadius:14, padding:24 }}>
                <h3 style={{ margin:"0 0 14px", fontSize:15, color:"#A78BFA" }}>Course details</h3>
                <label style={{ fontSize:11, color:"#6B7280" }}>TITLE</label>
                <input value={editingCourse.title} onChange={e=>updateField("title", e.target.value)}
                  style={{ width:"100%", padding:"10px 13px", borderRadius:9, border:"1px solid #374151", background:"#111827", color:"white", fontSize:13, boxSizing:"border-box", marginBottom:12 }}/>
                <label style={{ fontSize:11, color:"#6B7280" }}>DESCRIPTION</label>
                <input value={editingCourse.description} onChange={e=>updateField("description", e.target.value)}
                  style={{ width:"100%", padding:"10px 13px", borderRadius:9, border:"1px solid #374151", background:"#111827", color:"white", fontSize:13, boxSizing:"border-box", marginBottom:12 }}/>
                <label style={{ fontSize:11, color:"#6B7280" }}>SUBJECT</label>
                <input value={editingCourse.subject} onChange={e=>updateField("subject", e.target.value)}
                  style={{ width:"100%", padding:"10px 13px", borderRadius:9, border:"1px solid #374151", background:"#111827", color:"white", fontSize:13, boxSizing:"border-box" }}/>
              </div>

              {editingCourse.modules.map((m, mi) => (
                <div key={m.id || mi} style={{ background:"#1A1A2E", border:"1px solid #2D2D4A", borderRadius:14, padding:20 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                    <input value={m.icon} onChange={e=>updateModule(mi,"icon",e.target.value)}
                      style={{ width:44, padding:"8px", borderRadius:8, border:"1px solid #374151", background:"#111827", color:"white", fontSize:16, textAlign:"center", boxSizing:"border-box" }}/>
                    <input value={m.title} onChange={e=>updateModule(mi,"title",e.target.value)}
                      style={{ flex:1, padding:"9px 13px", borderRadius:8, border:"1px solid #374151", background:"#111827", color:"white", fontSize:13, fontWeight:600, boxSizing:"border-box" }}/>
                    <button onClick={()=>moveModule(mi,-1)} disabled={mi===0} title="Move up"
                      style={{ background:"#374151", border:"none", borderRadius:7, width:28, height:28, color:mi===0?"#4B5563":"white", cursor:mi===0?"default":"pointer", fontSize:12 }}>↑</button>
                    <button onClick={()=>moveModule(mi,1)} disabled={mi===editingCourse.modules.length-1} title="Move down"
                      style={{ background:"#374151", border:"none", borderRadius:7, width:28, height:28, color:mi===editingCourse.modules.length-1?"#4B5563":"white", cursor:mi===editingCourse.modules.length-1?"default":"pointer", fontSize:12 }}>↓</button>
                    <button onClick={()=>removeModule(mi)} title="Remove module"
                      style={{ background:"#991B1B", border:"none", borderRadius:7, padding:"7px 11px", color:"white", cursor:"pointer", fontSize:11 }}>Remove</button>
                  </div>

                  {m.slides.map((s, si) => (
                    <div key={si} style={{ background:"#111827", border:"1px solid #2D2D4A", borderRadius:10, padding:12, marginBottom:10 }}>
                      <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                        <input value={s.title} onChange={e=>updateSlide(mi,si,"title",e.target.value)} placeholder="Slide title"
                          style={{ flex:1, padding:"8px 11px", borderRadius:7, border:"1px solid #374151", background:"#0F172A", color:"white", fontSize:12, fontWeight:600, boxSizing:"border-box" }}/>
                        <button onClick={()=>removeSlide(mi,si)} title="Remove slide"
                          style={{ background:"#374151", border:"none", borderRadius:7, padding:"6px 10px", color:"#F87171", cursor:"pointer", fontSize:11, flexShrink:0 }}>✕</button>
                      </div>
                      <label style={{ fontSize:10, color:"#4B5563" }}>BULLETS (one per line)</label>
                      <textarea value={s.bullets.join("\n")} onChange={e=>updateBullets(mi,si,e.target.value)} rows={Math.max(3, s.bullets.length)}
                        style={{ width:"100%", padding:"8px 11px", borderRadius:7, border:"1px solid #374151", background:"#0F172A", color:"#D1D5DB", fontSize:11.5, boxSizing:"border-box", resize:"vertical" }}/>
                    </div>
                  ))}
                  <button onClick={()=>addSlide(mi)}
                    style={{ background:"none", border:"1px dashed #374151", borderRadius:8, padding:"8px 14px", color:"#7C3AED", cursor:"pointer", fontSize:11.5, width:"100%" }}>+ Add slide</button>

                  <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #2D2D4A" }}>
                    <label style={{ fontSize:10, color:"#4B5563" }}>PRACTICAL TYPE</label>
                    <select value={m.practicalType} onChange={e=>updateModule(mi,"practicalType",e.target.value)}
                      style={{ width:"100%", padding:"8px 11px", borderRadius:7, border:"1px solid #374151", background:"#111827", color:"white", fontSize:12, boxSizing:"border-box", marginBottom:8 }}>
                      <option value="none">None</option>
                      <option value="code">Code demo</option>
                      <option value="example">Worked example</option>
                    </select>
                    {m.practicalType === "code" && (
                      <input value={m.practicalLanguage} onChange={e=>updateModule(mi,"practicalLanguage",e.target.value)} placeholder="Language, e.g. java"
                        style={{ width:"100%", padding:"8px 11px", borderRadius:7, border:"1px solid #374151", background:"#111827", color:"white", fontSize:12, boxSizing:"border-box", marginBottom:8 }}/>
                    )}
                    {m.practicalType !== "none" && (
                      <>
                        <textarea value={m.practical} onChange={e=>updateModule(mi,"practical",e.target.value)} rows={5} placeholder="Code or worked example content"
                          style={{ width:"100%", padding:"8px 11px", borderRadius:7, border:"1px solid #374151", background:"#0A0A0A", color:"#D4D4D4", fontSize:11.5, fontFamily:"'Fira Code',monospace", boxSizing:"border-box", marginBottom:8, resize:"vertical" }}/>
                        <textarea value={m.practicalNote} onChange={e=>updateModule(mi,"practicalNote",e.target.value)} rows={2} placeholder="Short note explaining the practical"
                          style={{ width:"100%", padding:"8px 11px", borderRadius:7, border:"1px solid #374151", background:"#111827", color:"white", fontSize:12, boxSizing:"border-box" }}/>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {showAddModule ? (
                <div style={{ background:"#1A1A2E", border:"1px solid #7C3AED", borderRadius:14, padding:20 }}>
                  <h4 style={{ margin:"0 0 4px", fontSize:14, color:"#A78BFA" }}>✨ Add a new module</h4>
                  <p style={{ color:"#6B7280", fontSize:11.5, margin:"0 0 14px" }}>
                    Describe or paste what this module should cover — SEMAI designs the slides and a
                    fitting hands-on exercise, same as when you first generated the course. You can
                    still fine-tune everything by hand afterward.
                  </p>
                  <label style={{ fontSize:11, color:"#6B7280" }}>MODULE TOPIC / TITLE *</label>
                  <input value={newModForm.moduleTitle} onChange={e=>setNewModForm(f=>({...f,moduleTitle:e.target.value}))}
                    placeholder="e.g. Consumer Behaviour and Buying Decisions"
                    style={{ width:"100%", padding:"10px 13px", borderRadius:9, border:"1px solid #374151", background:"#111827", color:"white", fontSize:13, boxSizing:"border-box", marginBottom:12 }}/>
                  <label style={{ fontSize:11, color:"#6B7280" }}>DESCRIBE OR PASTE THE CONTENT *</label>
                  <textarea value={newModForm.sourceText} onChange={e=>setNewModForm(f=>({...f,sourceText:e.target.value}))}
                    rows={6} placeholder="Paste notes/an outline, or just describe the concepts this module should teach…"
                    style={{ width:"100%", padding:"10px 13px", borderRadius:9, border:"1px solid #374151", background:"#111827", color:"white", fontSize:13, boxSizing:"border-box", resize:"vertical", marginBottom:12 }}/>
                  {newModStatus && <p style={{ color:"#F87171", fontSize:12, marginBottom:10 }}>{newModStatus}</p>}
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={generateAndAddModule} disabled={newModLoading}
                      style={{ flex:1, background:newModLoading?"#374151":"linear-gradient(135deg,#7C3AED,#4F46E5)", border:"none", borderRadius:9, padding:"11px", color:"white", cursor:newModLoading?"default":"pointer", fontSize:13, fontWeight:700 }}>
                      {newModLoading ? "SEMAI is designing this module…" : "✨ Generate & Add Module"}
                    </button>
                    <button onClick={()=>{ setShowAddModule(false); setNewModStatus(""); }} disabled={newModLoading}
                      style={{ background:"#1F2937", border:"1px solid #374151", borderRadius:9, padding:"11px 18px", color:"#9CA3AF", cursor:"pointer", fontSize:13 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={()=>setShowAddModule(true)}
                  style={{ background:"none", border:"1px dashed #7C3AED", borderRadius:10, padding:"14px", color:"#A78BFA", cursor:"pointer", fontSize:13, fontWeight:600 }}>
                  + Add module
                </button>
              )}

              {editStatus && <p style={{ color: editStatus.startsWith("✅")?"#34D399":"#F87171", fontSize:12 }}>{editStatus}</p>}

              <div style={{ display:"flex", gap:10, position:"sticky", bottom:0, background:"#0F0C29", padding:"14px 0" }}>
                <button onClick={saveEdits} disabled={editLoading}
                  style={{ flex:1, background:editLoading?"#374151":"linear-gradient(135deg,#7C3AED,#4F46E5)", border:"none", borderRadius:10, padding:"13px", color:"white", cursor:editLoading?"default":"pointer", fontSize:13, fontWeight:700 }}>
                  {editLoading ? "Saving…" : "✅ Save Changes"}
                </button>
                <button onClick={()=>{ setTab("list"); setEditingCourse(null); }}
                  style={{ background:"#1F2937", border:"1px solid #374151", borderRadius:10, padding:"13px 20px", color:"#9CA3AF", cursor:"pointer", fontSize:13 }}>
                  Cancel
                </button>
              </div>
            </div>
          )
        )}

        {tab==="progress" && (
          <div>
            <label style={{ fontSize:11, color:"#6B7280" }}>COURSE</label>
            <select value={progressCourseId} onChange={e=>setProgressCourseId(e.target.value)}
              style={{ display:"block", width:"100%", maxWidth:360, padding:"9px 12px", borderRadius:8, border:"1px solid #374151", background:"#111827", color:"white", fontSize:13, marginTop:4, marginBottom:20, boxSizing:"border-box" }}>
              {courses.length ? courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>) : <option value="">No courses yet</option>}
            </select>

            {progressLoading ? (
              <p style={{ color:"#6B7280" }}>Loading…</p>
            ) : progressRows.length === 0 ? (
              <p style={{ color:"#4B5563" }}>No students have started this course yet.</p>
            ) : (
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12.5 }}>
                  <thead>
                    <tr style={{ textAlign:"left", color:"#6B7280", borderBottom:"1px solid #2D2D4A" }}>
                      <th style={{ padding:"8px 12px" }}>Student</th>
                      <th style={{ padding:"8px 12px" }}>Module</th>
                      <th style={{ padding:"8px 12px" }}>Slide reached</th>
                      <th style={{ padding:"8px 12px" }}>Status</th>
                      <th style={{ padding:"8px 12px" }}>Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...progressRows]
                      .sort((a,b) => (a.profiles?.name||"").localeCompare(b.profiles?.name||"") || (a.modules?.position??0)-(b.modules?.position??0))
                      .map((r, i) => (
                        <tr key={i} style={{ borderBottom:"1px solid #1F2937", color:"#D1D5DB" }}>
                          <td style={{ padding:"8px 12px" }}>{r.profiles?.name || "Unknown"}</td>
                          <td style={{ padding:"8px 12px" }}>{r.modules?.title || "—"}</td>
                          <td style={{ padding:"8px 12px" }}>{r.slide_index + 1}</td>
                          <td style={{ padding:"8px 12px" }}>
                            <span style={{ padding:"2px 9px", borderRadius:20, fontSize:11, background: r.completed ? "rgba(52,211,153,0.15)" : "rgba(240,180,41,0.15)", color: r.completed ? "#34D399" : "#F0B429" }}>
                              {r.completed ? "Completed" : "In progress"}
                            </span>
                          </td>
                          <td style={{ padding:"8px 12px", color:"#6B7280" }}>{new Date(r.updated_at).toLocaleString()}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab==="institution" && (
          instLoading ? <p style={{ color:"#6B7280" }}>Loading institution data…</p> : (
            <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
              {/* Stats row */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
                {[
                  ["Lecturers", instLecturers.length],
                  ["Students", instStudents.length],
                  ["Courses", courses.length],
                  ["Completions", instProgress.filter(p=>p.completed).length],
                ].map(([label,val]) => (
                  <div key={label} style={{ background:"#1A1A2E", border:"1px solid #2D2D4A", borderRadius:12, padding:"16px 18px" }}>
                    <div style={{ fontSize:24, fontWeight:800, color:"white" }}>{val}</div>
                    <div style={{ fontSize:11, color:"#6B7280", marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Lecturers */}
              <div>
                <h4 style={{ fontSize:13, color:"#A78BFA", margin:"0 0 10px" }}>Lecturers</h4>
                {instLecturers.map(l => (
                  <div key={l.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px", background:"#1A1A2E", border:"1px solid #2D2D4A", borderRadius:9, marginBottom:6 }}>
                    <span style={{ fontSize:13, color:"#E2E8F0" }}>{l.name} {l.is_admin && <span style={{ fontSize:10, color:"#F0B429", marginLeft:6 }}>ADMIN</span>}</span>
                    <button onClick={()=>toggleLecturerAdmin(l.id, l.is_admin)}
                      style={{ background:"#374151", border:"none", borderRadius:7, padding:"5px 12px", color:"white", cursor:"pointer", fontSize:11 }}>
                      {l.is_admin ? "Remove admin" : "Make admin"}
                    </button>
                  </div>
                ))}
              </div>

              {/* Students */}
              <div>
                <h4 style={{ fontSize:13, color:"#A78BFA", margin:"0 0 10px" }}>Students ({instStudents.length})</h4>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {instStudents.map(s => (
                    <span key={s.id} style={{ fontSize:12, color:"#9CA3AF", background:"#1A1A2E", border:"1px solid #2D2D4A", borderRadius:20, padding:"5px 12px" }}>{s.name}</span>
                  ))}
                  {instStudents.length === 0 && <p style={{ color:"#4B5563", fontSize:12 }}>No students yet.</p>}
                </div>
              </div>

              {/* AI usage */}
              <div>
                <h4 style={{ fontSize:13, color:"#A78BFA", margin:"0 0 10px" }}>AI usage (current 10-min window)</h4>
                {instUsage.length === 0 ? (
                  <p style={{ color:"#4B5563", fontSize:12 }}>No AI calls in the current window.</p>
                ) : (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
                    {Object.entries(instUsage.reduce((acc,r)=>{ acc[r.fn]=(acc[r.fn]||0)+r.count; return acc; }, {})).map(([fn,count]) => (
                      <div key={fn} style={{ background:"#1A1A2E", border:"1px solid #2D2D4A", borderRadius:9, padding:"8px 14px" }}>
                        <span style={{ fontSize:12, color:"#E2E8F0" }}>{fn}</span>
                        <span style={{ fontSize:12, color:"#6B7280", marginLeft:8 }}>{count} calls</span>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ color:"#4B5563", fontSize:10.5, marginTop:8 }}>Rolling 10-minute window only — for a full historical usage/cost view, this would need a proper analytics pipeline.</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
