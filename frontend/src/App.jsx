import { useState } from "react";
import Join    from "./pages/Join";
import Lecture from "./pages/Lecture";
import Admin   from "./pages/Admin";

export default function App() {
  const [page,        setPage]        = useState("join");  // join | lecture | admin
  const [studentName, setStudentName] = useState("");
  const [courseId,    setCourseId]    = useState("tdit214");

  const join = (name, cid) => {
    setStudentName(name);
    setCourseId(cid);
    setPage("lecture");
  };

  if (page === "join")    return <Join    onJoin={join}/>;
  if (page === "admin")   return <Admin   onBack={()=>setPage("lecture")}/>;
  if (page === "lecture") return (
    <Lecture
      studentName={studentName}
      courseId={courseId}
      onLeave={()=>setPage("join")}
      onAdmin={()=>setPage("admin")}
    />
  );
}
