// Where the store's pages link to outside the site. This is the store's own data. The repository is
// where the project is explained, until the case study has a page of its own.

export const REPOSITORY_URL = 'https://github.com/Renato-Portfolio-Projects/ecommerce-tracking-implementation';

export const SITE_LINKS = {
  /** Where "How it's tracked" and "The project on GitHub" lead. */
  project: REPOSITORY_URL,
  /** Where the Contact page sends questions and mistakes. */
  issues: `${REPOSITORY_URL}/issues`,
  /** The guide to what a real launch would need, in the repository. */
  guide: `${REPOSITORY_URL}/blob/main/docs/production-guide.md`,
} as const;
