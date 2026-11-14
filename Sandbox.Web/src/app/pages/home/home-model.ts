// Pure logic for the home page: no DOM, no Angular. The page and its map read
// these to decide which programs are in color and what the map panel says.
import type { Category, MonitoringProgramSummary } from '../../api/models';

/**
 * THE ONE PLACE the color of a category's sites is decided on the home page. The map
 * markers and popups read it; the cards, the legend, and the About goals are neutral. A
 * token expression such as var(--x) works: the map resolves it before drawing.
 */
export function categoryColor(_item: { ThemeColor: string }): string {
  // Ecology default: containers stay neutral and one data color carries the sites. The
  // Threshold Dashboard theme colors (item.ThemeColor) are not used on this page.
  return 'var(--color-background-dataviz-categorical-1)';
}

/** A category with its programs, sorted by name, ready for a card. */
export interface CategoryGroup {
  category: Category;
  programs: MonitoringProgramSummary[];
  /** categoryColor() of the category. */
  color: string;
  /** True when the theme color is so light that white text or a white icon would not read on it. */
  light: boolean;
}

/** What the map shows in color, and the line above it that says so. */
export interface MapFocus {
  /** Programs whose sites are in color; null means every site is. */
  programIds: ReadonlySet<number> | null;
  title: string;
  sub: string;
  /** The swatch beside the title: a category color, or null for the neutral swatch. */
  color: string | null;
}

/** The hover and selection state the map follows. */
export interface FocusState {
  /** The selected (open) category folder. */
  selected: string | null;
  /** The last category hovered or focused. */
  hoverCategory: string | null;
  /** The last program hovered or focused. */
  hoverProgram: MonitoringProgramSummary | null;
  /** Programs matching the search, or null when the box is empty. */
  matches: ReadonlySet<number> | null;
}

export const plural = (count: number, word: string): string => (count === 1 ? word : `${word}s`);

/** 1,750, the way the page prints counts. */
export const formatCount = (value: number): string => value.toLocaleString('en-US');

/** "25%" in API text reads as "25 percent" on the page, per the house style. */
export const spellPercent = (text: string): string => text.replace(/(\d)\s?%/g, '$1 percent');

/** Relative luminance above 0.4: white on this color fails, so dark is used instead. */
export function isLightColor(hex: string): boolean {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return false;
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(match[1].slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}

/** Categories alphabetical, each with its programs alphabetical. */
export function groupPrograms(
  categories: readonly Category[],
  programs: readonly MonitoringProgramSummary[],
): CategoryGroup[] {
  const byName = (a: string, b: string): number => a.localeCompare(b, 'en');
  return [...categories]
    .sort((a, b) => byName(a.CategoryName, b.CategoryName))
    .map((category) => ({
      category,
      color: categoryColor(category),
      light: isLightColor(categoryColor(category)),
      programs: programs
        .filter((program) => program.CategoryID === category.CategoryID)
        .sort((a, b) => byName(a.MonitoringProgramName, b.MonitoringProgramName)),
    }));
}

/** Programs whose name or any partner name contains the text; null for an empty search. */
export function matchPrograms(
  programs: readonly MonitoringProgramSummary[],
  text: string,
): ReadonlySet<number> | null {
  const query = text.trim().toLowerCase();
  if (!query) return null;
  return new Set(
    programs
      .filter((program) =>
        [program.MonitoringProgramName, ...program.PartnerNames].some((value) =>
          value.toLowerCase().includes(query),
        ),
      )
      .map((program) => program.MonitoringProgramID),
  );
}

/**
 * What the map panel says for a program or category with no points on this map. The map
 * draws the site records Lake Tahoe Info keeps; a program without any may still map areas,
 * stations, or a service layer on its own page, so the line speaks for this map only and no
 * longer says the program has no mapped sites.
 */
export const NO_SITES_HERE = 'No sites on this map.';

/**
 * The partner a search matched a program by, when its own name did not match: the first
 * partner name containing the text. Null when the name matched, or nothing was searched.
 */
export function matchedPartner(program: MonitoringProgramSummary, text: string): string | null {
  const query = text.trim().toLowerCase();
  if (!query || program.MonitoringProgramName.toLowerCase().includes(query)) return null;
  return program.PartnerNames.find((name) => name.toLowerCase().includes(query)) ?? null;
}

function siteSum(programs: readonly MonitoringProgramSummary[]): number {
  return programs.reduce((sum, program) => sum + program.SiteCount, 0);
}

/**
 * Which sites are in color, in this order of precedence:
 *   1. a hovered program, unless a different category is selected (its own programs still show)
 *   2. the selected category, else the last hovered category
 *   3. the search matches
 *   4. every site
 */
export function mapFocus(state: FocusState, groups: readonly CategoryGroup[]): MapFocus {
  const byFolder = new Map(groups.map((group) => [group.category.Folder, group]));
  const selected = state.selected ? byFolder.get(state.selected) : undefined;
  const program = state.hoverProgram;
  const programGroup = program
    ? groups.find((group) => group.category.CategoryID === program.CategoryID)
    : undefined;

  if (program && programGroup && (!selected || selected === programGroup)) {
    return {
      programIds: new Set([program.MonitoringProgramID]),
      title: program.MonitoringProgramName,
      sub: program.SiteCount
        ? `${formatCount(program.SiteCount)} mapped ${plural(program.SiteCount, 'site')}`
        : NO_SITES_HERE,
      color: programGroup.color,
    };
  }

  const group = selected ?? (state.hoverCategory ? byFolder.get(state.hoverCategory) : undefined);
  if (group) {
    const sites = siteSum(group.programs);
    const withSites = group.programs.filter((item) => item.SiteCount > 0).length;
    const count = group.programs.length;
    return {
      programIds: new Set(group.programs.map((item) => item.MonitoringProgramID)),
      title: group.category.CategoryName,
      sub: !count
        ? 'No monitoring programs in this category yet.'
        : sites
          ? `${formatCount(sites)} mapped ${plural(sites, 'site')} from ${withSites} of ${count} ${plural(count, 'program')}`
          : NO_SITES_HERE,
      color: group.color,
    };
  }

  if (state.matches) {
    const matched = groups.flatMap((item) =>
      item.programs.filter((entry) => state.matches!.has(entry.MonitoringProgramID)),
    );
    const sites = siteSum(matched);
    return {
      programIds: state.matches,
      title: 'Search results',
      sub: `${formatCount(sites)} mapped ${plural(sites, 'site')} in ${matched.length} matching ${plural(matched.length, 'program')}`,
      color: null,
    };
  }

  return {
    programIds: null,
    title: 'All monitoring sites',
    sub: `${formatCount(siteSum(groups.flatMap((group) => group.programs)))} mapped sites`,
    color: null,
  };
}
