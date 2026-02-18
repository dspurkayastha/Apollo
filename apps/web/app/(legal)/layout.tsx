import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-dot-grid min-h-screen">
      {/* Header — frosted glass strip matching dashboard-header pattern */}
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/80 backdrop-blur-[20px]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-[#9CA3AF] transition-colors hover:text-[#2F2F2F]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
          <Link
            href="/"
            className="font-brand text-xl font-medium text-[#2F2F2F]"
          >
            Apollo
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-12 pb-20">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-black/[0.06] py-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4">
          <p className="text-xs text-[#9CA3AF]">
            &copy; {new Date().getFullYear()} SciScribe Solutions (OPC) Pvt Ltd
          </p>
          <div className="flex gap-4">
            <Link href="/privacy" className="text-xs text-[#9CA3AF] transition-colors hover:text-[#2F2F2F]">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-[#9CA3AF] transition-colors hover:text-[#2F2F2F]">
              Terms
            </Link>
            <Link href="/refund" className="text-xs text-[#9CA3AF] transition-colors hover:text-[#2F2F2F]">
              Refund
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
