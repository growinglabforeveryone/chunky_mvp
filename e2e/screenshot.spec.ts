/**
 * Playwright 스크린샷 테스트
 * QA 스킬에서 호출하여 주요 페이지 스크린샷을 촬영합니다.
 *
 * 사용법: npx playwright test e2e/screenshot.ts
 * 결과: e2e/screenshots/ 폴더에 저장
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.QA_BASE_URL || "http://localhost:3000";

const PAGES = [
  { name: "dashboard", path: "/", title: "대시보드" },
  { name: "extract", path: "/extract", title: "표현 추출" },
  { name: "library", path: "/library", title: "라이브러리" },
  { name: "review", path: "/review", title: "복습" },
];

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 },
];

test.describe("페이지 스크린샷", () => {
  for (const page of PAGES) {
    for (const viewport of VIEWPORTS) {
      test(`${page.title} — ${viewport.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const tab = await context.newPage();

        const response = await tab.goto(`${BASE_URL}${page.path}`, {
          waitUntil: "networkidle",
          timeout: 15000,
        });

        // 페이지 로드 확인
        expect(response?.status()).toBeLessThan(400);

        // 렌더링 대기
        await tab.waitForTimeout(1000);

        // 스크린샷 저장
        await tab.screenshot({
          path: `e2e/screenshots/${page.name}-${viewport.name}.png`,
          fullPage: true,
        });

        await context.close();
      });
    }
  }
});

test.describe("핵심 요소 체크", () => {
  test("앱 로드 — 로그인 또는 대시보드 표시", async ({ page }) => {
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle", timeout: 15000 });

    // 로그인 안 된 상태면 로그인 페이지, 된 상태면 대시보드
    const loginBtn = page.getByText("Google");
    const dashboard = page.locator('a[href="/extract"]');

    const isLogin = await loginBtn.isVisible().catch(() => false);
    const isDashboard = await dashboard.first().isVisible().catch(() => false);

    expect(isLogin || isDashboard).toBeTruthy();
  });

  test("페이지 라우팅 — 각 경로 200 응답", async ({ page }) => {
    for (const path of ["/", "/extract", "/library", "/review"]) {
      const response = await page.goto(`${BASE_URL}${path}`, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      expect(response?.status()).toBeLessThan(400);
    }
  });
});
