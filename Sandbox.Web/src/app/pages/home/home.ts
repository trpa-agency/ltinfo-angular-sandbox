import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, map } from 'rxjs';

import { LoadState, failed, ready } from '../../api/load-state';
import { Category, MonitoringProgramSummary, Summary } from '../../api/models';
import { SandboxApiService } from '../../api/sandbox-api.service';
import { EsaButton } from '../../ecology/esa-button';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import { ProgramList } from '../program-list/program-list';
import { AboutMonitoring } from './about-monitoring';
import { CategoryCard } from './category-card';
import { HomeMap } from './home-map';
import {
  CategoryGroup,
  formatCount,
  groupPrograms,
  mapFocus,
  matchPrograms,
} from './home-model';
import { HOME_SECTIONS, HomeSectionId, HomeSections, isHomeSection } from './home-sections';
import { HomeSearch } from './home-search';

interface HomeData {
  summary: Summary;
  categories: Category[];
  programs: MonitoringProgramSummary[];
}

/** One category card as the page draws it, after the search. */
interface CardView {
  group: CategoryGroup;
  programs: MonitoringProgramSummary[];
  open: boolean;
  hidden: boolean;
}

/**
 * The home page at / and /category/:folder: one scrolling page with the hero and its four
 * totals, the threshold category cards beside the site map, the All Programs list, and
 * About Monitoring. The nav row in the shell scrolls to the three sections and follows
 * the one in view (HomeSections).
 *
 * Map behavior: hovering or focusing a category or a program colors just its sites, and the
 * last one stays until something else is hovered. A selected (open) category holds the map
 * whatever is hovered, except that its own programs show while hovered. A click on blank
 * space closes the category and restores every color. The map view never moves for this.
 */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AboutMonitoring,
    CategoryCard,
    EsaButton,
    EsaCard,
    EsaEmptyState,
    HomeMap,
    HomeSearch,
    ProgramList,
  ],
  host: { '(document:click)': 'onDocumentClick($event)' },
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly api = inject(SandboxApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly sections = inject(HomeSections);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<LoadState<HomeData>>({ status: 'loading' });

  protected readonly search = signal('');
  private readonly hoverCategory = signal<string | null>(null);
  private readonly hoverProgram = signal<MonitoringProgramSummary | null>(null);

  /** The category folder in the address (/category/:folder), if it names a real category. */
  private readonly folder = toSignal(this.route.paramMap.pipe(map((params) => params.get('folder'))), {
    initialValue: null,
  });

  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');
  private readonly end = viewChild<ElementRef<HTMLElement>>('end');
  private readonly list = viewChild(ProgramList);

  private readonly data = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });

  protected readonly groups = computed(() => {
    const data = this.data();
    return data ? groupPrograms(data.categories, data.programs) : [];
  });

  /** Categories with at least one mapped site, for the map legend. */
  protected readonly mappedGroups = computed(() => this.groups().filter((group) => group.category.SiteCount > 0));

  protected readonly selected = computed(() => {
    const folder = this.folder();
    return this.groups().some((group) => group.category.Folder === folder) ? folder : null;
  });

  private readonly matches = computed(() => matchPrograms(this.data()?.programs ?? [], this.search()));

  protected readonly cards = computed<CardView[]>(() => {
    const matches = this.matches();
    const selected = this.selected();
    return this.groups().map((group) => {
      if (!matches) {
        return { group, programs: group.programs, open: group.category.Folder === selected, hidden: false };
      }
      // A search opens every card with a match, listing only the matches, and hides the rest.
      const programs = group.programs.filter((program) => matches.has(program.MonitoringProgramID));
      return { group, programs, open: programs.length > 0, hidden: programs.length === 0 };
    });
  });

  protected readonly noMatches = computed(() => this.matches()?.size === 0);

  protected readonly focus = computed(() =>
    mapFocus(
      {
        selected: this.selected(),
        hoverCategory: this.hoverCategory(),
        hoverProgram: this.hoverProgram(),
        matches: this.matches(),
      },
      this.groups(),
    ),
  );

  /** The card whose sites are on the map; it lifts. */
  protected readonly hotFolder = computed(() => {
    const selected = this.selected();
    if (selected) return selected;
    const program = this.hoverProgram();
    if (program) return this.groups().find((group) => group.category.CategoryID === program.CategoryID)?.category.Folder ?? null;
    return this.hoverCategory();
  });

  protected readonly totals = computed(() => {
    const summary = this.data()?.summary;
    const value = (count: number | undefined): string | null => (summary ? formatCount(count ?? 0) : null);
    return [
      { label: 'monitoring programs', value: value(summary?.ProgramCount) },
      { label: 'threshold categories', value: value(summary?.CategoryCount) },
      { label: 'mapped monitoring sites', value: value(summary?.MappedSiteCount) },
      { label: 'partner organizations', value: value(summary?.PartnerCount) },
    ];
  });

  /** True while a card toggle is changing the address, so the page does not scroll for it. */
  private toggling = false;
  private rendered = false;
  private spy: IntersectionObserver[] = [];
  private gridObserver: ResizeObserver | null = null;

  constructor() {
    this.sections.active.set('categories');
    this.load();

    // Nav clicks while this page is up: scroll to the section and move focus to its heading.
    this.sections.requests
      .pipe(takeUntilDestroyed())
      .subscribe((id) => this.rendered && this.scrollToSection(id, { focus: true, smooth: true }));

    // A category opened from a link (About's "5 programs", or the address) scrolls into view.
    effect(() => {
      const folder = this.selected();
      untracked(() => {
        if (!this.rendered) return;
        if (this.toggling) {
          this.toggling = false;
          return;
        }
        if (folder) this.scrollToCard(folder, true);
      });
    });

    this.destroyRef.onDestroy(() => {
      this.spy.forEach((observer) => observer.disconnect());
      this.gridObserver?.disconnect();
      this.sections.active.set(null);
    });
  }

  protected load(): void {
    this.state.set({ status: 'loading' });
    forkJoin({
      summary: this.api.getSummary(),
      categories: this.api.getCategories(),
      programs: this.api.getPrograms(),
    }).subscribe({
      next: (data) => {
        this.state.set(ready(data));
        afterNextRender({ write: () => this.onFirstRender() }, { injector: this.injector });
      },
      error: (error: unknown) => this.state.set(failed(error)),
    });
  }

  // ---------- events from the cards, the legend, and the page ----------

  protected hover(folder: string, program: MonitoringProgramSummary | null): void {
    this.hoverCategory.set(folder);
    this.hoverProgram.set(program);
  }

  /** In a selected category, leaving one of its programs goes back to the whole category. */
  protected leaveProgram(): void {
    if (this.selected()) this.hoverProgram.set(null);
  }

  protected toggle(folder: string): void {
    this.select(this.selected() === folder ? null : folder);
  }

  protected selectFromLegend(folder: string): void {
    this.hover(folder, null);
    this.select(folder);
    this.scrollToCard(folder, false);
  }

  /** "Show these programs in the list": filter All Programs to the category and go there. */
  protected showInList(group: CategoryGroup): void {
    this.list()?.showCategory(group.category.CategoryID);
    this.scrollToSection('all-programs', { focus: true, smooth: true });
  }

  /** A click on blank space in the hero or the categories section closes the category. */
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (!target?.closest('.hero, #categories')) return;
    if (target.closest('app-category-card, .map-panel, app-home-search, esa-card, a, button, input')) return;
    this.hoverCategory.set(null);
    this.hoverProgram.set(null);
    if (this.selected()) this.select(null);
  }

  private select(folder: string | null): void {
    if (folder === this.selected()) return;
    this.toggling = true;
    // Same route config for / and /category/:folder, so the page (and its map) is reused.
    void this.router.navigate(folder ? ['/category', folder] : ['/'], { replaceUrl: true });
  }

  // ---------- scrolling, the scroll spy, and equal card heights ----------

  private onFirstRender(): void {
    if (this.rendered) return;
    this.rendered = true;
    this.watchGrid();
    this.startSpy();
    const fragment = this.route.snapshot.fragment;
    if (isHomeSection(fragment)) {
      this.scrollToSection(fragment, { focus: true, smooth: false });
    } else if (this.selected()) {
      this.scrollToCard(this.selected()!, true);
    }
  }

  private scrollToSection(id: HomeSectionId, { focus, smooth }: { focus: boolean; smooth: boolean }): void {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: this.behavior(smooth), block: 'start' });
    this.sections.active.set(id);
    if (focus) section.querySelector<HTMLElement>('[data-section-heading]')?.focus({ preventScroll: true });
  }

  private scrollToCard(folder: string, alignTop: boolean): void {
    const card = this.grid()?.nativeElement.querySelector<HTMLElement>(`[data-folder="${folder}"]`)?.closest('app-category-card');
    card?.scrollIntoView({ behavior: this.behavior(!alignTop), block: alignTop ? 'start' : 'nearest' });
  }

  private behavior(smooth: boolean): ScrollBehavior {
    return smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto';
  }

  /**
   * The section in view: the last one, in page order, that reaches the band from under the
   * sticky nav to 40 percent down the window. At the very end of the page, About.
   */
  private startSpy(): void {
    const ids = HOME_SECTIONS.map((section) => section.id);
    const nav = document.querySelector<HTMLElement>('.app-nav')?.offsetHeight ?? 0;
    const inBand = new Set<HomeSectionId>();
    let atEnd = false;
    const update = (): void => {
      const current = atEnd ? 'about' : [...ids].reverse().find((id) => inBand.has(id));
      if (current) this.sections.active.set(current);
    };
    const band = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id as HomeSectionId;
          if (entry.isIntersecting) inBand.add(id);
          else inBand.delete(id);
        }
        update();
      },
      { rootMargin: `-${nav + 1}px 0px -60% 0px` },
    );
    for (const id of ids) {
      const section = document.getElementById(id);
      if (section) band.observe(section);
    }
    const bottom = new IntersectionObserver(([entry]) => {
      atEnd = entry.isIntersecting;
      update();
    });
    const end = this.end()?.nativeElement;
    if (end) bottom.observe(end);
    this.spy = [band, bottom];
  }

  /**
   * While the cards sit two across, the two collapsed cards of a row are one height, so a
   * long name that wraps (Transportation and Sustainable Communities) does not leave its
   * neighbor short. Rows stay as tall as their own content. Measured again when the grid
   * changes width or the fonts land.
   */
  private watchGrid(): void {
    const grid = this.grid()?.nativeElement;
    if (!grid) return;
    let width = -1;
    const measure = (): void => {
      const heads = [...grid.querySelectorAll<HTMLElement>('.cat__head')];
      heads.forEach((head) => head.style.removeProperty('min-height'));
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      if (columns < 2) return;
      // Cards of one row share a top edge (the grid aligns them to the start).
      const rows = new Map<number, HTMLElement[]>();
      for (const head of heads) {
        const top = Math.round((head.closest('app-category-card') as HTMLElement | null)?.offsetTop ?? 0);
        rows.set(top, [...(rows.get(top) ?? []), head]);
      }
      for (const row of rows.values()) {
        const tallest = Math.max(0, ...row.map((head) => head.offsetHeight));
        if (tallest) row.forEach((head) => (head.style.minHeight = `${tallest}px`));
      }
    };
    let frame = 0;
    this.gridObserver = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next === width) return;
      width = next;
      // Measured in the next frame: changing the grid's height inside the observer's own
      // callback would raise "ResizeObserver loop completed with undelivered notifications".
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    this.gridObserver.observe(grid);
    void document.fonts.ready.then(() => {
      if (this.rendered) measure();
    });
  }
}
