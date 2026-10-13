import { useEffect, useState } from "react";
import { staffMe, type StaffPublic } from "@/lib/staff-accounts";

export function useStaffSession() {
  const [session, setSession] = useState<StaffPublic | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    staffMe()
      .then((user) => {
        if (live) setSession(user);
      })
      .catch(() => {
        if (live) setSession(null);
      })
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return { session, ready };
}
