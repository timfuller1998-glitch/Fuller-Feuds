import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

/** /u/@handle (or /u/handle) -> /profile/:userId */
export default function HandleRedirect() {
  const { handle } = useParams<{ handle: string }>();
  const [, navigate] = useLocation();
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const h = decodeURIComponent(handle || "").replace(/^@+/, "");
    fetch(`/api/handles/${encodeURIComponent(h)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => navigate(`/profile/${j.id}`, { replace: true }))
      .catch(() => setMissing(true));
  }, [handle, navigate]);
  return (
    <div className="container mx-auto py-16 text-center text-muted-foreground" data-testid="handle-redirect">
      {missing ? `No one has the handle @${(handle || "").replace(/^@+/, "")}.` : "Loading profile…"}
    </div>
  );
}
