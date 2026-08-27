// Shared reading-view chrome for Terms of Service and Privacy Policy — kept as plain,
// clearly-labeled legal text rather than styled marketing copy, consistent with how these
// documents are meant to be read.

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ color: "#A78BFA", fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>{title}</h3>
      <div style={{ color: "#C4BEE3", fontSize: 13, lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

function Shell({ title, updated, onBack, children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0B0820", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px 80px" }}>
        {onBack && (
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#4B5563", fontSize: 12, cursor: "pointer", marginBottom: 20, padding: 0 }}>
            ← Back
          </button>
        )}
        <h1 style={{ color: "white", fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>{title}</h1>
        <p style={{ color: "#4B5563", fontSize: 11, margin: "0 0 28px" }}>Last updated: {updated} · SEMAI, a SayMyTech Developers product</p>
        {children}
      </div>
    </div>
  );
}

const LAST_UPDATED = "27 August 2026";

export function Terms({ onBack }) {
  return (
    <Shell title="Terms of Service" updated={LAST_UPDATED} onBack={onBack}>
      <Section title="1. What SEMAI is">
        SEMAI is an AI-powered lecture platform. Lecturers create or generate course content; SEMAI
        (an AI system, not a human) delivers it to students through narrated slides, live walkthroughs
        of code or worked examples, and a conversational Q&A assistant. SEMAI is built and operated by
        SayMyTech Developers.
      </Section>
      <Section title="2. Accounts">
        Both lecturers and students need an account to use SEMAI. You're responsible for the accuracy
        of the information you provide and for keeping your password secure. An institution's account
        (courses, students, lecturers) is scoped to that institution and is not visible to other
        institutions using SEMAI.
      </Section>
      <Section title="3. Institutions are responsible for enrollment consent">
        If your institution is a school (including secondary/high school) enrolling students who are
        minors, the institution — not SayMyTech — is responsible for obtaining any parental or guardian
        consent required by applicable law before creating accounts for those students, the same way it
        would for any other classroom software. SEMAI is provided to institutions as a tool for use
        within their own consented enrollment process, not as a direct-to-minor consumer product.
      </Section>
      <Section title="4. AI-generated content">
        Course material, explanations, and generated modules are produced by an AI model (currently
        Google's Gemini) and may contain errors, omissions, or inaccuracies. Lecturers are responsible
        for reviewing AI-generated course content before it's taught to students. SEMAI is a teaching
        aid, not a substitute for a lecturer's own academic judgment.
      </Section>
      <Section title="5. Acceptable use">
        Don't attempt to circumvent rate limits or abuse the AI-generation features, don't use SEMAI to
        generate or distribute unlawful, harassing, or academically dishonest content, and don't attempt
        to access another institution's or another user's data.
      </Section>
      <Section title="6. Content ownership">
        Course content a lecturer creates or generates belongs to that lecturer and their institution.
        SayMyTech retains ownership of the SEMAI platform, software, and underlying technology.
      </Section>
      <Section title="7. Availability and changes">
        SEMAI is under active development. Features, the underlying AI model, and these terms may
        change. We'll make reasonable efforts to keep the service running but don't guarantee
        uninterrupted availability.
      </Section>
      <Section title="8. Limitation of liability">
        SEMAI is provided "as is." To the maximum extent permitted by law, SayMyTech Developers is not
        liable for indirect, incidental, or consequential damages arising from use of the service,
        including reliance on AI-generated content.
      </Section>
      <Section title="9. Contact">
        Questions about these terms: reach out to SayMyTech Developers through the contact details on
        your institution's SEMAI account, or via the developer, Steven Ssemambo.
      </Section>
      <p style={{ color: "#4B5563", fontSize: 11, marginTop: 30, fontStyle: "italic" }}>
        This document is a starting-point draft and has not been reviewed by a lawyer. Before onboarding
        real students — particularly minors — SayMyTech should have it reviewed for the jurisdictions
        SEMAI actually operates in.
      </p>
    </Shell>
  );
}

export function Privacy({ onBack }) {
  return (
    <Shell title="Privacy Policy" updated={LAST_UPDATED} onBack={onBack}>
      <Section title="1. What we collect">
        Account information (name, email, institution, role); course content lecturers create;
        messages you send to SEMAI's chat and voice features; and progress data (which modules and
        slides a student has reached or completed).
      </Section>
      <Section title="2. How it's used">
        To run the lecture experience itself (generating and narrating course content, answering
        questions), to show a lecturer their own courses and students' progress, and to let an
        institution admin see aggregate usage and progress across their institution.
      </Section>
      <Section title="3. Who else sees it">
        <b>Google (Gemini API)</b> processes chat messages, lecture content, and course-generation
        requests to produce SEMAI's responses — this is how the AI teaching happens. <b>Supabase</b>{" "}
        hosts our database and authentication. <b>Netlify</b> hosts the web app. We do not sell data
        and do not use advertising networks. Data is isolated per institution — one school cannot see
        another school's courses, students, or usage.
      </Section>
      <Section title="4. Children's privacy">
        SEMAI is designed to be used through an educational institution's own enrollment process
        (see Terms of Service §3), not signed up for directly by a minor without their school's
        involvement. Institutions enrolling students under applicable age-of-consent thresholds are
        responsible for any required parental/guardian notice or consent.
      </Section>
      <Section title="5. Data retention and deletion">
        We retain account and course data for as long as the account is active. You can request
        deletion of your account and associated data by contacting your institution's SEMAI
        administrator or SayMyTech Developers directly.
      </Section>
      <Section title="6. Security">
        Data is protected with encrypted connections, per-institution row-level database security
        (one institution's data is not readable by another, enforced at the database level), and rate
        limiting on AI features to prevent abuse.
      </Section>
      <Section title="7. Changes to this policy">
        If this policy changes materially, we'll update the date at the top of this page.
      </Section>
      <Section title="8. Contact">
        Questions about this policy or your data: reach out through your institution's SEMAI account,
        or via the developer, Steven Ssemambo (SayMyTech Developers).
      </Section>
      <p style={{ color: "#4B5563", fontSize: 11, marginTop: 30, fontStyle: "italic" }}>
        This document is a starting-point draft and has not been reviewed by a lawyer. Before onboarding
        real students — particularly minors — SayMyTech should have it reviewed for the jurisdictions
        SEMAI actually operates in (e.g. Uganda's Data Protection and Privacy Act, and any applicable
        rules where students are located).
      </p>
    </Shell>
  );
}
