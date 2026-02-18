import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Apollo",
  description: "Apollo privacy policy and data handling practices.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-10">
      {/* Page header */}
      <div>
        <h1 className="font-brand text-3xl font-medium tracking-tight text-[#2F2F2F]">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[#9CA3AF]">Last updated: 18 February 2026</p>
      </div>

      {/* Content card */}
      <div className="rounded-xl border border-black/[0.06] bg-white/80 p-6 shadow-[0_2px_20px_rgba(0,0,0,0.04)] md:p-8">
        <div className="space-y-8">

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">1. Data Controller</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#4A4A4A]">
              <p>
                SciScribe Solutions (OPC) Pvt Ltd (&ldquo;SciScribe&rdquo;, &ldquo;we&rdquo;,
                &ldquo;us&rdquo;) is the data controller for personal data processed through{" "}
                <span className="font-brand">Apollo</span>. We are registered in India with our
                registered office in Assam, India.
              </p>
              <p>
                Contact:{" "}
                <a href="mailto:support@sciscribesolutions.com" className="text-[#2F2F2F] underline underline-offset-2 decoration-[#9CA3AF] hover:decoration-[#2F2F2F]">
                  support@sciscribesolutions.com
                </a>
              </p>
            </div>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">2. Information We Collect</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#4A4A4A]">
              <p>We collect the following categories of information:</p>
              <ul className="ml-4 list-disc space-y-1.5 marker:text-[#9CA3AF]">
                <li>
                  <strong className="text-[#2F2F2F]">Account information</strong> &mdash; name, email
                  address, and authentication credentials (managed by our authentication provider,
                  Clerk).
                </li>
                <li>
                  <strong className="text-[#2F2F2F]">Thesis content</strong> &mdash; synopsis text,
                  chapter drafts, review of literature, and other academic content you provide or
                  generate through the platform.
                </li>
                <li>
                  <strong className="text-[#2F2F2F]">Datasets</strong> &mdash; CSV or Excel files you
                  upload for statistical analysis. These must be fully anonymised before upload.
                </li>
                <li>
                  <strong className="text-[#2F2F2F]">Usage analytics</strong> &mdash; aggregated,
                  non-identifiable usage events (project creation, phase completion, compile triggers).
                  Only collected with your explicit consent.
                </li>
              </ul>
            </div>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">3. How We Use Your Information</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#4A4A4A]">
              <p>Your information is used for:</p>
              <ul className="ml-4 list-disc space-y-1.5 marker:text-[#9CA3AF]">
                <li>Generating and refining thesis content using AI assistance</li>
                <li>Statistical analysis of uploaded datasets</li>
                <li>Compiling LaTeX documents into publication-ready PDFs</li>
                <li>Service improvement and bug diagnosis (with consent, via anonymised analytics)</li>
              </ul>
            </div>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">4. Legal Basis for Processing</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4A4A4A]">
              We process your personal data on the basis of consent, as required by the Digital Personal
              Data Protection (DPDP) Act, 2023, Section 6. You provide consent when creating your account
              and explicitly when submitting content for AI processing.
            </p>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">5. Data Residency and Cross-Border Transfers</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#4A4A4A]">
              <p>Your data is stored and processed across the following locations:</p>
              <ul className="ml-4 list-disc space-y-1.5 marker:text-[#9CA3AF]">
                <li>
                  <strong className="text-[#2F2F2F]">Database (Supabase)</strong> &mdash; hosted in
                  India (Mumbai region)
                </li>
                <li>
                  <strong className="text-[#2F2F2F]">Application server (Hetzner)</strong> &mdash;
                  hosted in Germany
                </li>
                <li>
                  <strong className="text-[#2F2F2F]">File storage (Cloudflare R2)</strong> &mdash;
                  automatic region selection by Cloudflare
                </li>
                <li>
                  <strong className="text-[#2F2F2F]">AI processing (Anthropic Claude API)</strong>{" "}
                  &mdash; processed in the United States. Thesis content is sent to Anthropic for
                  generation purposes. Anthropic does not use your data for model training.
                </li>
                <li>
                  <strong className="text-[#2F2F2F]">Analytics (PostHog)</strong> &mdash; EU endpoint
                  (eu.i.posthog.com), only active with your consent
                </li>
              </ul>
            </div>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">6. Data Retention</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4A4A4A]">
              We retain your data in accordance with our data classification schedule. Thesis content is
              retained for the duration of your account. Upon account deletion, all data is permanently
              purged after a 7-day cooling-off period.
            </p>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">7. Your Rights</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#4A4A4A]">
              <p>Under the DPDP Act, 2023, you have the right to:</p>
              <ul className="ml-4 list-disc space-y-1.5 marker:text-[#9CA3AF]">
                <li>
                  <strong className="text-[#2F2F2F]">Access</strong> &mdash; request a summary of your
                  personal data
                </li>
                <li>
                  <strong className="text-[#2F2F2F]">Correction</strong> &mdash; request correction of
                  inaccurate data
                </li>
                <li>
                  <strong className="text-[#2F2F2F]">Erasure</strong> &mdash; request deletion of your
                  account and all associated data
                </li>
                <li>
                  <strong className="text-[#2F2F2F]">Data portability</strong> &mdash; export your
                  thesis content and datasets
                </li>
              </ul>
              <p>
                To exercise these rights, contact us at{" "}
                <a href="mailto:support@sciscribesolutions.com" className="text-[#2F2F2F] underline underline-offset-2 decoration-[#9CA3AF] hover:decoration-[#2F2F2F]">
                  support@sciscribesolutions.com
                </a>.
              </p>
            </div>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">8. Cookies</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#4A4A4A]">
              <p><span className="font-brand">Apollo</span> uses the following cookies:</p>
              <ul className="ml-4 list-disc space-y-1.5 marker:text-[#9CA3AF]">
                <li>
                  <strong className="text-[#2F2F2F]">Essential cookies</strong> &mdash; authentication
                  session cookies managed by Clerk. These are required for the service to function and
                  cannot be disabled.
                </li>
                <li>
                  <strong className="text-[#2F2F2F]">Analytics cookies</strong> &mdash; PostHog
                  analytics cookies, routed through our EU endpoint. These are optional and only
                  activated with your explicit consent via the cookie banner.
                </li>
              </ul>
            </div>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">9. Children</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4A4A4A]">
              <span className="font-brand">Apollo</span> is not intended for users under the age of 18.
              We do not knowingly collect personal data from children. If you believe a child has provided
              us with personal data, please contact us immediately.
            </p>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">10. Contact</h2>
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#4A4A4A]">
              <p>
                For any privacy-related queries, contact us at:{" "}
                <a href="mailto:support@sciscribesolutions.com" className="text-[#2F2F2F] underline underline-offset-2 decoration-[#9CA3AF] hover:decoration-[#2F2F2F]">
                  support@sciscribesolutions.com
                </a>
              </p>
              <p>Registered office: Assam, India</p>
            </div>
          </section>

          <hr className="border-black/[0.06]" />

          <section>
            <h2 className="font-heading text-lg font-semibold text-[#2F2F2F]">11. Changes to This Policy</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4A4A4A]">
              We may update this Privacy Policy from time to time. We will notify you of any material
              changes by posting the updated policy on this page and updating the &ldquo;Last
              updated&rdquo; date above. Your continued use of{" "}
              <span className="font-brand">Apollo</span> after such changes constitutes acceptance of the
              updated policy.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
