interface PoliticalCompassChartProps {
  economicScore?: number | null;
  authoritarianScore?: number | null;
  size?: "sm" | "md" | "lg";
}

export function PoliticalCompassChart({
  economicScore = 0,
  authoritarianScore = 0,
  size = "md"
}: PoliticalCompassChartProps) {
  const sizeMap = {
    sm: { width: 200, height: 200, fontSize: "text-xs" },
    md: { width: 280, height: 280, fontSize: "text-sm" },
    lg: { width: 360, height: 360, fontSize: "text-base" }
  };

  const { width, height, fontSize } = sizeMap[size];
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Normalize scores from -100 to 100 range to chart coordinates
  const normalizeX = (score: number) => {
    return padding + ((score + 100) / 200) * chartWidth;
  };

  const normalizeY = (score: number) => {
    // Inverted because SVG Y axis goes down
    return padding + ((100 - score) / 200) * chartHeight;
  };

  const userX = normalizeX(economicScore || 0);
  const userY = normalizeY(authoritarianScore || 0);

  // Dynamic color calculation matching avatar ring system
  const getQuadrantColor = (economicPos: number, authoritarianPos: number) => {
    const x = economicPos / 100;  // -1 (capitalist) to +1 (socialist)
    const y = authoritarianPos / 100;  // -1 (libertarian) to +1 (authoritarian)
    
    const distanceFromCenter = Math.sqrt(x * x + y * y);
    const intensity = Math.min(distanceFromCenter, 1);
    
    let hue: number;
    let saturation: number;
    let lightness: number;
    
    // Determine quadrant and base color
    if (x < 0 && y >= 0) {
      hue = 0; // Red - Authoritarian Capitalist
      saturation = 70 + (intensity * 25);
      lightness = 55;
    } else if (x >= 0 && y >= 0) {
      hue = 220; // Blue - Authoritarian Socialist
      saturation = 70 + (intensity * 25);
      lightness = 55;
    } else if (x < 0 && y < 0) {
      hue = 140; // Green - Libertarian Capitalist
      saturation = 65 + (intensity * 30);
      lightness = 50;
    } else {
      hue = 50; // Yellow - Libertarian Socialist
      saturation = 70 + (intensity * 25);
      lightness = 55;
    }
    
    // Minimal white in center
    if (distanceFromCenter < 0.15) {
      saturation = saturation * 0.6;
      lightness = 65;
    } else if (distanceFromCenter < 0.3) {
      saturation = saturation * 0.8;
      lightness = 60;
    } else {
      lightness = 55 - (intensity * 10);
    }
    
    // Fade to black at extremes (±85)
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    if (absX >= 0.85 || absY >= 0.85) {
      const maxAbsolute = Math.max(absX, absY);
      const extremeFactor = (maxAbsolute - 0.85) / 0.15;
      lightness = lightness * (1 - extremeFactor * 0.7);
      saturation = saturation * (1 - extremeFactor * 0.3);
    }
    
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
  };

  // Calculate corner colors for gradients using moderate values (±60)
  // This prevents fade-to-black from activating on the gradient backgrounds
  const quadrantColors = {
    topLeft: getQuadrantColor(-60, 60),        // Red - Authoritarian Capitalist
    topRight: getQuadrantColor(60, 60),        // Blue - Authoritarian Socialist
    bottomLeft: getQuadrantColor(-60, -60),    // Green - Libertarian Capitalist
    bottomRight: getQuadrantColor(60, -60)     // Yellow - Libertarian Socialist
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={width} height={height} className="border border-border rounded-md bg-card">
        {/* Gradient backgrounds for quadrants */}
        <defs>
          <radialGradient id="tl-gradient" cx="0%" cy="0%">
            <stop offset="0%" stopColor={quadrantColors.topLeft} stopOpacity="0.5" />
            <stop offset="50%" stopColor={quadrantColors.topLeft} stopOpacity="0.2" />
            <stop offset="100%" stopColor={quadrantColors.topLeft} stopOpacity="0.05" />
          </radialGradient>
          <radialGradient id="tr-gradient" cx="100%" cy="0%">
            <stop offset="0%" stopColor={quadrantColors.topRight} stopOpacity="0.5" />
            <stop offset="50%" stopColor={quadrantColors.topRight} stopOpacity="0.2" />
            <stop offset="100%" stopColor={quadrantColors.topRight} stopOpacity="0.05" />
          </radialGradient>
          <radialGradient id="bl-gradient" cx="0%" cy="100%">
            <stop offset="0%" stopColor={quadrantColors.bottomLeft} stopOpacity="0.5" />
            <stop offset="50%" stopColor={quadrantColors.bottomLeft} stopOpacity="0.2" />
            <stop offset="100%" stopColor={quadrantColors.bottomLeft} stopOpacity="0.05" />
          </radialGradient>
          <radialGradient id="br-gradient" cx="100%" cy="100%">
            <stop offset="0%" stopColor={quadrantColors.bottomRight} stopOpacity="0.5" />
            <stop offset="50%" stopColor={quadrantColors.bottomRight} stopOpacity="0.2" />
            <stop offset="100%" stopColor={quadrantColors.bottomRight} stopOpacity="0.05" />
          </radialGradient>
        </defs>

        {/* Background quadrants */}
        <rect x={padding} y={padding} width={chartWidth / 2} height={chartHeight / 2} fill="url(#tl-gradient)" />
        <rect x={padding + chartWidth / 2} y={padding} width={chartWidth / 2} height={chartHeight / 2} fill="url(#tr-gradient)" />
        <rect x={padding} y={padding + chartHeight / 2} width={chartWidth / 2} height={chartHeight / 2} fill="url(#bl-gradient)" />
        <rect x={padding + chartWidth / 2} y={padding + chartHeight / 2} width={chartWidth / 2} height={chartHeight / 2} fill="url(#br-gradient)" />

        {/* Grid lines */}
        <line x1={padding} y1={padding + chartHeight / 2} x2={padding + chartWidth} y2={padding + chartHeight / 2} stroke="currentColor" strokeWidth="2" opacity="0.3" />
        <line x1={padding + chartWidth / 2} y1={padding} x2={padding + chartWidth / 2} y2={padding + chartHeight} stroke="currentColor" strokeWidth="2" opacity="0.3" />

        {/* Lighter grid lines for quarters */}
        <line x1={padding} y1={padding + chartHeight / 4} x2={padding + chartWidth} y2={padding + chartHeight / 4} stroke="currentColor" strokeWidth="1" opacity="0.15" strokeDasharray="4,4" />
        <line x1={padding} y1={padding + (chartHeight * 3) / 4} x2={padding + chartWidth} y2={padding + (chartHeight * 3) / 4} stroke="currentColor" strokeWidth="1" opacity="0.15" strokeDasharray="4,4" />
        <line x1={padding + chartWidth / 4} y1={padding} x2={padding + chartWidth / 4} y2={padding + chartHeight} stroke="currentColor" strokeWidth="1" opacity="0.15" strokeDasharray="4,4" />
        <line x1={padding + (chartWidth * 3) / 4} y1={padding} x2={padding + (chartWidth * 3) / 4} y2={padding + chartHeight} stroke="currentColor" strokeWidth="1" opacity="0.15" strokeDasharray="4,4" />

        {/* User position dot with glow effect */}
        <circle cx={userX} cy={userY} r="6" fill="white" stroke="hsl(var(--primary))" strokeWidth="3" opacity="0.9" />
        <circle cx={userX} cy={userY} r="10" fill="hsl(var(--primary))" opacity="0.2" />

        {/* Axis labels */}
        <text x={padding} y={padding - 10} className={`fill-muted-foreground ${fontSize}`} textAnchor="start">Authoritarian</text>
        <text x={padding} y={height - padding + 20} className={`fill-muted-foreground ${fontSize}`} textAnchor="start">Libertarian</text>
        <text x={padding - 10} y={padding + chartHeight / 2} className={`fill-muted-foreground ${fontSize}`} textAnchor="end">Capitalist</text>
        <text x={padding + chartWidth + 10} y={padding + chartHeight / 2} className={`fill-muted-foreground ${fontSize}`} textAnchor="start">Socialist</text>
      </svg>

      {/* Score display */}
      <div className={`text-center ${fontSize} text-muted-foreground`}>
        <div>Economic: {economicScore !== null && economicScore !== undefined ? economicScore : 0}</div>
        <div>Authoritarian: {authoritarianScore !== null && authoritarianScore !== undefined ? authoritarianScore : 0}</div>
      </div>
    </div>
  );
}
