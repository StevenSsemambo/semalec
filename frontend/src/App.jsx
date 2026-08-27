import { useState } from "react";
import Landing from "./pages/Landing";
import Join    from "./pages/Join";
import Lecture from "./pages/Lecture";
import Admin   from "./pages/Admin";
import { Terms, Privacy } from "./pages/Legal";

export default function App() {
  const [page,        setPage]        = useState("landing"); // landing | join | lecture | admin | terms | privacy
  const [prevPage,     setPrevPage]    = useState("landing"); // where to return to after reading a legal page
  const [studentName, setStudentName] = useState("");
  const [studentId,   setStudentId]   = useState("");
  const [courseId,    setCourseId]    = useState("");

  const join = (name, cid, sid) => {
    setStudentName(name);
    setCourseId(cid);
    setStudentId(sid);
    setPage("lecture");
  };

  const openLegal = (which, from) => { setPrevPage(from); setPage(which); };

  if (page === "landing") {
    return (
      <Landing
        onPick={(role) => setPage(role === "lecturer" ? "admin" : "join")}
        onTerms={() => openLegal("terms", "landing")}
        onPrivacy={() => openLegal("privacy", "landing")}
      />
    );
  }

  if (page === "join") {
    return <Join onJoin={join} onBack={() => setPage("landing")} onTerms={() => openLegal("terms", "join")} onPrivacy={() => openLegal("privacy", "join")} />;
  }

  if (page === "admin") {
    return <Admin onBack={() => setPage("landing")} onTerms={() => openLegal("terms", "admin")} onPrivacy={() => openLegal("privacy", "admin")} />;
  }

  if (page === "terms")   return <Terms onBack={() => setPage(prevPage)} />;
  if (page === "privacy") return <Privacy onBack={() => setPage(prevPage)} />;

  if (page === "lecture") {
    return (
      <Lecture
        studentName={studentName}
        studentId={studentId}
        courseId={courseId}
        onLeave={() => setPage("landing")}
        onAdmin={() => setPage("admin")}
      />
    );
  }
}
