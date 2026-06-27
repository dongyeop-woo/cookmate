import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO 8601 YYYY-MM-DD
  tags: string[];
  image?: string;
  bodyHtml: string;
  bodyText: string; // for excerpts
};

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

function ensureDir(): boolean {
  try { return fs.existsSync(BLOG_DIR); } catch { return false; }
}

/** Sort newest first. */
export function getAllPosts(): BlogPost[] {
  if (!ensureDir()) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
  const posts = files.map((file) => loadPost(file.replace(/\.md$/, ''))).filter((p): p is BlogPost => p !== null);
  return posts.sort((a, b) => (b.date > a.date ? 1 : -1));
}

export function getAllSlugs(): string[] {
  if (!ensureDir()) return [];
  return fs.readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/, ''));
}

export function loadPost(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  const bodyHtml = marked.parse(content, { async: false }) as string;
  const bodyText = content.replace(/[#*`_>\-\[\]\(\)!]/g, '').replace(/\s+/g, ' ').trim();
  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? bodyText.slice(0, 150),
    date: data.date ?? new Date().toISOString().slice(0, 10),
    tags: Array.isArray(data.tags) ? data.tags : [],
    image: data.image,
    bodyHtml,
    bodyText,
  };
}
