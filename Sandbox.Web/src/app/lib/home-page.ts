/*
 * home-page.ts: how the home page groups the categories into topics, the data color each
 * topic's sites take on the site map, and the programs whose headline figures lead the page.
 * Pure data and functions with no DOM types, so it is tested under Node.
 *
 * The five topics are a proposal for the home page only. A category belongs to a topic by
 * its folder; a category no topic lists still shows, under Other Topics, so adding a
 * category never hides it.
 */

export interface Topic {
  id: string;
  name: string;
  /** The data color of the topic's sites and its dot, as a token expression. */
  color: string;
  /** The category folders in the topic, in the order their cards are shown. */
  folders: readonly string[];
}

/** A slot of the categorical data palette. The slots are used as a set, one a topic. */
const slot = (n: number): string => `var(--color-background-dataviz-categorical-${n})`;

/** The topics in page order. */
export const TOPICS: readonly Topic[] = [
  {
    id: 'lake-and-water',
    name: 'Lake and Water',
    color: slot(1),
    folders: ['water-quality', 'aquatic-invasive-species'],
  },
  {
    id: 'land-and-forest',
    name: 'Land and Forest',
    color: slot(2),
    folders: ['forest-structure', 'fire-dynamics', 'biodiversity', 'soil-conservation'],
  },
  {
    id: 'air-climate-and-noise',
    name: 'Air, Climate, and Noise',
    color: slot(4),
    folders: ['air-quality', 'climate-and-lake-conditions', 'noise'],
  },
  {
    id: 'people-and-communities',
    name: 'People and Communities',
    color: slot(3),
    folders: ['transportation-and-sustainable-communities', 'housing-and-economy', 'demographics'],
  },
  {
    id: 'recreation-and-scenery',
    name: 'Recreation and Scenery',
    color: slot(5),
    folders: ['recreation', 'scenic-resources'],
  },
];

/** Where a category goes when no topic lists its folder. */
export const OTHER_TOPIC: Topic = { id: 'other', name: 'Other Topics', color: slot(6), folders: [] };

/** The topic a category folder belongs to. */
export function topicOf(folder: string): Topic {
  return TOPICS.find((topic) => topic.folders.includes(folder)) ?? OTHER_TOPIC;
}

export interface TopicGroup<T> {
  topic: Topic;
  items: T[];
}

/**
 * Items under their topics: topics in page order, the items of a topic in its folder order,
 * and items no topic lists last, under Other Topics, in the order given. A topic with no
 * items is left out.
 */
export function groupByTopic<T>(items: readonly T[], folderOf: (item: T) => string): TopicGroup<T>[] {
  const groups: TopicGroup<T>[] = TOPICS.map((topic) => ({
    topic,
    items: topic.folders.flatMap((folder) => items.filter((item) => folderOf(item) === folder)),
  }));
  const other = items.filter((item) => topicOf(folderOf(item)) === OTHER_TOPIC);
  return [...groups, { topic: OTHER_TOPIC, items: other }].filter((group) => group.items.length > 0);
}

/**
 * The programs whose headline leads the home page, in the order shown. A tile shows the
 * same figure as the program's own header: the latest value of its first chart. A program
 * whose first chart has no single latest value, or whose data does not load, is left out.
 */
export const HOME_HEADLINE_PROGRAMS: readonly number[] = [
  66, // Pelagic Water Quality (Clarity): lake clarity
  39, // Tahoe Yellow Cress Monitoring: occupied sites
  73, // Nitrogen Dioxide (NO2): annual average
  9936, // Effective Population
];
