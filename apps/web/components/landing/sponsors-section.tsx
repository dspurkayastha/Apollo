"use client";

import { motion } from "motion/react";

const universities = [
  { abbr: "WBUHS", state: "West Bengal", color: "from-orange-500 to-amber-500" },
  { abbr: "SSUHS", state: "Assam", color: "from-rose-500 to-orange-500" },
  { abbr: "RGUHS", state: "Karnataka", color: "from-amber-500 to-yellow-500" },
  { abbr: "MUHS", state: "Maharashtra", color: "from-orange-600 to-red-500" },
  { abbr: "NTRUHS", state: "Andhra Pradesh", color: "from-yellow-500 to-orange-500" },
  { abbr: "KUHS", state: "Kerala", color: "from-emerald-500 to-teal-500" },
  { abbr: "TNMGRMU", state: "Tamil Nadu", color: "from-red-500 to-rose-500" },
  { abbr: "BFUHS", state: "Punjab", color: "from-orange-500 to-red-500" },
  { abbr: "UHSR", state: "Haryana", color: "from-amber-600 to-orange-600" },
];

function UniversityCard({ abbr, state, color }: { abbr: string; state: string; color: string }) {
  // Get first letter for the monogram
  const initial = abbr[0];
  return (
    <div className="flex items-center gap-3 px-5 py-3 rounded-xl border bg-card/80 backdrop-blur-sm">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${color} text-white text-xs font-bold shadow-sm`}>
        {initial}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold tracking-wide">{abbr}</span>
        <span className="text-[11px] text-muted-foreground leading-tight">{state}</span>
      </div>
    </div>
  );
}

export function SponsorsSection() {
  return (
    <motion.section
      className="py-20 sm:py-28"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <p className="text-center text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Trusted by students across India&apos;s top medical universities
      </p>

      <div className="relative mt-10 overflow-hidden">
        {/* Left fade mask */}
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-background to-transparent" />
        {/* Right fade mask */}
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-background to-transparent" />

        {/*
          Seamless marquee: the array is rendered twice so the second copy
          fills the gap when the first scrolls out of view.
          The `animate-marquee` class maps to `marquee 30s linear infinite`
          defined in tailwind.config.ts.
          `motion-reduce:animate-none` respects the user's reduced-motion
          preference at the CSS level.
        */}
        <div className="flex w-max animate-marquee motion-reduce:animate-none gap-8">
          {universities.map((u) => (
            <UniversityCard key={`first-${u.abbr}`} abbr={u.abbr} state={u.state} color={u.color} />
          ))}
          {universities.map((u) => (
            <UniversityCard key={`second-${u.abbr}`} abbr={u.abbr} state={u.state} color={u.color} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
