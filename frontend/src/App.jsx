import { useState } from "react";
import Landing from "./pages/Landing";
import Join    from "./pages/Join";
import Lecture from "./pages/Lecture";
import Admin   from "./pages/Admin";

export default function App() {
  const [page,        setPage]        = useState("landing"); // landing | join | lecture | admin
  const [studentName, setStudentName] = useState("");
  const [studentId,   setStudentId]   = useState("");
  const [courseId,    setCourseId]    = useState("");

  const join = (name, cid, sid) => {
    setStudentName(name);
    setCourseId(cid);
    setStudentId(sid);
    setPage("lecture");
  };

  if (page === "landing") {
    return (
      <Landing
        onPick={(role) => setPage(role === "lecturer" ? "admin" : "join")}
      />
    );
  }

  if (page === "join") {
    return <Join onJoin={join} onBack={() => setPage("landing")} />;
  }

  if (page === "admin") {
    return <Admin onBack={() => setPage("landing")} />;
  }

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
