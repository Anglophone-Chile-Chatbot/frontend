import type { Metadata } from "next";

import { ArchiveBrowser } from "@/components/archive/archive-browser";

export const metadata: Metadata = {
  title: "Browse the archive — Anglophone Chile",
  description:
    "Every scanned issue of the nineteenth-century Chilean English-language press, browsable by publication and date, with full-text search across the pages.",
};

export default function ArchivePage() {
  return <ArchiveBrowser />;
}
