'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Moon, Sun } from 'lucide-react';

const navItems = [
  { href: '/', label: '首页' },
  { href: '/news', label: '资讯流' },
  { href: '/papers', label: '论文' },
  { href: '/products', label: 'AI产品' },
  { href: '/models', label: '模型追踪' },
];

export function Navbar() {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, setTheme } = useTheme();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/news?search=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="text-2xl">⚡</span>
            <span className="hidden sm:inline bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI Radar
            </span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({
                    variant: pathname === item.href ? 'secondary' : 'ghost',
                    size: 'sm',
                  })
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Theme toggle + Search */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="切换暗色模式"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </Button>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            type="search"
            placeholder="搜索AI资讯..."
            className="w-[160px] md:w-[240px] h-8 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" className="h-8">
            搜索
          </Button>
        </form>
        </div>
      </div>

      {/* Mobile Nav */}
      <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <Badge
              variant={pathname === item.href ? 'default' : 'outline'}
              className="whitespace-nowrap"
            >
              {item.label}
            </Badge>
          </Link>
        ))}
      </nav>
    </header>
  );
}
