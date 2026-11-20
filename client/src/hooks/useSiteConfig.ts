import { useQuery } from "@tanstack/react-query";

export type SiteConfig = { foundingMode: boolean; publicLaunch: boolean };

/** Site switches from GET /api/site-config (invite-only sign-up, public launch). Defaults to invite-only. */
export function useSiteConfig(): SiteConfig {
  const { data } = useQuery<SiteConfig>({
    queryKey: ["/api/site-config"],
    queryFn: async () => {
      const res = await fetch("/api/site-config", { credentials: "include" });
      if (!res.ok) throw new Error("site-config");
      return res.json();
    },
    staleTime: 60_000,
  });
  return data ?? { foundingMode: true, publicLaunch: false };
}
