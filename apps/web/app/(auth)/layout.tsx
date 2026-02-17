import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Breathing animation keyframe */}
      <style>{`
        @keyframes authBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.025); }
        }
      `}</style>

      {/* Left panel — scene image with dot grid behind, hidden on mobile */}
      <div className="relative hidden w-[60%] overflow-hidden bg-[#E8E3DB] lg:block">
        {/* Dot grid — base layer, visible at image edges where mask fades */}
        <div
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(47,47,47,0.13) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Scene image — fills pane, breathing zoom animation */}
        <div
          className="absolute inset-0 top-[5rem] z-10"
          style={{ animation: "authBreathe 20s ease-in-out infinite" }}
        >
          <Image
            src="/images/auth-scene.png"
            alt="DNA helix and research paper scene"
            fill
            className="object-cover"
            style={{
              maskImage:
                "radial-gradient(ellipse 88% 92% at 48% 50%, black 55%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 88% 92% at 48% 50%, black 55%, transparent 100%)",
            }}
            priority
          />
        </div>

        {/* Apollo logo — large brand font */}
        <div className="absolute left-8 top-8 z-20 flex items-center gap-2">
          <span className="font-brand text-[7rem] font-semibold leading-none tracking-tight text-[#2F2F2F]">
            Apollo
          </span>
        </div>
      </div>

      {/* Right panel — Clerk form with dot grid on lighter warm background */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden p-8"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(47,47,47,0.13) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          backgroundColor: "#F5F3F0",
        }}
      >
        <div className="overflow-visible rounded-3xl border border-white/40 bg-white/50 px-10 py-10 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
