/**
 * 跨页面共享的 sessionStorage 键。
 *
 * 这些键是页面之间的隐式契约（详情页写、资讯流读），字符串散落在各处很容易写错
 * 或改一半，集中放在这里。
 */

/** 资讯流的列表快照（文章 + 筛选条件 + 时间戳） */
export const NEWS_CACHE_KEY = 'ai-radar-news-cache';

/** 资讯流的滚动位置 */
export const NEWS_SCROLL_KEY = 'ai-radar-news-scroll';

/**
 * 「这是后退回来的，请恢复滚动位置」标记。
 *
 * 详情页点「返回资讯流」时写入，资讯流挂载时读取并清除。
 *
 * 为什么不能只靠 popstate 事件判断：`router.back()` 之后 Next 会先把资讯流
 * 渲染出来，浏览器的 popstate 要晚几十毫秒才到，首帧做判断时它还没发生。
 * （浏览器自带的后退按钮顺序相反，popstate 先到，所以那条路径靠 popstate 判断。）
 */
export const NEWS_RESTORE_FLAG = 'ai-radar-news-restore';
