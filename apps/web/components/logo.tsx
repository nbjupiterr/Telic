import Link from "next/link";

export function TelicMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 36 36"
      fill="none"
    >
      <path
        d="M6 8.25h24M18 8.25v19.5M9.75 27.75h16.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="18" cy="8.25" r="3.25" fill="currentColor" />
      <circle cx="9.75" cy="27.75" r="2.25" fill="currentColor" />
      <circle cx="26.25" cy="27.75" r="2.25" fill="currentColor" />
    </svg>
  );
}

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="Telic home">
      <span className="brand-mark">
        <TelicMark />
      </span>
      <span>Telic</span>
    </Link>
  );
}
