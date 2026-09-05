import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="mb-3 text-2xl font-bold">页面不存在</h1>
      <Link href="/" className="text-primary underline">
        返回首页
      </Link>
    </div>
  );
}
