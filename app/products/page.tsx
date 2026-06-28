'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, ExternalLink } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
  pricing_model: string;
  based_model: string;
  is_hot: number;
  languages: string;
}

const PRODUCT_CATEGORIES = [
  '全部',
  '智能助手',
  '搜索引擎',
  '编程工具',
  '设计创作',
  '视频生成',
  '办公效率',
];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [showHot, setShowHot] = useState(false);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedCategory !== '全部') params.set('category', selectedCategory);
        if (showHot) params.set('isHot', 'true');
        params.set('limit', '100');

        const res = await fetch(`/api/products?${params}`);
        const data = await res.json();
        if (data.products) {
          setProducts(data.products);
        }
        if (data.categories) {
          setCategories(data.categories);
        }
      } catch (err) {
        console.error('获取产品失败:', err);
      }
      setLoading(false);
    }
    fetchProducts();
  }, [selectedCategory, showHot]);

  return (
    <div className="container px-4 py-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">AI 产品库</h1>
        <p className="text-sm text-muted-foreground">
          发现和了解各种AI应用产品
        </p>
      </div>

      <Separator className="mb-4" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {PRODUCT_CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </Button>
        ))}
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button
          variant={showHot ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowHot(!showHot)}
        >
          🔥 热门
        </Button>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  {product.is_hot === 1 && <Badge variant="destructive" className="text-xs">🔥</Badge>}
                </div>
                <Badge variant="secondary" className="text-xs w-fit">
                  {product.category}
                </Badge>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between gap-2">
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {product.description}
                </p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {product.pricing_model && <p>💰 {product.pricing_model}</p>}
                  {product.based_model && <p>🧠 模型: {product.based_model}</p>}
                </div>
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto"
                >
                  <Button variant="outline" size="sm" className="w-full mt-2 text-xs">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    访问
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && products.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">🧩</p>
          <p>暂无产品数据</p>
        </div>
      )}
    </div>
  );
}
