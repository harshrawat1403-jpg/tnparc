import { test, expect } from "@playwright/test";

test("keyboard: skip-to-content link receives focus on first Tab and navigates to main-content", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  // Press Tab from initial page load
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: /skip to main content/i });
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  // Press Enter on skip link
  await page.keyboard.press("Enter");

  // Verify URL or target has focus
  const mainContent = page.locator("#main-content");
  await expect(mainContent).toBeFocused();
});

test("keyboard: mobile menu closes on Escape and restores focus to toggle button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");

  const menuButton = page.locator(
    'button[aria-controls="mobile-navigation-menu"]'
  );
  await menuButton.click();

  const mobileNav = page.locator("#mobile-navigation-menu");
  await expect(mobileNav).toBeVisible();

  // Press Escape
  await page.keyboard.press("Escape");

  await expect(mobileNav).not.toBeVisible();
  await expect(menuButton).toBeFocused();
});

test("keyboard: login form elements follow logical visual focus order", async ({
  page,
}) => {
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  // Tab past skip link and nav to form
  const emailInput = page.locator("#email");
  await emailInput.focus();
  await expect(emailInput).toBeFocused();

  // Tab to password
  await page.keyboard.press("Tab");
  const passwordInput = page.locator("#password");
  await expect(passwordInput).toBeFocused();

  // Tab to forgot password link
  await page.keyboard.press("Tab");
  const forgotLink = page.getByRole("link", { name: /forgot password/i });
  await expect(forgotLink).toBeFocused();

  // Tab to Sign In submit button
  await page.keyboard.press("Tab");
  const submitButton = page.getByRole("button", { name: "Sign In" });
  await expect(submitButton).toBeFocused();
});
