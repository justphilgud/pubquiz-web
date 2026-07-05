"use client";

import { ReactNode, useState } from "react";

type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export function Tabs({ items, defaultId }: { items: TabItem[]; defaultId?: string }) {
  const [activeId, setActiveId] = useState(defaultId ?? items[0]?.id);
  const active = items.find((item) => item.id === activeId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveId(item.id)}
            className={[
              "border-b-2 px-3 py-2 text-sm font-medium transition",
              activeId === item.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-900",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div>{active?.content}</div>
    </div>
  );
}
