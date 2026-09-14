import { expect, test } from '@playwright/test';

test('原有各页面可访问，移动端不产生横向溢出', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const [route, content] of [
    ['/', 'AI 测试资讯 000'],
    ['/news', 'AI 资讯流'],
    ['/papers', '论文追踪'],
    ['/models', '大模型追踪'],
    ['/products', 'AI 产品库'],
  ]) {
    await page.goto(route);
    await expect(page.getByText(content, { exact: false }).first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${route === '/' ? 'home' : route.slice(1)}.png`),
      fullPage: false,
    });
  }

  expect(errors).toEqual([]);
});

test('导航搜索保留在原资讯流中并可切换筛选', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('搜索AI资讯...').fill('000');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page).toHaveURL(/\/news\?search=000/);
  await expect(page.getByText('搜索「000」的结果')).toBeVisible();
  await expect(page.locator('main h3')).toHaveCount(1);

  await page.goto('/news');
  await expect(page.getByText('共 95 篇文章', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '大模型', exact: true }).click();
  await expect(page.getByText('共 48 篇文章', { exact: false })).toBeVisible();
  await expect(page.locator('main h3')).toHaveCount(48);
});

test('保留自动刷新开关和手动刷新反馈', async ({ page }) => {
  await page.goto('/news');
  const autoRefresh = page.getByRole('button', { name: '自动刷新 ON', exact: true });
  await expect(autoRefresh).toBeVisible();
  await autoRefresh.click();
  await expect(page.getByRole('button', { name: '自动刷新 OFF', exact: true })).toBeVisible();

  await page.route('**/api/articles', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({
      json: {
        success: true,
        results: [{ source: '测试来源', type: 'news', count: 2 }],
      },
    });
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await expect(page.getByText('AI 资讯流')).toBeVisible();
});

test('详情页返回时保留原筛选和滚动位置', async ({ page }) => {
  await page.goto('/news');
  await expect(page.locator('main h3')).toHaveCount(95);
  await page.getByRole('button', { name: '大模型', exact: true }).click();
  await expect(page.locator('main h3')).toHaveCount(48);
  const link = page.locator('main a[href^="/article/"]').nth(15);
  await link.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await link.click();
  await expect(page.getByRole('link', { name: '查看原文', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回资讯流' }).click();
  await expect(page).toHaveURL(/\/news$/);
  await expect(page.locator('main h3')).toHaveCount(48);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 100);
});

test('论文抓取仍使用原有按钮，并只请求 papers 范围', async ({ page }) => {
  let called = false;
  await page.route('**/api/cron', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ scope: 'papers' });
    called = true;
    await route.fulfill({ json: { success: true, stats: { paperCount: 65 } } });
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.goto('/papers');
  await page.getByRole('button', { name: '抓取arXiv', exact: true }).click();
  await expect.poll(() => called).toBe(true);
});
