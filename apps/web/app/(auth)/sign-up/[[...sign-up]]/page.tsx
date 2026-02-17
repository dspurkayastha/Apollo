"use client";

import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

const clerkAppearance = {
  variables: {
    colorPrimary: "#5A7A50",
    colorText: "#2F2F2F",
    colorTextSecondary: "#6B6B6B",
    colorBackground: "transparent",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#2F2F2F",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full max-w-[520px]",
    cardBox: "shadow-none bg-transparent overflow-visible",
    card: "shadow-none border-none bg-transparent p-0 overflow-visible",
    headerTitle: "font-brand text-2xl font-bold text-[#2F2F2F]",
    headerSubtitle: "text-[#6B6B6B] text-sm",
    formButtonPrimary:
      "bg-[#5A7A50] hover:bg-[#4A6A40] rounded-lg text-sm font-medium h-11 shadow-none",
    formFieldInput:
      "rounded-lg border-black/[0.08] focus:border-[#8B9D77] focus:ring-[#8B9D77]/20 h-11",
    formFieldLabel: "text-sm font-medium text-[#2F2F2F]",
    socialButtonsBlockButton:
      "rounded-lg border-black/[0.08] hover:bg-black/[0.02] h-11 overflow-visible",
    dividerLine: "bg-black/[0.06]",
    dividerText: "text-[#6B6B6B] text-xs",
    footerActionLink: "text-[#8B9D77] hover:text-[#6B7D57]",
    footer: "hidden",
  },
} as const;

function SignUpForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");

  const redirectUrl = plan
    ? `/checkout?plan=${encodeURIComponent(plan)}`
    : "/dashboard";

  return (
    <SignUp
      forceRedirectUrl={redirectUrl}
      appearance={clerkAppearance}
    />
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-[400px] animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-black/[0.04]" />
          <div className="h-11 rounded-lg bg-black/[0.04]" />
          <div className="h-11 rounded-lg bg-black/[0.04]" />
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
