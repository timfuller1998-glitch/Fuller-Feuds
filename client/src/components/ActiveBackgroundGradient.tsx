import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { COMPASS_QUADRANTS } from "@shared/politicalCompass";

interface PoliticalDistribution {
  authoritarianCapitalist: number;
  authoritarianSocialist: number;
  libertarianCapitalist: number;
  libertarianSocialist: number;
}

/**
 * Generate a subtle background gradient with texture overlay
 * based on active user political distribution
 */
function getActiveBackgroundGradient(distribution: PoliticalDistribution): React.CSSProperties {
  // Convert percentages (0-100) to subtle opacity for background (max 0.20 for visibility)
  const toOpacity = (percent: number) => ((percent / 100) * 0.20).toFixed(3);

  const tl = COMPASS_QUADRANTS.authoritarianLiberal.rgb;
  const tr = COMPASS_QUADRANTS.authoritarianConservative.rgb;
  const bl = COMPASS_QUADRANTS.libertarianLiberal.rgb;
  const br = COMPASS_QUADRANTS.libertarianConservative.rgb;
  const topLeft = `rgba(${tl[0]}, ${tl[1]}, ${tl[2]}, ${toOpacity(distribution.authoritarianSocialist)})`;
  const topRight = `rgba(${tr[0]}, ${tr[1]}, ${tr[2]}, ${toOpacity(distribution.authoritarianCapitalist)})`;
  const bottomLeft = `rgba(${bl[0]}, ${bl[1]}, ${bl[2]}, ${toOpacity(distribution.libertarianSocialist)})`;
  const bottomRight = `rgba(${br[0]}, ${br[1]}, ${br[2]}, ${toOpacity(distribution.libertarianCapitalist)})`;

  // Create a radial gradient for each corner with larger spread (95% instead of 85%)
  return {
    background: `
      radial-gradient(circle at 0% 0%, ${topLeft} 0%, transparent 95%),
      radial-gradient(circle at 100% 0%, ${topRight} 0%, transparent 95%),
      radial-gradient(circle at 0% 100%, ${bottomLeft} 0%, transparent 95%),
      radial-gradient(circle at 100% 100%, ${bottomRight} 0%, transparent 95%),
      hsl(var(--background))
    `,
  };
}

/**
 * Component that applies a dynamic background gradient based on active users' political distribution
 * Updates every 5 minutes to reflect current platform activity
 */
export function ActiveBackgroundGradient({ children }: { children: React.ReactNode }) {
  const [gradientStyle, setGradientStyle] = useState<React.CSSProperties>({
    background: 'hsl(var(--background))'
  });

  // Fetch active user political distribution with 5-minute cache
  const { data: distribution } = useQuery<PoliticalDistribution>({
    queryKey: ['/api/users/active-distribution'],
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
  });

  // Update gradient when distribution data changes
  useEffect(() => {
    if (distribution) {
      const newStyle = getActiveBackgroundGradient(distribution);
      setGradientStyle(newStyle);
    }
  }, [distribution]);

  return (
    <div 
      className="min-h-screen transition-all duration-1000 ease-in-out relative"
      style={gradientStyle}
      data-testid="background-gradient"
    >
      {/* Subtle noise texture overlay for clean UI */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
