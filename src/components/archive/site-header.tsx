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
          // A real 44px row rather than a 15px line of type: the wordmark is
          // the way home and gets tapped like any other control.
          className={cn(
            "flex min-h-[44px] min-w-0 shrink items-center rounded-md",
            "font-heading text-[0.9375rem] leading-none tracking-tight text-foreground",
          )}
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
                  // 44px, not 40: CLAUDE.md's tap-target floor. Fits the
                  // h-14 (56px) header row with room to spare, so this is a
                  // real height rather than a pseudo-element hit area.
                  // `min-w-[44px]` as well as the height: "Ask" is a short
                  // enough word that px-2.5 left it 43px wide — one pixel under
                  // the floor, which is still under it.
                  "relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-2.5",
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
