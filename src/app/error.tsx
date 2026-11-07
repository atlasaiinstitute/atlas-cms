"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="foundation-shell"><section className="foundation-card"><div className="eyebrow">ATLAS CMS</div><h1>Something went wrong.</h1><p className="lead">The application could not complete this request.</p><button className="retry-button" onClick={() => reset()}>Try again</button></section></main>;
}
