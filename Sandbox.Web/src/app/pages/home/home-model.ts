// Pure logic for the home page: no DOM, no Angular. The page and its map read
// these to decide which programs are in color and what the map panel says.
import type { Category, MonitoringProgramSummary } from '../../api/models';

/**
 * THE ONE PLACE a category's color is decided on the home page. Card accents (through
 * --cat), the map legend, the map markers and popups, the map panel swatch, and the About
 * goal list all read it. Today it is the Threshold Dashboard theme color from the API; to
 * restyle, return something else here (a token expression such as var(--x) works for CSS,
 * and the map resolves token expressions before drawing).
 */
export function categoryColor(item: { ThemeColor: string }): string {
  return item.ThemeColor;
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
        : 'This program has no mapped sites.',
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
          : `No mapped sites. ${count === 1 ? 'This program is' : `These ${count} programs are`} not tied to fixed sites.`,
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
    sub: 'Hover over or focus a category to show its sites.',
    color: null,
  };
}
