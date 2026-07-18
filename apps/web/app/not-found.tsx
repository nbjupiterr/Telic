import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-main not-found" id="main-content">
      <div className="shell narrow-shell">
        <p className="eyebrow">404 · Unresolved reference</p>
        <h1>This page is not in the ledger.</h1>
        <p>The route may have moved, or the reference may be incomplete.</p>
        <Link className="button button-primary" href="/">
          Return home
        </Link>
      </div>
    </main>
  );
}
