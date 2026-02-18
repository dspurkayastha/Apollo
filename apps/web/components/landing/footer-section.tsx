"use client";

import Link from "next/link";

const productLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

const companyLinks = [
  { label: "About", href: "#" },
  { label: "Contact", href: "mailto:support@sciscribesolutions.com" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Refund Policy", href: "/refund" },
];

function FooterLinkGroup({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[#2F2F2F]">
        {title}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-sm text-[#9CA3AF] transition-colors hover:text-[#2F2F2F]"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FooterSection() {
  return (
    <footer className="border-t border-black/[0.06] pt-12 pb-8">
      <div className="container">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          {/* Brand column */}
          <div className="max-w-xs">
            <Link
              href="/"
              className="font-brand text-2xl font-medium text-[#2F2F2F]"
            >
              Apollo
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-[#9CA3AF]">
              AI-powered thesis generation for Indian medical postgraduates.
              From synopsis to submission.
            </p>
          </div>

          {/* Link columns */}
          <div className="flex gap-16">
            <FooterLinkGroup title="Product" links={productLinks} />
            <FooterLinkGroup title="Company" links={companyLinks} />
            <FooterLinkGroup title="Legal" links={legalLinks} />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-black/[0.04] pt-6 md:flex-row">
          <p className="text-xs text-[#9CA3AF]">
            &copy; {new Date().getFullYear()} Apollo. All rights reserved.
          </p>
          <p className="text-xs text-[#9CA3AF]">
            Made for medical postgraduates across India
          </p>
        </div>
      </div>
    </footer>
  );
}
