'use client';

import { useEffect } from 'react';

export default function DraftCompanionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Draft Companion route error', error);
  }, [error]);

  return (
    <main className="shell">
      <section className="panel">
        <span className="eyebrow">RosterPilot recovery</span>
        <h1>Draft Companion hit an error</h1>
        <p className="muted">
          Your most recent valid draft state should still be in browser storage. Retry the page first; if needed, restore a downloaded JSON backup.
        </p>
        <button className="primaryButton" onClick={reset}>Retry Draft Companion</button>
      </section>
    </main>
  );
}
