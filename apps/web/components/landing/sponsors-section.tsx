"use client";

import { motion } from "motion/react";

const universities = [
  { abbr: "WBUHS", state: "West Bengal" },
  { abbr: "SSUHS", state: "Assam" },
  { abbr: "RGUHS", state: "Karnataka" },
  { abbr: "MUHS", state: "Maharashtra" },
  { abbr: "NTRUHS", state: "Andhra Pradesh" },
  { abbr: "KUHS", state: "Kerala" },
  { abbr: "TNMGRMU", state: "Tamil Nadu" },
  { abbr: "BFUHS", state: "Punjab" },
  { abbr: "UHSR", state: "Haryana" },
];

function UniversityCard({ abbr, state }: { abbr: string; state: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-5 py-3 opacity-40 transition-opacity hover:opacity-80">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2F2F2F] text-xs font-bold text-white">
        {abbr[0]}
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold tracking-wide text-[#2F2F2F]">{abbr}</span>
        <span className="text-[11px] leading-tight text-[#6B6B6B]">{state}</span>
      </div>
    </div>
  );
}

export function SponsorsSection() {
  return (
    <motion.section
      className="relative z-20 pt-5 pb-14 md:pt-8 md:pb-[102px]"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <p className="text-center text-sm font-medium uppercase tracking-wider text-[#6B6B6B]">
        Trusted by students across India&apos;s top medical universities
      </p>

      <div className="relative mt-8 overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-[#F3F1ED] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-[#F3F1ED] to-transparent" />

        <div className="flex w-max animate-marquee gap-8 motion-reduce:animate-none">
          {universities.map((u) => (
            <UniversityCard key={`first-${u.abbr}`} abbr={u.abbr} state={u.state} />
          ))}
          {universities.map((u) => (
            <UniversityCard key={`second-${u.abbr}`} abbr={u.abbr} state={u.state} />
          ))}
        </div>
      </div>
    </motion.section>
  );
}
