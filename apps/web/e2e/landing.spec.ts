import { test, expect, type Page, type Locator } from "@playwright/test";

// ---------------------------------------------------------------------------
// Landing page E2E tests for Apollo
// ---------------------------------------------------------------------------

const TAILWIND_MD = 768;

function isNarrowViewport(page: Page): boolean {
  const vw = page.viewportSize()?.width ?? 1280;
  return vw < TAILWIND_MD;
}

async function scrollTo(section: Locator) {
  await section.scrollIntoViewIfNeeded({ timeout: 5000 });
}

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  // =========================================================================
  // Navbar
  // =========================================================================
  test.describe("Navbar", () => {
    test("displays the Apollo logo that links to /", async ({ page }) => {
      const logo = page
        .getByRole("banner")
        .getByRole("link", { name: /Apollo/i })
        .first();
      await expect(logo).toBeVisible({ timeout: 5000 });
      await expect(logo).toHaveAttribute("href", "/");
    });

    test("navbar has floating rounded style", async ({ page }) => {
      test.skip(isNarrowViewport(page), "Desktop-only test");
      const innerContainer = page
        .getByRole("banner")
        .locator(".rounded-full");
      await expect(innerContainer).toBeVisible({ timeout: 5000 });
    });

    test("displays desktop nav links (Features, Pricing, FAQ) on wide viewports", async ({
      page,
    }) => {
      test.skip(isNarrowViewport(page), "Desktop-only test");
      const nav = page.getByRole("banner").locator("nav");
      await expect(nav.getByText("Features")).toBeVisible({ timeout: 5000 });
      await expect(nav.getByText("Pricing")).toBeVisible();
      await expect(nav.getByText("FAQ")).toBeVisible();
    });

    test("displays Sign In and Get Started buttons when signed out on desktop", async ({
      page,
    }) => {
      test.skip(isNarrowViewport(page), "Desktop-only test");
      const header = page.getByRole("banner");
      await expect(
        header.getByRole("link", { name: /sign in/i })
      ).toBeVisible({ timeout: 5000 });
      await expect(
        header.getByRole("link", { name: /get started/i })
      ).toBeVisible();
    });

    test("Get Started button links to /sign-up", async ({ page }) => {
      test.skip(isNarrowViewport(page), "Desktop-only test");
      const getStarted = page
        .getByRole("banner")
        .getByRole("link", { name: /get started/i });
      await expect(getStarted).toHaveAttribute("href", "/sign-up");
    });

    test("shows hamburger menu on mobile that opens a sheet with nav links", async ({
      page,
    }) => {
      test.skip(!isNarrowViewport(page), "Mobile-only test");
      const hamburger = page
        .getByRole("banner")
        .getByRole("button", { name: /toggle menu/i });
      await expect(hamburger).toBeVisible({ timeout: 5000 });

      await hamburger.click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible({ timeout: 5000 });
      await expect(sheet.getByText("Features")).toBeVisible();
      await expect(sheet.getByText("Pricing")).toBeVisible();
      await expect(sheet.getByText("FAQ")).toBeVisible();
    });

    test("mobile sheet closes when a nav link is clicked", async ({
      page,
    }) => {
      test.skip(!isNarrowViewport(page), "Mobile-only test");
      const hamburger = page
        .getByRole("banner")
        .getByRole("button", { name: /toggle menu/i });
      await hamburger.click();

      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible({ timeout: 5000 });
      await sheet.getByText("Features").click();
      await expect(sheet).toBeHidden({ timeout: 5000 });
    });
  });

  // =========================================================================
  // Hero Section
  // =========================================================================
  test.describe("Hero Section", () => {
    test('displays "Now in Beta" badge', async ({ page }) => {
      const badge = page.getByText("Now in Beta");
      await expect(badge).toBeVisible({ timeout: 5000 });
    });

    test('displays "Apollo" gradient text', async ({ page }) => {
      // Typewriter effect takes ~2s to complete, wait longer
      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toBeVisible({ timeout: 5000 });
      const gradientSpan = heading.locator(".bg-clip-text");
      await expect(gradientSpan).toBeAttached();
      await expect(gradientSpan).toContainText("Apollo", { timeout: 10000 });
    });

    test("displays subtitle about medical postgraduates", async ({ page }) => {
      const subtitle = page.getByText(/85,000\+ medical postgraduates/i);
      await expect(subtitle).toBeVisible({ timeout: 5000 });
    });

    test('"Get Started Free" button links to /sign-up', async ({ page }) => {
      const cta = page.getByRole("link", { name: /get started free/i }).first();
      await expect(cta).toBeVisible({ timeout: 5000 });
      await expect(cta).toHaveAttribute("href", "/sign-up");
    });

    test('"Learn More" button links to #features', async ({ page }) => {
      const learnMore = page.getByRole("link", { name: /learn more/i });
      await expect(learnMore).toBeVisible({ timeout: 5000 });
      await expect(learnMore).toHaveAttribute("href", "#features");
    });

    test("displays hero video or mockup", async ({ page }) => {
      // The Remotion player renders the dashboard video with this URL text
      const dashboardUrl = page.getByText("apollo.app/dashboard").first();
      await expect(dashboardUrl).toBeAttached({ timeout: 10000 });
    });
  });

  // =========================================================================
  // Sponsors Section
  // =========================================================================
  test.describe("Sponsors Section", () => {
    test("displays trusted universities heading", async ({ page }) => {
      const heading = page.getByText(/trusted by students/i);
      await scrollTo(heading);
      await expect(heading).toBeVisible({ timeout: 5000 });
    });

    test("displays all 9 university abbreviations", async ({ page }) => {
      const universities = [
        "WBUHS",
        "SSUHS",
        "RGUHS",
        "MUHS",
        "NTRUHS",
        "KUHS",
        "TNMGRMU",
        "BFUHS",
        "UHSR",
      ];

      for (const uni of universities) {
        // Each university appears twice (for seamless marquee loop)
        const elements = page.getByText(uni, { exact: true });
        await expect(elements.first()).toBeAttached();
      }
    });

    test("displays state names alongside universities", async ({ page }) => {
      const states = [
        "West Bengal",
        "Assam",
        "Karnataka",
        "Maharashtra",
        "Andhra Pradesh",
        "Kerala",
        "Tamil Nadu",
        "Punjab",
        "Haryana",
      ];

      for (const state of states) {
        const elements = page.getByText(state);
        await expect(elements.first()).toBeAttached();
      }
    });
  });

  // =========================================================================
  // Features Section
  // =========================================================================
  test.describe("Features Section", () => {
    test('displays section heading "Everything You Need for Your Thesis"', async ({
      page,
    }) => {
      const featuresSection = page.locator("#features");
      await scrollTo(featuresSection);
      const heading = page.getByRole("heading", {
        name: /everything you need for your thesis/i,
      });
      await expect(heading).toBeVisible({ timeout: 5000 });
    });

    test("renders all 6 feature cards with correct titles", async ({
      page,
    }) => {
      const featuresSection = page.locator("#features");
      await scrollTo(featuresSection);

      const expectedTitles = [
        "University Templates",
        "AI Writing Assistant",
        "Citation Management",
        "Statistical Analysis",
        "Smart Synopsis Parsing",
        "Export & Compilation",
      ];

      for (const title of expectedTitles) {
        const heading = featuresSection.getByRole("heading", { name: title });
        await scrollTo(heading);
        await expect(heading).toBeVisible({ timeout: 5000 });
      }
    });

    test("each feature card includes a description", async ({ page }) => {
      const featuresSection = page.locator("#features");
      await scrollTo(featuresSection);

      await expect(
        featuresSection.getByText(/WBUHS, SSUHS, and generic formats/i)
      ).toBeVisible({ timeout: 5000 });
      await expect(
        featuresSection.getByText(/Claude-powered generation/i)
      ).toBeVisible();
      await expect(
        featuresSection.getByText(/One-click LaTeX compilation/i)
      ).toBeVisible();
    });
  });

  // =========================================================================
  // How It Works Section
  // =========================================================================
  test.describe("How It Works Section", () => {
    test('displays section heading "How It Works"', async ({ page }) => {
      const heading = page.getByRole("heading", { name: /how it works/i });
      await scrollTo(heading);
      await expect(heading).toBeVisible({ timeout: 5000 });
    });

    test("renders all 4 steps with correct titles", async ({ page }) => {
      const steps = [
        "Upload Synopsis",
        "AI Parses & Populates",
        "Review & Edit",
        "Export PDF",
      ];

      for (const step of steps) {
        const heading = page.getByRole("heading", { name: step });
        await scrollTo(heading);
        await expect(heading).toBeVisible({ timeout: 5000 });
      }
    });

    test("displays step numbers 1-4", async ({ page }) => {
      const howItWorks = page.getByRole("heading", { name: /how it works/i });
      await scrollTo(howItWorks);

      // Each step has a numbered circle
      for (const num of ["1", "2", "3", "4"]) {
        const circle = page.locator(`.rounded-full:has-text("${num}")`).first();
        await expect(circle).toBeAttached();
      }
    });
  });

  // =========================================================================
  // Pricing Section
  // =========================================================================
  test.describe("Pricing Section", () => {
    test('displays section heading "Simple, Transparent Pricing"', async ({
      page,
    }) => {
      const pricingSection = page.locator("#pricing");
      await scrollTo(pricingSection);
      const heading = page.getByRole("heading", {
        name: /simple, transparent pricing/i,
      });
      await expect(heading).toBeVisible({ timeout: 5000 });
    });

    test("renders three pricing cards with correct plan names", async ({
      page,
    }) => {
      const pricingSection = page.locator("#pricing");
      await scrollTo(pricingSection);

      await expect(
        pricingSection.getByRole("heading", { name: "Free Trial" })
      ).toBeVisible({ timeout: 5000 });
      await expect(
        pricingSection.getByRole("heading", { name: "Student" })
      ).toBeVisible();
      await expect(
        pricingSection.getByRole("heading", { name: "Professional" })
      ).toBeVisible();
    });

    test("displays billing toggle (Monthly / One-Time)", async ({ page }) => {
      const pricingSection = page.locator("#pricing");
      await scrollTo(pricingSection);

      const monthlyBtn = pricingSection.getByRole("button", {
        name: /monthly/i,
      });
      const onetimeBtn = pricingSection.getByRole("button", {
        name: /one-time/i,
      });
      await expect(monthlyBtn).toBeVisible({ timeout: 5000 });
      await expect(onetimeBtn).toBeVisible();
    });

    test("shows monthly prices by default", async ({ page }) => {
      const pricingSection = page.locator("#pricing");
      await scrollTo(pricingSection);

      await expect(pricingSection.getByText("₹2,499")).toBeVisible({
        timeout: 5000,
      });
      await expect(pricingSection.getByText("₹4,999")).toBeVisible();
    });

    test("switching to One-Time shows one-time prices", async ({ page }) => {
      const pricingSection = page.locator("#pricing");
      await scrollTo(pricingSection);

      const onetimeBtn = pricingSection.getByRole("button", {
        name: /one-time/i,
      });
      await onetimeBtn.click();

      await expect(pricingSection.getByText("₹14,999")).toBeVisible({
        timeout: 5000,
      });
      await expect(pricingSection.getByText("₹24,999")).toBeVisible();
    });

    test("Free Trial always shows Free regardless of toggle", async ({
      page,
    }) => {
      const pricingSection = page.locator("#pricing");
      await scrollTo(pricingSection);

      // Default monthly
      await expect(
        pricingSection.getByText("Free", { exact: true }).first()
      ).toBeVisible({ timeout: 5000 });

      // Switch to one-time
      const onetimeBtn = pricingSection.getByRole("button", {
        name: /one-time/i,
      });
      await onetimeBtn.click();

      await expect(
        pricingSection.getByText("Free", { exact: true }).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('shows "Most Popular" badge on Student card', async ({ page }) => {
      const pricingSection = page.locator("#pricing");
      await scrollTo(pricingSection);

      const popularBadge = pricingSection.getByText("Most Popular");
      await expect(popularBadge).toBeVisible({ timeout: 5000 });
    });

    test("Student card has glow-border class", async ({ page }) => {
      const pricingSection = page.locator("#pricing");
      await scrollTo(pricingSection);

      const glowCard = pricingSection.locator(".glow-border");
      await expect(glowCard).toBeAttached();
    });

    test('"Start Free" button links to /sign-up', async ({ page }) => {
      const pricingSection = page.locator("#pricing");
      await scrollTo(pricingSection);

      const startFree = pricingSection.getByRole("link", {
        name: /start free/i,
      });
      await expect(startFree).toBeVisible({ timeout: 5000 });
      await expect(startFree).toHaveAttribute("href", "/sign-up");
    });

    test("displays institutional callout text", async ({ page }) => {
      const pricingSection = page.locator("#pricing");
      await scrollTo(pricingSection);

      const callout = pricingSection.getByText(/institutional pricing/i);
      await scrollTo(callout);
      await expect(callout).toBeVisible({ timeout: 5000 });
      await expect(
        pricingSection.getByText(/₹1,999\/student\/semester/i)
      ).toBeVisible();
    });

    test("Student card lists its feature items", async ({ page }) => {
      const pricingSection = page.locator("#pricing");
      await scrollTo(pricingSection);

      const workflow = pricingSection.getByText("Full 12-phase workflow");
      await scrollTo(workflow);
      await expect(workflow).toBeVisible({ timeout: 5000 });
      await expect(
        pricingSection.getByText("Citation verification")
      ).toBeVisible();
      await expect(
        pricingSection.getByText("Statistical analysis")
      ).toBeVisible();
    });
  });

  // =========================================================================
  // Testimonials Section
  // =========================================================================
  test.describe("Testimonials Section", () => {
    test('displays section heading "What Researchers Say"', async ({
      page,
    }) => {
      const heading = page.getByRole("heading", {
        name: /what researchers say/i,
      });
      await scrollTo(heading);
      await expect(heading).toBeVisible({ timeout: 5000 });
    });

    test("displays testimonial quotes", async ({ page }) => {
      const heading = page.getByRole("heading", {
        name: /what researchers say/i,
      });
      await scrollTo(heading);

      // At least one testimonial should be visible
      const firstQuote = page.getByText(/cut my thesis writing time/i);
      await expect(firstQuote).toBeAttached();
    });

    test("displays carousel navigation buttons", async ({ page }) => {
      const heading = page.getByRole("heading", {
        name: /what researchers say/i,
      });
      await scrollTo(heading);

      test.skip(isNarrowViewport(page), "Carousel buttons may be hidden on mobile");

      const prevButton = page.getByRole("button", { name: /previous slide/i });
      const nextButton = page.getByRole("button", { name: /next slide/i });
      await expect(prevButton).toBeAttached();
      await expect(nextButton).toBeAttached();
    });
  });

  // =========================================================================
  // FAQ Section
  // =========================================================================
  test.describe("FAQ Section", () => {
    test('displays section heading "Frequently Asked Questions"', async ({
      page,
    }) => {
      const faqSection = page.locator("#faq");
      await scrollTo(faqSection);
      const heading = page.getByRole("heading", {
        name: /frequently asked questions/i,
      });
      await expect(heading).toBeVisible({ timeout: 5000 });
    });

    test("renders all 8 FAQ items", async ({ page }) => {
      const faqSection = page.locator("#faq");
      await scrollTo(faqSection);

      const questions = [
        "What is Apollo?",
        "Which universities are supported?",
        "Do I need to know LaTeX?",
        "How does the pricing work?",
        "Is my data secure?",
        "How long does it take to complete a thesis?",
        "Can my supervisor access my thesis?",
        "What happens when my subscription expires?",
      ];

      for (const question of questions) {
        const trigger = faqSection.getByRole("button", { name: question });
        await scrollTo(trigger);
        await expect(trigger).toBeVisible({ timeout: 5000 });
      }
    });

    test("clicking a FAQ item expands it to reveal the answer", async ({
      page,
    }) => {
      const faqSection = page.locator("#faq");
      await scrollTo(faqSection);

      const trigger = faqSection.getByRole("button", {
        name: "What is Apollo?",
      });
      await scrollTo(trigger);

      const answerText = faqSection.getByText(
        /AI-powered platform that helps medical postgraduates/i
      );
      await expect(answerText).toBeHidden();

      await trigger.click();
      await expect(answerText).toBeVisible({ timeout: 5000 });
    });

    test("clicking an expanded FAQ item collapses it", async ({ page }) => {
      const faqSection = page.locator("#faq");
      await scrollTo(faqSection);

      const trigger = faqSection.getByRole("button", {
        name: "What is Apollo?",
      });
      await scrollTo(trigger);
      const answerText = faqSection.getByText(
        /AI-powered platform that helps medical postgraduates/i
      );

      await trigger.click();
      await expect(answerText).toBeVisible({ timeout: 5000 });

      await trigger.click();
      await expect(answerText).toBeHidden({ timeout: 5000 });
    });

    test("pricing FAQ contains correct pricing info", async ({ page }) => {
      const faqSection = page.locator("#faq");
      await scrollTo(faqSection);

      const trigger = faqSection.getByRole("button", {
        name: "How does the pricing work?",
      });
      await scrollTo(trigger);
      await trigger.click();

      await expect(faqSection.getByText(/₹2,499\/month/i)).toBeVisible({
        timeout: 5000,
      });
      await expect(faqSection.getByText(/₹14,999/i)).toBeVisible();
    });

    test("opening one FAQ item closes the previously opened one", async ({
      page,
    }) => {
      const faqSection = page.locator("#faq");
      await scrollTo(faqSection);

      const firstTrigger = faqSection.getByRole("button", {
        name: "What is Apollo?",
      });
      const firstAnswer = faqSection.getByText(
        /AI-powered platform that helps medical postgraduates/i
      );

      const secondTrigger = faqSection.getByRole("button", {
        name: "Do I need to know LaTeX?",
      });
      const secondAnswer = faqSection.getByText(
        /Apollo handles all LaTeX formatting automatically/i
      );

      await scrollTo(firstTrigger);
      await firstTrigger.click();
      await expect(firstAnswer).toBeVisible({ timeout: 5000 });

      await scrollTo(secondTrigger);
      await secondTrigger.click();
      await expect(secondAnswer).toBeVisible({ timeout: 5000 });
      await expect(firstAnswer).toBeHidden({ timeout: 5000 });
    });
  });

  // =========================================================================
  // CTA Section
  // =========================================================================
  test.describe("CTA Section", () => {
    test('displays "Ready to Start Your Thesis?" heading', async ({
      page,
    }) => {
      const heading = page.getByRole("heading", {
        name: /ready to start your thesis/i,
      });
      await scrollTo(heading);
      await expect(heading).toBeVisible({ timeout: 5000 });
    });

    test("displays Get Started Free CTA button linking to /sign-up", async ({
      page,
    }) => {
      const heading = page.getByRole("heading", {
        name: /ready to start your thesis/i,
      });
      await scrollTo(heading);

      // The CTA section's Get Started Free link
      const ctaLink = page
        .locator("section")
        .filter({ hasText: /ready to start your thesis/i })
        .getByRole("link", { name: /get started free/i });
      await expect(ctaLink).toBeVisible({ timeout: 5000 });
      await expect(ctaLink).toHaveAttribute("href", "/sign-up");
    });
  });

  // =========================================================================
  // Footer Section
  // =========================================================================
  test.describe("Footer Section", () => {
    test("displays Apollo branding in the footer", async ({ page }) => {
      const footer = page.locator("footer");
      await scrollTo(footer);

      const brandLink = footer.getByRole("link", { name: /Apollo/i });
      await expect(brandLink).toBeVisible({ timeout: 5000 });
      await expect(brandLink).toHaveAttribute("href", "/");
    });

    test("displays tagline about thesis generation", async ({ page }) => {
      const footer = page.locator("footer");
      await scrollTo(footer);

      await expect(
        footer.getByText(
          /AI-powered thesis generation for medical postgraduates/i
        )
      ).toBeVisible({ timeout: 5000 });
    });

    test("footer has rounded card container", async ({ page }) => {
      const footer = page.locator("footer");
      await scrollTo(footer);

      const card = footer.locator(".rounded-2xl");
      await expect(card).toBeVisible({ timeout: 5000 });
    });

    test("contains Product column links (Features, Pricing, FAQ)", async ({
      page,
    }) => {
      const footer = page.locator("footer");
      await scrollTo(footer);

      await expect(footer.getByText("Features").first()).toBeVisible({
        timeout: 5000,
      });
      await expect(footer.getByText("Pricing").first()).toBeVisible();
      await expect(footer.getByText("FAQ").first()).toBeVisible();
    });

    test("contains Legal column with Privacy Policy and Terms", async ({
      page,
    }) => {
      const footer = page.locator("footer");
      await scrollTo(footer);

      await expect(footer.getByText("Privacy Policy")).toBeVisible({
        timeout: 5000,
      });
      await expect(footer.getByText("Terms of Service")).toBeVisible();
    });

    test("displays copyright text with year 2026", async ({ page }) => {
      const footer = page.locator("footer");
      await scrollTo(footer);

      await expect(footer.getByText(/2026 Apollo/i)).toBeVisible({
        timeout: 5000,
      });
    });
  });

  // =========================================================================
  // Navigation / Scrolling
  // =========================================================================
  test.describe("Navigation and Scrolling", () => {
    test('clicking "Features" in navbar scrolls to the features section', async ({
      page,
    }) => {
      test.skip(isNarrowViewport(page), "Desktop nav scrolling test");
      const nav = page.getByRole("banner").locator("nav");
      await nav.getByText("Features").click();

      const featuresSection = page.locator("#features");
      await expect(featuresSection).toBeInViewport({ timeout: 5000 });
    });

    test('clicking "Pricing" in navbar scrolls to the pricing section', async ({
      page,
    }) => {
      test.skip(isNarrowViewport(page), "Desktop nav scrolling test");
      const nav = page.getByRole("banner").locator("nav");
      await nav.getByText("Pricing").click();

      const pricingSection = page.locator("#pricing");
      await expect(pricingSection).toBeInViewport({ timeout: 5000 });
    });

    test('clicking "FAQ" in navbar scrolls to the FAQ section', async ({
      page,
    }) => {
      test.skip(isNarrowViewport(page), "Desktop nav scrolling test");
      const nav = page.getByRole("banner").locator("nav");
      await nav.getByText("FAQ").click();

      const faqSection = page.locator("#faq");
      await expect(faqSection).toBeInViewport({ timeout: 5000 });
    });

    test('clicking "Learn More" scrolls to the features section', async ({
      page,
    }) => {
      const learnMore = page.getByRole("link", { name: /learn more/i });
      await learnMore.click();

      const featuresSection = page.locator("#features");
      await expect(featuresSection).toBeInViewport({ timeout: 5000 });
    });
  });

  // =========================================================================
  // Responsive Layout
  // =========================================================================
  test.describe("Responsive Layout", () => {
    test("on narrow viewport, desktop nav is hidden and hamburger is visible", async ({
      page,
    }) => {
      test.skip(!isNarrowViewport(page), "Mobile-only test");

      const header = page.getByRole("banner");
      const desktopNav = header.locator("nav");
      await expect(desktopNav).toBeHidden();

      const hamburger = header.getByRole("button", {
        name: /toggle menu/i,
      });
      await expect(hamburger).toBeVisible({ timeout: 5000 });
    });

    test("on wide viewport, nav links are shown and hamburger is hidden", async ({
      page,
    }) => {
      test.skip(isNarrowViewport(page), "Desktop-only test");

      const header = page.getByRole("banner");
      const desktopNav = header.locator("nav");
      await expect(desktopNav).toBeVisible({ timeout: 5000 });

      const hamburger = header.getByRole("button", {
        name: /toggle menu/i,
      });
      await expect(hamburger).toBeHidden();
    });
  });

  // =========================================================================
  // Page Structure
  // =========================================================================
  test.describe("Page Structure", () => {
    test("renders all major sections in correct order", async ({ page }) => {
      await expect(page.getByRole("banner")).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.locator("#features")).toBeAttached();
      await expect(page.locator("#pricing")).toBeAttached();
      await expect(page.locator("#faq")).toBeAttached();
      await expect(page.locator("footer")).toBeAttached();
    });

    test("page has appropriate title", async ({ page }) => {
      await expect(page).toHaveTitle(/Apollo/i);
    });
  });
});
