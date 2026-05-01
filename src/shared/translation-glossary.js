/**
 * 翻译词库：常见技术 / 品牌专有名词的"防误译"映射。
 *
 * 翻译完成后扫描译文，把已知的中文误译替换回英文原名。
 * 仅在原文里出现该术语时才替换，避免误伤无关上下文（如"火狐"在小说里指动物）。
 *
 * 匹配规则：
 *   - 原文匹配大小写敏感、需 word-boundary（避免 "Bun"/"bun" 误判）
 *   - 中文误译直接子串替换
 */

export const DEFAULT_GLOSSARY = [
  // 浏览器
  { term: "Chrome", mistranslations: ["铬"] },
  { term: "Firefox", mistranslations: ["火狐"] },
  { term: "Safari", mistranslations: ["野生动物园", "Safari 浏览器"] },
  { term: "Edge", mistranslations: ["边缘"] },
  { term: "Opera", mistranslations: ["歌剧"] },
  { term: "Brave", mistranslations: ["勇敢"] },
  { term: "Arc", mistranslations: ["弧"] },

  // 框架 / 库
  { term: "React", mistranslations: ["反应", "反应器"] },
  { term: "Vue", mistranslations: ["视图"] },
  { term: "Angular", mistranslations: ["有角的", "棱角"] },
  { term: "Svelte", mistranslations: ["苗条"] },
  { term: "Solid", mistranslations: ["固体"] },
  { term: "Remix", mistranslations: ["混音", "重新混合"] },
  { term: "Astro", mistranslations: ["天文"] },
  { term: "Next.js", mistranslations: ["下一个.js", "下一个 js", "下一个"] },
  { term: "Nuxt", mistranslations: [] },

  // 运行时
  { term: "Node.js", mistranslations: ["节点.js", "节点 js"] },
  { term: "Deno", mistranslations: [] },
  { term: "Bun", mistranslations: ["小圆面包", "小面包"] },

  // 构建 / 工具链
  { term: "Vite", mistranslations: [] },
  { term: "Webpack", mistranslations: ["网络包", "网包"] },
  { term: "Rollup", mistranslations: ["卷起", "汇总"] },
  { term: "esbuild", mistranslations: [] },
  { term: "Babel", mistranslations: ["巴别塔"] },
  { term: "Turbopack", mistranslations: [] },
  { term: "SWC", mistranslations: [] },

  // 通用技术名词（保持英文形态更通用）
  { term: "JSX", mistranslations: [] },
  { term: "TSX", mistranslations: [] },
  { term: "GitHub", mistranslations: ["Github"] },
  { term: "GitLab", mistranslations: [] },
];

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 扫描原文中出现的术语，再把译文里对应的中文误译换回原术语
 * @param {string} originalText
 * @param {string} translatedText
 * @param {Array<{term:string, mistranslations:string[]}>} [glossary]
 * @returns {string}
 */
export function applyGlossaryReverts(
  originalText,
  translatedText,
  glossary = DEFAULT_GLOSSARY,
) {
  const orig = String(originalText || "");
  let result = String(translatedText || "");
  if (!orig || !result) return result;

  for (const entry of glossary) {
    const { term, mistranslations = [] } = entry || {};
    if (!term) continue;
    // 仅在原文存在该术语时介入；大小写敏感 + word-boundary
    const termPattern = new RegExp(`\\b${escapeRegex(term)}\\b`);
    if (!termPattern.test(orig)) continue;
    // 1. 中文误译换回英文原名
    for (const wrong of mistranslations) {
      if (!wrong) continue;
      if (result.includes(wrong)) {
        result = result.split(wrong).join(term);
      }
    }
    // 2. 如果译文里漏掉了该术语（比如直接把它丢了），不强行注入；
    //    保持谨慎，仅做替换，不做插入。
  }
  return result;
}
