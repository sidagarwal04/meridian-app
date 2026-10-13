"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell } from "@/components/PageShell";

export default function Page() {
  const [sent, setSent] = useState(false);
  return (
    <PageShell>
      <div className="page">
        <div className="page-hero-head">
          <span className="hero-badge">
            <span className="badge-dot" /> Get in Touch
          </span>
          <h1>Contacts</h1>
          <p className="lead">Questions, route feedback, or feature ideas. Notes are saved locally on your device.</p>
        </div>

        {sent ? (
          <div className="contact-card" style={{ textAlign: "center", padding: "36px 28px" }}>
            <span className="feature-icon" style={{ margin: "0 auto" }}>✓</span>
            <h2>Note saved on this device</h2>
            <p style={{ color: "var(--muted)" }}>Your feedback has been recorded in local storage.</p>
            <div className="hero-actions" style={{ justifyContent: "center" }}>
              <button className="btn ghost" type="button" onClick={() => setSent(false)}>
                Write another note
              </button>
              <Link className="btn primary" href="/videos">
                Back to Studio
              </Link>
            </div>
          </div>
        ) : (
          <form
            className="contact-card"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const notes = JSON.parse(localStorage.getItem("meridian-notes") || "[]");
              notes.push({ name: data.get("name"), email: data.get("email"), message: data.get("message"), at: Date.now() });
              localStorage.setItem("meridian-notes", JSON.stringify(notes));
              setSent(true);
            }}
          >
            <label className="field">
              <span className="field-label">Your Name</span>
              <input name="name" placeholder="Alex Rivera" required />
            </label>
            <label className="field">
              <span className="field-label">Email Address</span>
              <input name="email" type="email" placeholder="alex@example.com" required />
            </label>
            <label className="field">
              <span className="field-label">Message</span>
              <textarea name="message" rows={5} placeholder="Tell us about your trip or feature request…" required />
            </label>
            <button className="btn primary lg wide" type="submit">
              Save Note →
            </button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
