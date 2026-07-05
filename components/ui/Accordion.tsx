"use client";

import { ReactNode, useState } from "react";

type AccordionItem = {
  id: string;
  title: string;
  content: ReactNode;
};

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="divide-y rounded-xl border bg-white">
      {items.map((item) => {
        const open = item.id === openId;

        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : item.id)}
              className="flex w-full items-center justify-between p-4 text-left font-medium text-gray-900"
            >
              {item.title}
              <span className="text-gray-400">{open ? "−" : "+"}</span>
            </button>
            {open && <div className="px-4 pb-4 text-sm text-gray-600">{item.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
