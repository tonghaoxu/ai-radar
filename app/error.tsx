'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="mb-3 text-xl font-bold">页面暂时无法显示</h1>
      <p className="mb-5 text-muted-foreground">请重试，或返回首页继续浏览。</p>
      <Button onClick={reset}>重试</Button>
      <Link href="/" className="ml-4 underline">
        返回首页
      </Link>
    </div>
  );
}
