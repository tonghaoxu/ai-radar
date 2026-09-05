export const DEFAULT_SOURCES = [
  // === 中文AI媒体 ===
  // 机器之心: 全站JS渲染SPA，cheerio无法抓取，暂禁用
  {
    id: 'jiqizhixin',
    enabled: 0,
    name: '机器之心',
    type: 'news',
    url: 'https://www.jiqizhixin.com',
    rss_url: '',
  },
  // 量子位: WordPress RSS (/feed)。源本身没问题，但从国内网络环境访问时可能在 TLS 握手阶段失败
  //（ERR_SSL_WRONG_VERSION_NUMBER），常见于 VPN/加速器劫持了 DNS 或路由。抓取失败会记进 sources.last_error
  {
    id: 'qbitai',
    name: '量子位',
    type: 'news',
    url: 'https://www.qbitai.com',
    rss_url: 'https://www.qbitai.com/feed',
  },
  // 36氪: 直连 RSS。同上，且 https://36kr.com/feed 本身也可能已下线（走 HTTP 探测返回 404），
  //       长期失败的话考虑换 RSSHub 路由或直接禁用
  {
    id: '36kr-ai',
    name: '36氪AI',
    type: 'news',
    url: 'https://36kr.com/information/AI/',
    rss_url: 'https://36kr.com/feed',
  },
  // 虎嗅AI: RSS超时+WAF拦截，暂禁用
  {
    id: 'huxiu-ai',
    enabled: 0,
    name: '虎嗅AI',
    type: 'news',
    url: 'https://www.huxiu.com',
    rss_url: 'https://www.huxiu.com/rss/0.xml',
  },
  // === 英文AI媒体 ===
  {
    id: 'techcrunch-ai',
    name: 'TechCrunch AI',
    type: 'news',
    url: 'https://techcrunch.com/category/artificial-intelligence/',
    rss_url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
  },
  {
    id: 'venturebeat-ai',
    name: 'VentureBeat AI',
    type: 'news',
    url: 'https://venturebeat.com/category/ai/',
    rss_url: 'https://venturebeat.com/category/ai/feed/',
  },
  // The Batch: Next.js SPA，无RSS，暂禁用
  {
    id: 'the-batch',
    enabled: 0,
    name: 'The Batch',
    type: 'news',
    url: 'https://www.deeplearning.ai/the-batch/',
    rss_url: '',
  },
  {
    id: 'mit-tr-ai',
    name: 'MIT Tech Review AI',
    type: 'news',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/',
    rss_url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/',
  },
  // === RSSHub 聚合源（公共实例不稳定，冗余） ===
  {
    id: 'rsshub-36kr',
    name: 'RSSHub-36氪',
    type: 'news',
    url: 'https://rsshub.app',
    rss_url: 'https://rsshub.app/36kr/motif/ai',
  },
  // === 社区 ===
  {
    id: 'hackernews',
    name: 'Hacker News',
    type: 'news',
    url: 'https://news.ycombinator.com',
    rss_url: '',
  },
  {
    id: 'github-trending',
    name: 'GitHub Trending AI',
    type: 'news',
    url: 'https://github.com/trending',
    rss_url: '',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'model',
    url: 'https://openrouter.ai',
    rss_url: '',
  },
  // === 论文 ===
  { id: 'arxiv', name: 'arXiv', type: 'paper', url: 'https://arxiv.org', rss_url: '' },
];
