import { useState, useEffect } from "react";
import { listBackends } from "../ipc/backend";
import type { BackendInfo } from "../../shared/types";

export function useBackends(refreshTrigger = 0) {
  const [backends, setBackends] = useState<BackendInfo[]>([]);

  useEffect(() => {
    listBackends().then(setBackends);
  }, [refreshTrigger]);

  return { backends };
}
