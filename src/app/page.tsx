import { Suspense } from "react";
import { ChatView } from "@/components/archive/chat-view";

export default function HomePage() {
  return (
    <Suspense>
      <ChatView />
    </Suspense>
  );
}

