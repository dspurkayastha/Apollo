"use client";

import { motion } from "motion/react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is Apollo?",
    answer:
      "Apollo is an AI-powered platform that helps medical postgraduates generate publication-ready theses. It provides structured workflows, university-compliant formatting, AI writing assistance, citation management, and statistical analysis tools — all in one place.",
  },
  {
    question: "Which universities are supported?",
    answer:
      "Currently WBUHS (SSKM) and SSUHS with generic template support. We are actively adding more Indian medical universities including RGUHS, MUHS, NTRUHS, KUHS, and others. If your university is not listed, the generic template provides a strong starting point.",
  },
  {
    question: "Do I need to know LaTeX?",
    answer:
      "No. Apollo handles all LaTeX formatting automatically behind the scenes. You interact with a guided workflow and the platform generates properly formatted LaTeX, compiles it, and delivers a publication-ready PDF.",
  },
  {
    question: "How does the pricing work?",
    answer:
      "Start free with a 7-day trial including a sandbox project. The Student plan is \u20B92,499/month or \u20B914,999 for 6-month access. The Professional plan is \u20B94,999/month or \u20B924,999 for lifetime access. Institutional pricing starts at \u20B91,999/student/semester.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. All data is encrypted, Row-Level Security ensures tenant isolation, and your thesis content is never shared or used for model training. Authentication is handled via Clerk with industry-standard security practices.",
  },
  {
    question: "How long does it take to complete a thesis?",
    answer:
      "Most users complete their thesis in 4\u20138 weeks using Apollo, compared to 3\u20136 months traditionally. The AI assistance and structured workflow significantly accelerate the writing process.",
  },
  {
    question: "Can my supervisor access my thesis?",
    answer:
      "Yes, with the Professional plan. Supervisors get a dedicated dashboard to review progress, provide feedback, and track milestones across all their students\u2019 theses.",
  },
  {
    question: "What happens when my subscription expires?",
    answer:
      "Your data remains safe and accessible in read-only mode. You can export your thesis as PDF at any time. To continue editing and using AI features, simply renew your subscription.",
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="container">
        <motion.div
          className="mx-auto max-w-2xl text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Have a question? Find answers to common queries below.
          </p>
        </motion.div>
        <motion.div
          className="mx-auto mt-16 max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-base">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
