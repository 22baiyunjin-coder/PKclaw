import type { PersonaAvatarConfig } from "@/types/persona";

const paletteMap: Record<
  PersonaAvatarConfig["palette"],
  { bg: string; glow: string; face: string; accent: string; stroke: string }
> = {
  amber: {
    bg: "#22130a",
    glow: "#f59e0b",
    face: "#f8d8b8",
    accent: "#fbbf24",
    stroke: "#fed7aa",
  },
  emerald: {
    bg: "#081915",
    glow: "#10b981",
    face: "#d0f3e4",
    accent: "#34d399",
    stroke: "#bbf7d0",
  },
  indigo: {
    bg: "#0f1023",
    glow: "#818cf8",
    face: "#dde1ff",
    accent: "#a5b4fc",
    stroke: "#c7d2fe",
  },
  rose: {
    bg: "#220e15",
    glow: "#fb7185",
    face: "#fbd0dc",
    accent: "#fda4af",
    stroke: "#fecdd3",
  },
  ice: {
    bg: "#09131b",
    glow: "#67e8f9",
    face: "#dff7ff",
    accent: "#7dd3fc",
    stroke: "#bae6fd",
  },
};

function renderAccent(config: PersonaAvatarConfig, accentColor: string) {
  switch (config.accent) {
    case "hood":
      return (
        <path
          d="M24 78c0-18 14-34 36-34s36 16 36 34v14H24Z"
          fill={accentColor}
          opacity="0.95"
        />
      );
    case "slick":
      return (
        <path
          d="M33 44c4-15 17-24 31-24 13 0 25 7 30 20-13-6-31-8-61 4Z"
          fill={accentColor}
          opacity="0.92"
        />
      );
    case "crown":
      return (
        <path
          d="M31 33 43 18l15 11 12-12 13 16 11-7 2 18H31Z"
          fill={accentColor}
          opacity="0.95"
        />
      );
    case "bot":
      return (
        <>
          <rect x="42" y="22" width="36" height="16" rx="8" fill={accentColor} opacity="0.95" />
          <path d="M60 10v12" stroke={accentColor} strokeWidth="4" strokeLinecap="round" />
          <circle cx="60" cy="8" r="4" fill={accentColor} />
        </>
      );
    default:
      return (
        <rect
          x="32"
          y="36"
          width="56"
          height="14"
          rx="7"
          fill={accentColor}
          opacity="0.9"
        />
      );
  }
}

function renderExpression(config: PersonaAvatarConfig, stroke: string) {
  if (config.expression === "grin") {
    return (
      <>
        <path d="M48 66c4 5 20 5 24 0" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M50 56h4" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M66 56h4" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
      </>
    );
  }

  if (config.expression === "smirk") {
    return (
      <>
        <path d="M50 66c7 2 14 2 20-2" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M49 56h4" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M66 54h5" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
      </>
    );
  }

  if (config.expression === "focus") {
    return (
      <>
        <path d="M50 66h20" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
        <path d="m47 55 7-2" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
        <path d="m64 53 7 2" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
      </>
    );
  }

  return (
    <>
      <path d="M51 67c5 2 13 2 18 0" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M49 56h4" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
      <path d="M67 56h4" stroke={stroke} strokeWidth="3.5" strokeLinecap="round" />
    </>
  );
}

interface PersonaAvatarProps {
  config: PersonaAvatarConfig;
  name: string;
  size?: "sm" | "md" | "lg";
}

export function PersonaAvatar({
  config,
  name,
  size = "md",
}: PersonaAvatarProps) {
  const palette = paletteMap[config.palette];
  const gradientId = `avatar-grad-${name.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const sizeClass =
    size === "sm" ? "h-12 w-12" : size === "lg" ? "h-28 w-28" : "h-16 w-16";
  const frameClass =
    config.frame === "hex"
      ? "rounded-[1.65rem]"
      : config.frame === "shield"
        ? "rounded-[1.35rem]"
        : "rounded-full";

  return (
    <div
      className={`${sizeClass} ${frameClass} relative overflow-hidden border border-white/10 bg-slate-950/70`}
      style={{
        boxShadow: config.aura
          ? `0 0 32px -10px ${palette.glow}`
          : "0 14px 30px rgba(15, 23, 42, 0.28)",
      }}
      aria-label={`${name} avatar`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 25%, ${palette.glow}55, transparent 40%), linear-gradient(180deg, ${palette.bg}, #04070d)`,
        }}
      />
      <svg viewBox="0 0 120 120" className="relative h-full w-full">
        <defs>
          <radialGradient id={gradientId} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor={`${palette.glow}88`} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="38" r="24" fill={`url(#${gradientId})`} />
        {renderAccent(config, palette.accent)}
        <circle cx="60" cy="54" r="22" fill={palette.face} />
        <path
          d="M30 104c4-18 16-30 30-30s26 12 30 30"
          fill="none"
          stroke={palette.accent}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {renderExpression(config, palette.stroke)}
      </svg>
    </div>
  );
}
