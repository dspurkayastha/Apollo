"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { motion } from "motion/react";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.header
        className="fixed top-8 left-1/2 z-50 w-full max-w-[1200px] -translate-x-1/2 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <nav
          className={`flex items-center justify-between rounded-3xl border border-white/30 px-6 py-3 transition-all duration-300 ${
            scrolled ? "glass-nav-scrolled" : "glass-nav"
          }`}
        >
          {/* Logo */}
          <Link href="/" className="font-brand text-[24px] font-medium bg-gradient-to-r from-[#2F2F2F] to-[#6B6B6B] bg-clip-text text-transparent">
            Apollo
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[14px] font-medium text-[#6B6B6B] transition-colors hover:text-[#2F2F2F]"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden items-center gap-3 md:flex">
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-[14px] font-medium text-[#6B6B6B] transition-colors hover:text-[#2F2F2F]"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="rounded-[20px] bg-[#2F2F2F] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#2F2F2F]/90"
              >
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="text-[14px] font-medium text-[#6B6B6B] transition-colors hover:text-[#2F2F2F]"
              >
                Dashboard
              </Link>
              <UserButton />
            </SignedIn>
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-3 md:hidden">
            <SignedIn>
              <UserButton />
            </SignedIn>
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#2F2F2F]"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </motion.header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-white/90 backdrop-blur-[20px] p-8">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="font-brand text-[24px] font-medium text-[#2F2F2F]"
              onClick={() => setMobileOpen(false)}
            >
              Apollo
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[#2F2F2F]"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="mt-12 flex flex-col gap-6">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[20px] font-medium text-[#2F2F2F]"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <SignedOut>
              <Link
                href="/sign-in"
                className="text-[20px] font-medium text-[#6B6B6B]"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="mt-4 inline-block rounded-[20px] bg-[#2F2F2F] px-6 py-3 text-center text-[16px] font-medium text-white"
                onClick={() => setMobileOpen(false)}
              >
                Get Started
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="text-[20px] font-medium text-[#2F2F2F]"
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </Link>
            </SignedIn>
          </nav>
        </div>
      )}
    </>
  );
}
