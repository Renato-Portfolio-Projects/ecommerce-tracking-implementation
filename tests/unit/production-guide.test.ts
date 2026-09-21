import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tableUnderHeading } from '../helpers/markdown';

const guide = readFileSync(new URL('../../docs/production-guide.md', import.meta.url), 'utf8');
const root = new URL('../../', import.meta.url);

const VERDICTS = ['Reusable as is', 'Needs replacing', 'Needs adding'];

/** The areas listed in the "At a glance" table, without its row about the reusable shop code. */
const areas = tableUnderHeading(guide, '## At a glance')
  .map(([area]) => area)
  .filter((area) => !area.startsWith('Shop code'));

describe('docs/production-guide.md', () => {
  it('says the day its sources were checked', () => {
    const match = guide.match(/Sources checked on (\d{4}-\d{2}-\d{2})\./);
    expect(match).not.toBeNull();
    expect(Number.isNaN(Date.parse(match![1]))).toBe(false);
  });

  it('gives every area in the at-a-glance table one of the three verdicts, a summary and a section of its own', () => {
    const rows = tableUnderHeading(guide, '## At a glance');
    expect(rows.length).toBeGreaterThan(5);
    for (const [area, verdict, summary] of rows) {
      expect(VERDICTS, `${area}: the verdict "${verdict}"`).toContain(verdict);
      expect(summary, `${area}: needs a one-line summary`).not.toBe('');
    }
    const headings = guide
      .split(/\r?\n/)
      .filter((line) => line.startsWith('## '))
      .map((line) => line.slice(3));
    for (const area of areas) expect(headings, `there is no section for ${area}`).toContain(area);
  });

  it('has, in every area, a table of four columns in which every row has a source', () => {
    expect(areas.length).toBeGreaterThan(5);
    for (const area of areas) {
      const rows = tableUnderHeading(guide, `## ${area}`);
      expect(rows.length, `${area} has no rows`).toBeGreaterThan(0);
      for (const row of rows) {
        const [demo, , repo, source] = row;
        expect(row.length, `${area}: the row "${demo}" needs four columns`).toBe(4);
        for (const cell of row) expect(cell, `${area}: an empty cell in "${demo}"`).not.toBe('');
        expect(demo.startsWith('**'), `${area}: "${demo}" should start with a bold topic`).toBe(true);
        expect(repo, `${area}: "${demo}" says nothing about where it is in this repo`).toMatch(/^Nothing yet$|`[^`]+`/);
        expect(source, `${area}: "${demo}" has no source`).toMatch(/\]\(https:\/\/[^\s)]+\)|^Not verified: /);
      }
    }
  });

  it('names only files and folders that exist', () => {
    const named = [...guide.matchAll(/`((?:src|docs|tests|\.github)\/[^`\s]*|package(?:-lock)?\.json)`/g)].map((m) => m[1]);
    expect(new Set(named).size).toBeGreaterThan(10);
    for (const path of named) expect(existsSync(new URL(path, root)), `${path} does not exist`).toBe(true);
  });

  it('links only to https pages', () => {
    const links = [...guide.matchAll(/\]\((https?:[^)\s]+)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(30);
    for (const link of links) expect(link.startsWith('https://'), `${link} is not https`).toBe(true);
    expect(guide).not.toContain('http://');
  });
});
