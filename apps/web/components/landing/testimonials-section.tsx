"use client";

import { motion } from "motion/react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const testimonials = [
  {
    name: "Dr. Priya Sharma",
    role: "MD Pathology, WBUHS",
    quote:
      "Apollo cut my thesis writing time in half. The AI assistance for literature review was exceptional.",
  },
  {
    name: "Dr. Rahul Verma",
    role: "MS Orthopaedics, SSUHS",
    quote:
      "The LaTeX compilation just works. No more fighting with formatting — I could focus on my research.",
  },
  {
    name: "Dr. Ananya Das",
    role: "MD Pharmacology, RGUHS",
    quote:
      "Citation verification saved me from embarrassing errors. Every reference was cross-checked automatically.",
  },
  {
    name: "Dr. Vikram Patel",
    role: "MD Community Medicine, MUHS",
    quote:
      "The statistical analysis tools were a game-changer. Built-in R analysis meant I didn't need a separate statistician.",
  },
  {
    name: "Dr. Sneha Reddy",
    role: "MS Ophthalmology, NTRUHS",
    quote:
      "From synopsis upload to final PDF in weeks, not months. Apollo is the future of medical thesis writing.",
  },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .filter((part) => !part.endsWith("."))
    .map((part) => part[0])
    .join("");
}

export function TestimonialsSection() {
  return (
    <section className="py-14 md:py-[102px]">
      <div className="container">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="font-serif text-3xl tracking-tight text-[#2F2F2F] sm:text-4xl">
            What Researchers Say
          </h2>
          <p className="mt-3 text-lg text-[#6B6B6B]">
            Trusted by medical postgraduates across India to deliver
            publication-ready theses.
          </p>
        </motion.div>

        <motion.div
          className="mx-auto mt-12 max-w-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Carousel opts={{ align: "start", loop: true }}>
            <CarouselContent className="-ml-4">
              {testimonials.map((testimonial, index) => (
                <CarouselItem key={index} className="pl-4 md:basis-1/2">
                  <div
                    className="group relative h-full overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-6 landing-card hover:border-[#AF6FAB]/30"
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = ((e.clientX - rect.left) / rect.width) * 100;
                      const y = ((e.clientY - rect.top) / rect.height) * 100;
                      e.currentTarget.style.setProperty("--mouse-x", `${x}%`);
                      e.currentTarget.style.setProperty("--mouse-y", `${y}%`);
                    }}
                  >
                    {/* Cursor-tracking lilac glow on hover */}
                    <div
                      className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      style={{
                        background:
                          "radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(175,111,171,0.15) 0%, rgba(175,111,171,0.12) 20%, rgba(175,111,171,0.06) 40%, transparent 80%)",
                      }}
                    />
                    <p className="relative font-serif text-sm italic leading-relaxed text-[#2F2F2F]">
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                    <div className="relative mt-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B9D77]/20 font-semibold text-[#8B9D77] text-sm">
                        {getInitials(testimonial.name)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#2F2F2F]">
                          {testimonial.name}
                        </p>
                        <p className="text-xs text-[#6B6B6B]">
                          {testimonial.role}
                        </p>
                      </div>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </motion.div>
      </div>
    </section>
  );
}
