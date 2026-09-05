export interface Article {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  content_snippet: string | null;
  source_id: string;
  source_name: string | null;
  category: string;
  language: string;
  published_at: string | null;
  crawled_at: string;
  author: string | null;
  is_starred: number;
  is_read: number;
}
export interface Source {
  id: string;
  name: string;
  type: string;
  url: string | null;
  rss_url: string | null;
  enabled: number;
  crawl_interval_min: number;
  last_crawled_at: string | null;
  last_attempt_at: string | null;
  fail_count: number;
  last_error: string | null;
}
export interface Paper {
  id: string;
  arxiv_id: string;
  title: string;
  authors: string | null;
  abstract: string | null;
  categories: string | null;
  primary_category: string | null;
  published_at: string | null;
  pdf_url: string | null;
  code_url: string | null;
}
export interface ModelBenchmark {
  model_id: string;
  benchmark_name: string;
  score: number;
  metric: string;
}
export interface Model {
  id: string;
  name: string;
  provider: string;
  version: string | null;
  params_b: number | null;
  context_window: number | null;
  modalities: string;
  license_type: string | null;
  is_open_source: number;
  description: string | null;
  released_at: string | null;
  input_price_per_1m: number | null;
  output_price_per_1m: number | null;
  currency: string | null;
  free_tier: string | null;
  source_url: string | null;
  price_updated_at: string | null;
  benchmarks: ModelBenchmark[];
}
export interface Product {
  id: string;
  name: string;
  category: string;
  description: string | null;
  url: string | null;
  pricing_model: string | null;
  based_model: string | null;
  is_hot: number;
  languages: string | null;
}
