import { useState, useCallback } from "react";

const KEY = "myra:sidebar-collapsed";

export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem(KEY) === "true",
  );

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(KEY, String(next));
      return next;
    });
  }, []);

  return [collapsed, toggle];
}
