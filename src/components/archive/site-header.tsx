"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * The site header.
 *
 * Two destinations only — the assistant and the archive browser — so the nav
 * is inline at every width rather than collapsing into a hamburger. A menu
 * button for two links is friction, not structure.
 *
 * **"Archive" became "Browse" in CHUNK 3.** The old pair read as two search
 * boxes, which is exactly what the two pages had become: "Ask" and "Archive"
 * name the *content* of both, so neither label told a reader what the page
 * would do for them. "Ask" and "Browse" name the two verbs instead — put a
 * question to the corpus, or go and look at it — which is the actual
 * distinction, and the one an academic historian arriving without a search
 * term needs to see. The route stays `/archive`: renaming a label is free,
 * renaming a URL breaks every link already shared.
 */

const NAV = [
  { href: "/", label: "Ask" },
  { href: "/archive", label: "Browse" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="rule-b pt-safe sticky top-0 z-40 bg-background/90 supports-[backdrop-filter]:backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="min-w-0 shrink font-heading text-[0.9375rem] leading-none tracking-tight text-foreground"
        >
          <span className="block truncate">Anglophone Chile</span>
        </Link>

        <nav className="flex shrink-0 items-center gap-0.5">
          {NAV.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[40px] items-center rounded-md px-2.5",
                  "text-[0.8125rem] transition-colors duration-[120ms]",
                  "ease-[var(--ease-crisp)]",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2.5 -bottom-px h-[2px] bg-[var(--accent)]"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
