#!/usr/bin/env node
/**
 * Builds the static catalog data for site/ from repository files.
 *
 * Reads: .claude-plugin/marketplace.json, each plugin's plugin.json,
 * README/CHANGELOG/COMPATIBILITY, and the frontmatter + body of every
 * skills/<name>/SKILL.md and agents/<name>.md.
 *
 * Writes (git-ignored): site/public/{index.json,releases.json,stats.json}
 * and site/public/bodies/*.md.
 *
 * Node >= 20, stdlib only. See docs/SITE-SPEC.md for the data contracts.
 */

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site', 'public');
const BODIES = path.join(OUT, 'bodies');

/** Minimal YAML frontmatter parser: scalar values + simple `- item` lists. */
function parseFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(markdown);
  if (!match) return { data: {}, body: markdown };
  const data = {};
  let currentKey = null;
  let folded = null; // { key, lines } for `key: >`-style blocks
  for (const rawLine of match[1].split(/\r?\n/)) {
    if (folded) {
      if (/^\s+\S/.test(rawLine)) {
        folded.lines.push(rawLine.trim());
        continue;
      }
      data[folded.key] = folded.lines.join(' ').trim();
      folded = null;
    }
    const listItem = /^\s+-\s+(.*)$/.exec(rawLine);
    if (listItem && currentKey) {
      if (!Array.isArray(data[currentKey])) data[currentKey] = [];
      data[currentKey].push(listItem[1].trim());
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(rawLine);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    currentKey = key;
    const value = rawValue.trim();
    if (value === '>' || value === '|' || value === '>-' || value === '|-') {
      folded = { key, lines: [] };
    } else if (value === '') {
      data[key] = ''; // may become a list via subsequent `- item` lines
    } else {
      data[key] = value.replace(/^["']|["']$/g, '');
    }
  }
  if (folded) data[folded.key] = folded.lines.join(' ').trim();
  return { data, body: markdown.slice(match[0].length) };
}

/** Strip markdown syntax well enough for a search corpus. */
function toSearchText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/[*_>|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readIfExists(filePath) {
  return existsSync(filePath) ? readFile(filePath, 'utf8') : null;
}

/** Parse `## [x.y.z] - YYYY-MM-DD` sections with up to 3 bullet highlights. */
function parseChangelog(markdown, pluginName) {
  const releases = [];
  if (!markdown) return releases;
  const sections = markdown.split(/^## /m).slice(1);
  for (const section of sections) {
    const header = /^\[?(\d+\.\d+\.\d+)\]?\s*-\s*(\d{4}-\d{2}-\d{2})/.exec(section);
    if (!header) continue;
    const bullets = [...section.matchAll(/^- (.+)$/gm)].slice(0, 3).map((m) => m[1].trim());
    releases.push({
      plugin: pluginName,
      version: header[1],
      date: header[2],
      tag: `${pluginName}--v${header[1]}`,
      highlights: bullets,
    });
  }
  return releases;
}

async function writeBody(fileName, content) {
  await writeFile(path.join(BODIES, fileName), content, 'utf8');
  return `bodies/${fileName}`;
}

async function collectArtifacts(pluginDir, pluginName) {
  const artifacts = [];

  const skillsDir = path.join(pluginDir, 'skills');
  if (existsSync(skillsDir)) {
    for (const entry of await readdir(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
      const raw = await readIfExists(skillFile);
      if (!raw) continue;
      const { data, body } = parseFrontmatter(raw);
      const name = data.name || entry.name;
      artifacts.push({
        id: `${pluginName}:${name}`,
        plugin: pluginName,
        type: 'skill',
        name,
        description: data.description || '',
        bodyPath: await writeBody(`${pluginName}--skill--${name}.md`, raw),
        searchText: toSearchText(`${name} ${data.description || ''} ${body}`).slice(0, 8000),
      });
    }
  }

  const agentsDir = path.join(pluginDir, 'agents');
  if (existsSync(agentsDir)) {
    for (const entry of await readdir(agentsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const raw = await readFile(path.join(agentsDir, entry.name), 'utf8');
      const { data, body } = parseFrontmatter(raw);
      const name = data.name || entry.name.replace(/\.md$/, '');
      artifacts.push({
        id: `${pluginName}:${name}`,
        plugin: pluginName,
        type: 'agent',
        name,
        description: data.description || '',
        tools: data.tools || undefined,
        model: data.model || undefined,
        bodyPath: await writeBody(`${pluginName}--agent--${name}.md`, raw),
        searchText: toSearchText(`${name} ${data.description || ''} ${body}`).slice(0, 8000),
      });
    }
  }

  return artifacts;
}

async function main() {
  const marketplaceRaw = JSON.parse(
    await readFile(path.join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'),
  );

  await rm(OUT, { recursive: true, force: true });
  await mkdir(BODIES, { recursive: true });

  const generatedAt = new Date().toISOString();
  const plugins = [];
  const releases = [];
  const byPlugin = {};

  for (const entry of marketplaceRaw.plugins) {
    const pluginDir = path.join(ROOT, entry.source);
    const manifest = JSON.parse(
      await readFile(path.join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8'),
    );
    const name = manifest.name;

    const readme = await readIfExists(path.join(pluginDir, 'README.md'));
    const changelog = await readIfExists(path.join(pluginDir, 'CHANGELOG.md'));
    const compatibility = await readIfExists(path.join(pluginDir, 'COMPATIBILITY.md'));

    const pluginReleases = parseChangelog(changelog, name);
    releases.push(...pluginReleases);

    const artifacts = await collectArtifacts(pluginDir, name);
    const counts = {
      skills: artifacts.filter((a) => a.type === 'skill').length,
      agents: artifacts.filter((a) => a.type === 'agent').length,
    };
    byPlugin[name] = counts;

    const compatibilityLine = compatibility
      ? (/\*\*(.+?)\*\*/.exec(compatibility)?.[1] ?? compatibility.split('\n').find((l) => l.includes('>=')))
      : undefined;

    plugins.push({
      name,
      version: manifest.version,
      description: manifest.description || '',
      author: manifest.author?.name,
      keywords: manifest.keywords || [],
      category: entry.category,
      tags: entry.tags || [],
      compatibility: compatibilityLine?.trim(),
      dependencies: (manifest.dependencies || []).map((dep) =>
        typeof dep === 'string' ? { name: dep, version: '*' } : { name: dep.name, version: dep.version },
      ),
      installCommand: `claude plugin install ${name}@${marketplaceRaw.name}`,
      counts,
      readmePath: readme ? await writeBody(`${name}--README.md`, readme) : undefined,
      changelogPath: changelog ? await writeBody(`${name}--CHANGELOG.md`, changelog) : undefined,
      updatedAt: pluginReleases[0]?.date,
      artifacts,
    });
  }

  releases.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.plugin.localeCompare(b.plugin)));

  const index = {
    generatedAt,
    marketplace: {
      name: marketplaceRaw.name,
      description: marketplaceRaw.description || '',
      owner: marketplaceRaw.owner?.name,
      repoUrl: 'https://github.com/yamchinsky/dev-digest-ai-marketplace',
      addCommand: 'claude plugin marketplace add yamchinsky/dev-digest-ai-marketplace',
    },
    plugins,
  };

  const stats = {
    generatedAt,
    totals: {
      plugins: plugins.length,
      skills: plugins.reduce((sum, p) => sum + p.counts.skills, 0),
      agents: plugins.reduce((sum, p) => sum + p.counts.agents, 0),
    },
    byPlugin,
  };

  await writeFile(path.join(OUT, 'index.json'), JSON.stringify(index, null, 2));
  await writeFile(path.join(OUT, 'releases.json'), JSON.stringify(releases, null, 2));
  await writeFile(path.join(OUT, 'stats.json'), JSON.stringify(stats, null, 2));

  console.log(
    `build-index: ${plugins.length} plugins, ` +
      `${stats.totals.skills} skills, ${stats.totals.agents} agents, ` +
      `${releases.length} releases → site/public/`,
  );
}

await main();
