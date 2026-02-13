import { GraduationCap } from "lucide-react";
import { InteractiveGridPattern } from "@/components/auth/interactive-grid";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — hidden on mobile, visible on lg+ */}
      <div className="relative hidden w-1/2 overflow-hidden bg-zinc-950 lg:flex lg:flex-col lg:justify-between">
        {/* Interactive grid background */}
        <div className="absolute inset-0 z-0">
          <InteractiveGridPattern />
        </div>

        {/* Top branding */}
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-2 text-white">
            <GraduationCap className="h-7 w-7 text-orange-500" />
            <span className="text-xl font-bold">Apollo</span>
          </div>
        </div>

        {/* Bottom testimonial */}
        <div className="relative z-10 p-10">
          <blockquote className="space-y-2">
            <p className="text-lg text-zinc-200">
              &ldquo;Apollo transformed how I approach my thesis. The AI
              assistance and structured workflow saved me months of
              work.&rdquo;
            </p>
            <footer className="text-sm text-zinc-300">
              Dr. Priya Sharma — MD Pathology, WBUHS
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right panel — Clerk form */}
      <div className="flex flex-1 items-center justify-center bg-background p-8">
        {children}
      </div>
    </div>
  );
}
