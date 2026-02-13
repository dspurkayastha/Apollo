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
    <section className="py-20 sm:py-28">
      <div className="container">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            What Researchers Say
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Trusted by medical postgraduates across India to deliver
            publication-ready theses.
          </p>
        </motion.div>

        <motion.div
          className="mx-auto mt-16 max-w-4xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Carousel opts={{ align: "start", loop: true }}>
            <CarouselContent className="-ml-4">
              {testimonials.map((testimonial, index) => (
                <CarouselItem key={index} className="pl-4 md:basis-1/2">
                  <div className="rounded-xl border bg-card p-6 h-full">
                    <p className="text-sm text-muted-foreground italic">
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
                        {getInitials(testimonial.name)}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {testimonial.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
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
