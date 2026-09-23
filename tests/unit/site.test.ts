import { describe, expect, it } from 'vitest';
import { REPOSITORY_URL, SITE_LINKS } from '../../src/store/site';

describe('the store\'s links to places outside the site', () => {
  it('all use https and end without a slash', () => {
    for (const [name, link] of Object.entries(SITE_LINKS)) {
      expect(link, name).toMatch(/^https:\/\//);
      expect(link.endsWith('/'), `${name} ends with a slash`).toBe(false);
    }
  });

  it('all point into the project\'s repository', () => {
    expect(REPOSITORY_URL).toBe('https://github.com/Renato-Portfolio-Projects/ecommerce-tracking-implementation');
    for (const [name, link] of Object.entries(SITE_LINKS)) expect(link.startsWith(REPOSITORY_URL), name).toBe(true);
  });

  it('sends questions to the issues page and the guide to the file that holds it', () => {
    expect(SITE_LINKS.issues).toBe(`${REPOSITORY_URL}/issues`);
    expect(SITE_LINKS.guide).toBe(`${REPOSITORY_URL}/blob/main/docs/production-guide.md`);
  });
});
