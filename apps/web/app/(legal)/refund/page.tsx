import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — Apollo",
  description: "Apollo refund and cancellation policy.",
};

export default function RefundPolicyPage() {
  return (
    <div className="space-y-10">
      {/* Page header */}
      <div>
        <h1 className="font-brand text-3xl font-medium tracking-tight text-[#2F2F2F]">
          Refund Policy
        </h1>
        <p className="mt-2 text-sm text-[#9CA3AF]">Last updated: 18 February 2026</p>
      </div>

      {/* Content card */}
      <div className="rounded-xl border border-black/[0.06] bg-white/80 p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] md:p-8">
        <div className="space-y-8">

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">1. Non-Refundable</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4A4A4A]">
              Thesis licences are non-refundable digital goods. Once a licence is purchased and
              activated, it cannot be refunded. This policy applies to all licence types, including
              one-time and monthly plans.
            </p>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">2. Account Deletion</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4A4A4A]">
              If you choose to delete your account, a 7-day cooling-off period applies. During this
              period, you may cancel the deletion request by contacting us. After 7 days, all your
              data &mdash; including projects, thesis content, datasets, and files &mdash; will be
              permanently purged. Account deletion does not trigger a refund.
            </p>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">3. Exceptions</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4A4A4A]">
              In extraordinary circumstances (e.g., duplicate charges, technical issues preventing
              service access), please contact us at{" "}
              <a href="mailto:support@sciscribesolutions.com" className="text-[#2F2F2F] underline underline-offset-2 decoration-[#9CA3AF] hover:decoration-[#2F2F2F]">
                support@sciscribesolutions.com
              </a>. We will review requests on a case-by-case basis at our discretion.
            </p>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">4. Contact</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#4A4A4A]">
              <p>
                For refund-related queries, contact:{" "}
                <a href="mailto:support@sciscribesolutions.com" className="text-[#2F2F2F] underline underline-offset-2 decoration-[#9CA3AF] hover:decoration-[#2F2F2F]">
                  support@sciscribesolutions.com
                </a>
              </p>
              <p>SciScribe Solutions (OPC) Pvt Ltd, Assam, India</p>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
