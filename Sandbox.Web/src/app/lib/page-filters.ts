/*
 * page-filters.ts: the filters a program page shows once, above its map and charts, and how
 * a choice reaches every panel that reads the layer the filter is on.
 *
 * A filter names a field of one layer and lists its options. An option carries the values
 * the source holds for it, so one option can stand for the several spellings a hand-kept
 * layer collects ("PLACER COUNTY" and "Placer County"). Choosing an option adds a clause to
 * the where of the map layer and of each measure on the same layer; panels on another layer,
 * and measures read from a file, are left alone.
 *
 * Pure: no DOM and no fetch, so it is tested under Node.
 */

export interface PageFilterOption {
  /** What the reader sees and what the choice is stored as. */
  label: string;
  /** The values of the field this option stands for, as the source holds them. */
  values: string[];
  /** A color to mark the option with, where the map colors by the same field. */
  color?: string;
}

/** One entry of a program's filters in its settings. */
export interface PageFilter {
  field: string;
  label: string;
  /** The layer the field is on; the filter reaches the panels that read this layer. */
  layer: number | string;
  /** The map service the layer is in; the LTInfo_Monitoring service when omitted. */
  service?: string;
  options: PageFilterOption[];
  /** The label of the choice that filters nothing; "All" when omitted. */
  allLabel?: string;
  /** "buttons" for a few options the reader should see at once; a select otherwise. */
  style?: 'buttons' | 'select';
}

/** The chosen option label for each filter field. A field with no entry filters nothing. */
export type FilterState = Readonly<Record<string, string>>;

/** Anything that reads a service layer with an optional where clause. */
export interface Filterable {
  layer?: number | string;
  service?: string;
  where?: string;
}

const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/** The where clause for one filter's chosen option, or null when nothing is chosen. */
export function filterClause(filter: PageFilter, chosen: string | undefined): string | null {
  if (!chosen) return null;
  const option = filter.options.find((o) => o.label === chosen);
  if (!option || option.values.length === 0) return null;
  return option.values.length === 1
    ? `${filter.field} = ${quote(option.values[0])}`
    : `${filter.field} IN (${option.values.map(quote).join(', ')})`;
}

const sameLayer = (filter: PageFilter, target: Filterable): boolean =>
  target.layer != null && String(target.layer) === String(filter.layer) && (target.service ?? '') === (filter.service ?? '');

/**
 * The target with every chosen filter on its layer added to its where. The same object comes
 * back when no filter applies, so a panel that is not filtered does not load again.
 */
export function applyFilters<T extends Filterable>(target: T, filters: readonly PageFilter[], state: FilterState): T {
  const clauses = filters
    .filter((filter) => sameLayer(filter, target))
    .map((filter) => filterClause(filter, state[filter.field]))
    .filter((clause): clause is string => clause !== null);
  if (clauses.length === 0) return target;
  // The target's own where may hold an OR, so it is kept whole.
  const own = target.where && target.where.trim() !== '' && target.where.trim() !== '1=1' ? [`(${target.where})`] : [];
  return { ...target, where: [...own, ...clauses].join(' AND ') };
}

/** How many filters have an option chosen. */
export function activeFilterCount(filters: readonly PageFilter[], state: FilterState): number {
  return filters.filter((filter) => filterClause(filter, state[filter.field]) !== null).length;
}
