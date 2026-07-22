export interface Genre {
  slug:  string;
  label: string;
}

// Fixed, flat, in-app list. Every slug was checked to fit the 20-byte tag
// budget once prefixed with "genre:" (6 bytes) - a few longer display names
// get a shortened slug (e.g. Mystery/Thriller -> "mystery", not
// "mystery-thriller", which would be 16 bytes and too long).
export const GENRES: Genre[] = [
  { slug: 'sci-fi',        label: 'Sci-Fi' },
  { slug: 'fantasy',       label: 'Fantasy' },
  { slug: 'mystery',       label: 'Mystery/Thriller' },
  { slug: 'horror',        label: 'Horror' },
  { slug: 'romance',       label: 'Romance' },
  { slug: 'adventure',     label: 'Adventure' },
  { slug: 'hist-fiction',  label: 'Historical Fiction' },
  { slug: 'history',       label: 'History/Humanities' },
  { slug: 'memoir-bio',    label: 'Memoir/Biography' },
  { slug: 'true-crime',    label: 'True Crime' },
  { slug: 'self-help',     label: 'Self-Help' },
  { slug: 'how-to-diy',    label: 'How-To/DIY' },
  { slug: 'blueprint',     label: 'Blueprint/Diagram' },
  { slug: 'business',      label: 'Business' },
  { slug: 'philosophy',    label: 'Philosophy' },
  { slug: 'science',       label: 'Science' },
  { slug: 'occult',        label: 'Occult' },
  { slug: 'recipe',        label: 'Recipe' },
  { slug: 'poetry',        label: 'Poetry' },
  { slug: 'graphic-novel', label: 'Comics/Graphic Novel' },
  { slug: 'childrens',     label: "Children's" },
  { slug: 'young-adult',   label: 'Young Adult' },
  { slug: 'humor',         label: 'Humor' },
  { slug: 'reference',     label: 'Reference' },
  { slug: 'spirituality',  label: 'Religion/Spirituality' },
  { slug: 'travel',        label: 'Travel' },
];

export const MAX_GENRES_PER_BOOK = 4;

export function genreLabel(slug: string): string {
  return GENRES.find(g => g.slug === slug)?.label ?? slug;
}
