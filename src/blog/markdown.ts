import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { toString as mdastToString } from "mdast-util-to-string";
import type { BlogTocItem } from "@/lib/blog/types";

function countWords(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

function readingTimeMinutes(text: string): number {
  return Math.max(1, Math.ceil(countWords(text) / 200));
}

function getTextFromNode(node: { type?: string; value?: string; children?: unknown[] }): string {
  if (!node) return "";
  if (node.type === "text" && typeof node.value === "string") return node.value;
  if (Array.isArray(node.children)) return node.children.map((c) => getTextFromNode(c as any)).join("");
  return "";
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(function rehypeTocAndHeadingWrap() {
    return (tree: any, file: any) => {
      const toc: BlogTocItem[] = [];
      const headingNodes: { parent: any; index: number; node: any; id: string }[] = [];

      visit(tree, "element", (node: any, index, parent) => {
        if (!parent || typeof index !== "number") return;
        if (node.tagName && /^h[1-6]$/.test(node.tagName)) {
          const depth = Number(node.tagName.slice(1)) as 2 | 3 | 4;
          const id = node.properties?.id;
          if (depth >= 2 && depth <= 4 && typeof id === "string" && id) {
            const text = getTextFromNode(node).trim();
            if (text) toc.push({ id, depth, text });
          }
          if (typeof id === "string" && id) headingNodes.push({ parent, index, node, id });
        }
      });

      headingNodes
        .sort((a, b) => b.index - a.index)
        .forEach(({ parent, index, node, id }) => {
          const copyBtn = {
            type: "element",
            tagName: "button",
            properties: {
              type: "button",
              className: ["blog-heading-copy"],
              "data-heading-id": id,
              "aria-label": "Copy link to section",
            },
            children: [{ type: "text", value: "Copy link" }],
          };
          const wrapper = {
            type: "element",
            tagName: "div",
            properties: { className: ["blog-heading-wrapper"] },
            children: [node, copyBtn],
          };
          parent.children[index] = wrapper;
        });

      (file as any).data.toc = toc;
    };
  })
  .use(rehypeStringify);

export function renderMarkdown(markdown: string): {
  summary: string;
  readingTime: number;
  html: string;
  toc: BlogTocItem[];
} {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as any;
  let firstParagraph = "";
  visit(tree, (node: any) => {
    if (firstParagraph) return;
    if (node.type === "paragraph") firstParagraph = mdastToString(node).trim();
  });
  const fullText = mdastToString(tree).trim();
  const summary = firstParagraph || fullText.slice(0, 200);
  const readingTime = readingTimeMinutes(fullText);

  const vfile = processor.processSync(markdown.trim());
  const html = String(vfile);
  const toc = (Array.isArray((vfile as any).data?.toc) ? (vfile as any).data.toc : []) as BlogTocItem[];

  return { summary, readingTime, html, toc };
}
