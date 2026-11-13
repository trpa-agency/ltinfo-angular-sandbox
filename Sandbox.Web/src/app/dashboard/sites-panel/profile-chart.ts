import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { Result } from 'vega-embed';

import type { ChartSpec } from '../../lib/chart/types';
import type { VegaTheme } from '../../lib/vega-spec';
import { profileVegaSpec } from '../../lib/site-profile';
import { DEFAULT_VEGA_THEME, TOOLTIP_LABEL_FIELD, tooltipValueField } from '../../lib/vega-spec';

/** Plot height of the profile chart, in CSS pixels. */
const PLOT_HEIGHT = 110;

/** The site's line takes the first dataviz color; the median of all sites a quiet gray. The card's key uses the same two. */
export const SITE_TOKEN = '--color-background-dataviz-categorical-1';
export const MEDIAN_TOKEN = '--color-content-default-tertiary';

interface Readout {
  year: string;
  items: { name: string; value: string; color: string }[];
}

/** Resolves once the chart font can be measured, or after a short wait (as the chart panel does). */
const fontsWaited = new Map<string, Promise<void>>();
function fontReady(theme: VegaTheme): Promise<void> {
  const key = `${theme.fontSize}px ${theme.fontFamily}`;
  let wait = fontsWaited.get(key);
  if (!wait) {
    const loads = Promise.all([document.fonts.load(key), document.fonts.load(`500 ${key}`)]).then(
      () => undefined,
      () => undefined,
    );
    wait = Promise.race([loads, new Promise<void>((resolve) => setTimeout(resolve, 1500))]);
    fontsWaited.set(key, wait);
  }
  return wait;
}

/**
 * The record chart of the site profile: a ChartSpec from lib/site-profile drawn by
 * lib/vega-spec at the width of the card, with vega-embed loaded on first use. The hover
 * readout sits over the top of the plot. The chart is one image to assistive technology,
 * named by the parent; the parent also carries the values as a table.
 *
 * mon-lego-checked: no Ecology chart lego exists; the chart is the app's own Vega-Lite builder.
 */
@Component({
  selector: 'app-profile-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'profile-chart', '[attr.data-drawn]': 'drawn() ? "true" : null' },
  template: `
    <div #canvas class="profile-chart__canvas" aria-hidden="true"></div>
    @if (readout(); as r) {
      <p class="profile-chart__readout typography-body-xs" aria-hidden="true">
        <span class="profile-chart__readout-year">{{ r.year }}</span>
        @for (item of r.items; track item.name) {
          <span class="profile-chart__readout-item">
            <span class="profile-chart__swatch" [style.--profile-swatch]="item.color"></span>
            {{ item.name }} <span class="profile-chart__value">{{ item.value }}</span>
          </span>
        }
      </p>
    }
  `,
  styleUrl: './profile-chart.scss',
})
export class ProfileChart {
  readonly spec = input.required<ChartSpec>();

  protected readonly readout = signal<Readout | null>(null);
  protected readonly drawn = signal(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('canvas');
  private readonly width = signal(0);
  /** The spec by content, so an equal spec built again does not redraw. */
  private readonly specKey = computed(() => JSON.stringify(this.spec()));
  private embedded: Result | null = null;
  private drawId = 0;
  private destroyed = false;

  constructor() {
    effect((onCleanup) => {
      const el = this.canvas().nativeElement;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const observer = new ResizeObserver((entries) => {
        const w = Math.floor(entries[entries.length - 1].contentRect.width);
        clearTimeout(timer);
        if (!untracked(this.width)) this.width.set(w);
        else timer = setTimeout(() => this.width.set(w), 120);
      });
      observer.observe(el);
      onCleanup(() => {
        clearTimeout(timer);
        observer.disconnect();
      });
    });
    effect(() => {
      this.specKey();
      const width = this.width();
      if (width > 0) untracked(() => void this.draw(width));
    });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.drawId++;
      this.embedded?.finalize();
      this.embedded = null;
    });
  }

  private theme(): VegaTheme {
    const css = getComputedStyle(this.host);
    const token = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
    const d = DEFAULT_VEGA_THEME;
    return {
      seriesColors: [token(SITE_TOKEN, d.seriesColors[0]), token(MEDIAN_TOKEN, '#8d8d8d')],
      textColor: token('--color-content-default-secondary', d.textColor),
      titleColor: token('--color-content-default', d.titleColor),
      gridColor: token('--color-border-default-subtle', d.gridColor),
      axisColor: token('--color-border-default', d.axisColor),
      thresholdColor: token('--color-content-default-secondary', d.thresholdColor),
      gapColor: token('--color-background-elevation-sunken', d.gapColor),
      surfaceColor: token('--color-background-elevation-raised', d.surfaceColor),
      fontFamily: token('--typography-font-family-sans', d.fontFamily),
      fontSize: d.fontSize,
      titleFontSize: d.titleFontSize,
    };
  }

  private async draw(width: number): Promise<void> {
    const id = ++this.drawId;
    const spec = this.spec();
    try {
      const { default: embed } = await import('vega-embed');
      const theme = this.theme();
      await fontReady(theme);
      if (id !== this.drawId || this.destroyed) return;
      const vl = profileVegaSpec(spec, theme, width, PLOT_HEIGHT);
      this.readout.set(null);
      this.embedded?.finalize();
      this.embedded = null;
      const el = this.canvas().nativeElement;
      if (!el.isConnected) return;
      const result = await embed(el, vl, {
        renderer: 'svg',
        actions: false,
        defaultStyle: false,
        logLevel: 1,
        tooltip: (_handler: unknown, _event: MouseEvent, item: unknown, value: unknown) => this.showReadout(spec, theme, item, value),
      });
      if (id !== this.drawId || this.destroyed) {
        result.finalize();
        return;
      }
      this.embedded = result;
      this.drawn.set(true);
    } catch (error) {
      if (!this.destroyed) console.warn(`${spec.title}: the chart could not be drawn. ${String(error)}`);
    }
  }

  /** The hovered year and each series value, from the wide row behind the hover layer. */
  private showReadout(spec: ChartSpec, theme: VegaTheme, item: unknown, value: unknown): void {
    let row = (item as { datum?: unknown } | null)?.datum as Record<string, unknown> | undefined;
    while (row && !(TOOLTIP_LABEL_FIELD in row) && row['datum']) row = row['datum'] as Record<string, unknown>;
    if (value == null || !row || !(TOOLTIP_LABEL_FIELD in row)) {
      this.readout.set(null);
      return;
    }
    const items: Readout['items'] = [];
    spec.series.forEach((series, i) => {
      const shown = row[tooltipValueField(i)];
      if (shown == null || shown === '') return;
      items.push({ name: i === 0 ? series.name : 'Median', value: String(shown), color: theme.seriesColors[i] });
    });
    this.readout.set({ year: String(row[TOOLTIP_LABEL_FIELD]), items });
  }
}
