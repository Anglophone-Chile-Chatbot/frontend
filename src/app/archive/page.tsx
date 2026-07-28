import type { Metadata } from "next";

import { ArchiveBrowser } from "@/components/archive/archive-browser";

export const metadata: Metadata = {
  title: "Archive — Anglophone Chile",
  description:
    "Full-text search across scanned Chilean newspapers of the 1800s, ranked by relevance.",
};

export default function ArchivePage() {
  return <ArchiveBrowser />;
}
