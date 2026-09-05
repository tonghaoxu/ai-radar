import { test, expect } from '@playwright/test';

test('主要页面可访问、无脚本异常且移动端没有横向溢出', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [route, heading] of [
    ['/', '今日 AI 资讯'],
    ['/news', 'AI 资讯流'],
    ['/papers', '论文追踪'],
    ['/models', '大模型追踪'],
    ['/products', 'AI 产品库'],
    ['/search?q=AI', '搜索「AI」'],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${route === '/' ? 'home' : route.split('?')[0].slice(1)}.png`),
      fullPage: false,
    });
  }
  expect(errors).toEqual([]);
});

test('资讯分页、组合筛选与 URL 参数一致', async ({ page }) => {
  await page.goto('/news');
  await expect(page.getByText('共 95 篇文章', { exact: false })).toBeVisible();
  await expect(page.locator('main h3')).toHaveCount(40);
  await page.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(page.locator('main h3')).toHaveCount(40);
  await page.getByRole('button', { name: '大模型', exact: true }).click();
  await expect(page).not.toHaveURL(/page=1/);
  await expect(page.getByText('共 48 篇文章', { exact: false })).toBeVisible();
  await page.goto('/news?search=000&category=大模型');
  await expect(page.locator('main h3')).toHaveCount(1);
  await expect(page.getByText('共 1 篇文章', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '清除搜索' }).click();
  await expect(page).not.toHaveURL(/search=/);
});

test('收藏验证密钥并能在收藏筛选中取消', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept('e2e-test-secret'));
  await page.goto('/news?search=094');
  await page.getByRole('button', { name: '收藏文章', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible();
  await page.getByRole('button', { name: '收藏', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消收藏' })).toBeVisible();
  await page.getByRole('button', { name: '取消收藏' }).click();
  await expect(page.getByText('没有符合当前筛选的文章')).toBeVisible();
});

test('资讯详情返回原筛选和滚动位置', async ({ page }) => {
  await page.goto('/news?category=大模型');
  await expect(page.locator('main h3')).toHaveCount(40);
  const link = page.locator('main a[href^="/article/"]').nth(15);
  await link.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  await link.click();
  await expect(page.getByRole('link', { name: '查看原文', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回资讯流' }).click();
  await expect(page).toHaveURL(/category=/);
  await expect(page.locator('main h3')).toHaveCount(40);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 100);
});

test('论文抓取使用 POST 且只请求 papers 范围', async ({ page }) => {
  let called = false;
  await page.route('**/api/cron', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ scope: 'papers' });
    called = true;
    await route.fulfill({ json: { results: [{ source: 'arXiv', type: 'paper', count: 3 }] } });
  });
  await page.goto('/papers');
  await page.getByRole('button', { name: '抓取arXiv', exact: true }).click();
  await expect(page.getByText('处理了 3 篇论文（包含更新）')).toBeVisible();
  expect(called).toBe(true);
});

test('全站搜索包含四类结果', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: '全站搜索' }).fill('AI');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await expect(page).toHaveURL(/search\?q=AI/);
  await expect(page.getByRole('heading', { name: /资讯（/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /论文（/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /模型（/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /产品（/ })).toBeVisible();
});

test('读取失败给出重试而非空列表', async ({ page }) => {
  await page.route('**/api/articles?**', (route) =>
    route.fulfill({ status: 500, json: { error: '测试网络故障' } }),
  );
  await page.goto('/news');
  await expect(page.locator('main').getByRole('alert')).toContainText('测试网络故障');
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
  await expect(page.getByText('还没有文章，抓取最新资讯开始阅读')).not.toBeVisible();
});

test('跟随系统暗色时第一次点击切换到亮色', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: '切换暗色模式' }).click();
  await expect(page.locator('html')).toHaveClass(/light/);
});

test('论文读取失败不显示抓取空态', async ({ page }) => {
  await page.route('**/api/papers?**', (route) =>
    route.fulfill({ status: 500, json: { error: '论文服务暂时不可用' } }),
  );
  await page.goto('/papers');
  await expect(page.locator('main').getByRole('alert')).toContainText('论文服务暂时不可用');
  await expect(page.getByText('暂无符合筛选的论文')).not.toBeVisible();
});
