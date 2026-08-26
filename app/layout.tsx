import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

// 这里原本用 next/font/google 加载 Geist / Geist Mono，已移除。原因有二：
//
// 1) 它会拖慢启动，而且是致命的那种。next/font/google 的字体是**编译时由服务端**
//    去 fonts.googleapis.com / fonts.gstatic.com 下载的（文档原话："downloaded at
//    build time and self-hosted" —— 不向 Google 发请求的是浏览器，不是构建过程）。
//    dev 冷启动必须先编译本文件才能响应首页，国内网络下这两个域名不通，
//    请求挂到超时重试，整个启动就卡在这里。
//
// 2) 换来的是零收益。--font-geist-sans 全项目无人引用；--font-geist-mono 只被
//    globals.css 的 --font-mono 引用，而 font-mono 这个类没有任何组件在用。
//    页面实际渲染用的一直是系统默认字体。
//
// 若以后确实要用 Geist，请走自托管（npm i geist，或 next/font/local + 本地
// woff2），不要再引入编译期的外网依赖。

export const metadata: Metadata = {
  title: "AI Radar — AI资讯聚合平台",
  description: "一站式追踪AI前沿：大模型、论文、产品、政策动态",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased bg-background"
      suppressHydrationWarning
    >
      <body className="flex flex-col bg-background">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <TooltipProvider>
            <Navbar />
            <main>{children}</main>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
