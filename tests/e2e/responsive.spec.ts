import { test, expect } from "@playwright/test";
import { ensureE2ETestUsers, loginAs, TEST_CREDENTIALS } from "./fixtures";

const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/placements",
  "/internships",
  "/for-recruiters",
  "/contact",
  "/login",
  "/signup",
  "/students",
  "/alumni",
];

const STUDENT_ROUTES = [
  "/student/dashboard",
  "/student/profile",
  "/student/skills",
  "/student/applications",
  "/student/drives",
  "/student/announcements",
];

const STAFF_ROUTES = [
  "/staff/dashboard",
  "/staff/students",
  "/staff/drives",
  "/staff/companies",
  "/staff/recruiters",
  "/staff/announcements",
  "/staff/exports",
  "/staff/statistics",
];

const ADMIN_ROUTES = ["/admin/roles", "/admin/recovery", "/admin/audit"];

const RECRUITER_ROUTES = [
  "/recruiter/dashboard",
  "/recruiter/drives",
  "/recruiter/announcements",
];

test.use({
  viewport: { width: 375, height: 812 },
});

test.describe("responsive: public routes at 375px", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`responsive public: ${route} has no document-level horizontal overflow at 375px`, async ({
      page,
    }) => {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");

      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(dimensions.scrollWidth).toBeLessThanOrEqual(
        dimensions.clientWidth
      );
    });
  }

  test("responsive: mobile navigation opens and closes with accessible state at 375px", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const toggleButton = page.locator(
      'button[aria-controls="mobile-navigation-menu"]'
    );
    await expect(toggleButton).toBeVisible();
    await expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    await expect(toggleButton).toHaveAttribute(
      "aria-label",
      "Open navigation menu"
    );

    // Open menu
    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    await expect(toggleButton).toHaveAttribute(
      "aria-label",
      "Close navigation menu"
    );

    const mobileNav = page.locator("#mobile-navigation-menu");
    await expect(mobileNav).toBeVisible();

    // Verify essential links exist and are accessible
    const homeLink = mobileNav.getByRole("link", { name: "Home" });
    await expect(homeLink).toBeVisible();

    const signInLink = mobileNav.getByRole("link", { name: "Sign In" });
    await expect(signInLink).toBeVisible();

    // Close menu
    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    await expect(toggleButton).toHaveAttribute(
      "aria-label",
      "Open navigation menu"
    );
    await expect(mobileNav).not.toBeVisible();
  });
});

test.describe("responsive: authenticated routes at 375px", () => {
  test.beforeAll(async () => {
    await ensureE2ETestUsers();
  });

  test.describe("student surfaces", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(
        page,
        TEST_CREDENTIALS.student.email,
        TEST_CREDENTIALS.student.password,
        TEST_CREDENTIALS.student.expectedDashboard
      );
    });

    for (const route of STUDENT_ROUTES) {
      test(`responsive student: ${route} renders and has no horizontal overflow at 375px`, async ({
        page,
      }) => {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");

        // Verify page rendered content without redirection
        expect(page.url()).not.toContain("/login");
        expect(page.url()).not.toContain("/unauthorized");
        expect(page.url()).toContain(route);

        await expect(
          page.locator("h1, h2, main, form, [role='main']").first()
        ).toBeVisible();

        const dimensions = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        expect(dimensions.scrollWidth).toBeLessThanOrEqual(
          dimensions.clientWidth
        );
      });
    }
  });

  test.describe("staff surfaces", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(
        page,
        TEST_CREDENTIALS.staff.email,
        TEST_CREDENTIALS.staff.password,
        TEST_CREDENTIALS.staff.expectedDashboard
      );
    });

    for (const route of STAFF_ROUTES) {
      test(`responsive staff: ${route} renders and has no horizontal overflow at 375px`, async ({
        page,
      }) => {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");

        expect(page.url()).not.toContain("/login");
        expect(page.url()).not.toContain("/unauthorized");
        expect(page.url()).toContain(route);

        await expect(
          page.locator("h1, h2, main, form, table, [role='main']").first()
        ).toBeVisible();

        const dimensions = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        expect(dimensions.scrollWidth).toBeLessThanOrEqual(
          dimensions.clientWidth
        );
      });
    }
  });

  test.describe("super admin surfaces", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(
        page,
        TEST_CREDENTIALS.admin.email,
        TEST_CREDENTIALS.admin.password,
        TEST_CREDENTIALS.admin.expectedDashboard
      );
    });

    for (const route of ADMIN_ROUTES) {
      test(`responsive admin: ${route} renders and has no horizontal overflow at 375px`, async ({
        page,
      }) => {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");

        expect(page.url()).not.toContain("/login");
        expect(page.url()).not.toContain("/unauthorized");
        expect(page.url()).toContain(route);

        await expect(
          page.locator("h1, h2, main, form, table, [role='main']").first()
        ).toBeVisible();

        const dimensions = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        expect(dimensions.scrollWidth).toBeLessThanOrEqual(
          dimensions.clientWidth
        );
      });
    }
  });

  test.describe("recruiter surfaces", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(
        page,
        TEST_CREDENTIALS.recruiter.email,
        TEST_CREDENTIALS.recruiter.password,
        TEST_CREDENTIALS.recruiter.expectedDashboard
      );
    });

    for (const route of RECRUITER_ROUTES) {
      test(`responsive recruiter: ${route} renders and has no horizontal overflow at 375px`, async ({
        page,
      }) => {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");

        expect(page.url()).not.toContain("/login");
        expect(page.url()).not.toContain("/unauthorized");
        expect(page.url()).toContain(route);

        await expect(
          page.locator("h1, h2, main, form, [role='main']").first()
        ).toBeVisible();

        const dimensions = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        expect(dimensions.scrollWidth).toBeLessThanOrEqual(
          dimensions.clientWidth
        );
      });
    }
  });
});
