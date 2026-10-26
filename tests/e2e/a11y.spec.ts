import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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

for (const route of PUBLIC_ROUTES) {
  test(`a11y: ${route} has zero WCAG A/AA axe violations (all impacts: minor/moderate/serious/critical)`, async ({
    page,
  }) => {
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");

    type AxePage = NonNullable<
      ConstructorParameters<typeof AxeBuilder>[0]
    >["page"];
    const accessibilityScanResults = await new AxeBuilder({
      page: page as unknown as AxePage,
    })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    if (accessibilityScanResults.violations.length > 0) {
      console.error(
        `Axe violations on ${route} (${accessibilityScanResults.violations.length} total):`,
        JSON.stringify(
          accessibilityScanResults.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            help: v.help,
            nodes: v.nodes.map((n) => n.html),
          })),
          null,
          2
        )
      );
    }

    expect(accessibilityScanResults.violations).toHaveLength(0);
    expect(accessibilityScanResults.violations).toEqual([]);
  });
}
