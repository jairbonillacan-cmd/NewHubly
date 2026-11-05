"use client";

export interface NavLink {
  href: string;
  label: string;
  current?: boolean;
}

export function MobileNav({ links }: { links: readonly NavLink[] }) {
  return (
    <details className="group lg:hidden" onKeyDown={(event) => {
      if (event.key === "Escape" && event.currentTarget.open) {
        event.currentTarget.open = false;
        event.currentTarget.querySelector("summary")?.focus();
      }
    }}>
      <summary aria-label="Menú" className="grid size-11 cursor-pointer list-none place-items-center rounded-full border border-(--border-control) [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </summary>
      <ul className="absolute top-full right-0 mt-2 w-52 list-none rounded-2xl border border-(--border-default) bg-(--landing-card) p-2 shadow-(--landing-shadow)">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              aria-current={link.current ? "page" : undefined}
              className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold hover:bg-(--landing-ice)"
              onClick={(event) => event.currentTarget.closest("details")?.removeAttribute("open")}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
