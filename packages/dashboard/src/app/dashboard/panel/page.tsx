"use client";

import { DeskInboxPanel } from "@/components/inbox-panel";

export default function PanelPage() {
  return (
    <main className="mx-auto flex w-full max-w-[96rem] flex-col px-4 py-6 sm:px-6 lg:min-h-[calc(100vh-3.5rem)]">
      <h1 className="text-xl font-semibold">Bandeja</h1>
      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <DeskInboxPanel />
      </div>
    </main>
  );
}
