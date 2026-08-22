import { useState, useCallback } from "react";
import { sendChat, explainSlide } from "../api";

export function useSEMAI({ courseId, studentName, speak }) {
  const [messages, setMessages] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [preparing, setPreparing] = useState(false); // true while SEMAI composes a full slide explanation

  // Full lecturer-style explanation of a slide — teaches every bullet, not just reads it.
  const teachSlide = useCallback(async ({ courseTitle, moduleTitle, slideTitle, bullets }, onDone) => {
    setPreparing(true);
    try {
      const data = await explainSlide({ courseTitle, moduleTitle, studentName, slideTitle, bullets });
      speak(data.explanation, onDone);
    } catch {
      speak(`Let's look at ${slideTitle}. ${bullets.join(". ")}.`, onDone); // graceful fallback
    } finally {
      setPreparing(false);
    }
  }, [studentName, speak]);

  const ask = useCallback(async (userText, context = "", onReply) => {
    if (!userText.trim() || loading) return;

    const userMsg = { role: "user", content: userText };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const data = await sendChat({
        messages:    [...messages, userMsg],
        courseId:    courseId || "tdit214",
        studentName: studentName || "Student",
        context,
      });

      const reply = data.reply || "Sorry, I had a connection issue. Please try again!";
      const aiMsg = { role: "assistant", content: reply };
      setMessages(prev => [...prev, aiMsg]);
      speak(reply, onReply);
      return reply;
    } catch (err) {
      const errMsg = "Sorry class, connection issue — please try again!";
      setMessages(prev => [...prev, { role: "assistant", content: errMsg }]);
      speak(errMsg);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, courseId, studentName, speak]);

  const clearMessages = () => setMessages([]);

  return { ask, messages, loading, clearMessages, teachSlide, preparing };
}
