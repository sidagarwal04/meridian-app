"use client";

import { useState } from "react";
import { PageShell } from "@/components/PageShell";

export default function Page() {
  const [sent, setSent] = useState(false);
  return (
    <PageShell>
      <div className="page">
        <h1>Contacts</h1>
        <p className="lead">Questions about a route. This note stays on your device.</p>
        {sent ? (
          <p className="notice">Saved on this device. Nothing was emailed.</p>
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
              Name
              <input name="name" required />
            </label>
            <label className="field">
              Email
              <input name="email" type="email" required />
            </label>
            <label className="field">
              Message
              <textarea name="message" rows={5} required />
            </label>
            <button className="btn primary" type="submit">
              Save note
            </button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
