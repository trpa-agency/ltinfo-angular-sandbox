import { TEMPLATES, Template } from '../../api/models';

/** What a reader sees for each stored Template value. The stored word for Content is "context". */
export const TEMPLATE_LABELS: Record<Template, string> = {
  map: 'Map',
  charts: 'Charts',
  context: 'Content',
};

/** The options an Ecology select or button toggle takes, in the stored order. */
export const TEMPLATE_OPTIONS: { label: string; value: Template }[] = TEMPLATES.map((value) => ({
  label: TEMPLATE_LABELS[value],
  value,
}));

/** A ?template= value, when it names one of the three layouts. Anything else is ignored. */
export function parseTemplate(value: string | null | undefined): Template | null {
  return TEMPLATES.includes(value as Template) ? (value as Template) : null;
}
