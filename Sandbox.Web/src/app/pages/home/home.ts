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
import { groupByTopic } from '../../lib/home-page';
import { ProgramList } from '../program-list/program-list';
import { AboutMonitoring } from './about-monitoring';
import { CategoryCard } from './category-card';
import { HomeHeadlines } from './home-headlines';
import { HomeMap } from './home-map';
import { CategoryGroup, formatCount, groupPrograms, mapFocus, matchPrograms } from './home-model';
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
 * The home page at / and /category/:folder: one scrolling page with the hero (the search and
 * the three totals), the headline measures, the category cards grouped by topic, the site
 * map with its topic legend, the All Programs list, and About Monitoring. The nav row in the
 * shell scrolls to the four sections and follows the one in view (HomeSections).
 *
 * Map behavior: every site is drawn in its topic's color. An open category holds the map:
 * its sites keep their color and the rest turn gray. Without one, a search colors the
 * matching programs' sites, and without a search the topic legend decides: unchecking a
 * topic grays its sites. A click on blank space closes the category. The map view never
 * moves for any of this.
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
    HomeHeadlines,
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
  /** The topics unchecked in the map legend. */
  private readonly topicsOff = signal<ReadonlySet<string>>(new Set());

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

  /** Each category's site color on the map, by category ID. */
  protected readonly colors = computed(
    () => new Map(this.groups().map((group) => [group.category.CategoryID, group.color])),
  );

  protected readonly selected = computed(() => {
    const folder = this.folder();
    return this.groups().some((group) => group.category.Folder === folder) ? folder : null;
  });

  private readonly matches = computed(() => matchPrograms(this.data()?.programs ?? [], this.search()));

  private readonly cards = computed<CardView[]>(() => {
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

  /** The cards on the page, under their topics. A topic with no card to show is left out. */
  protected readonly topics = computed(() =>
    groupByTopic(
      this.cards().filter((card) => !card.hidden),
      (card) => card.group.category.Folder,
    ),
  );

  protected readonly noMatches = computed(() => this.matches()?.size === 0);

  /** The map legend: each topic with mapped sites, its count, and whether it is checked. */
  protected readonly legend = computed(() => {
    const off = this.topicsOff();
    return groupByTopic(this.groups(), (group) => group.category.Folder)
      .map(({ topic, items }) => ({
        topic,
        sites: items.reduce((sum, group) => sum + group.category.SiteCount, 0),
        on: !off.has(topic.id),
      }))
      .filter((entry) => entry.sites > 0)
      .map((entry) => ({ ...entry, count: formatCount(entry.sites) }));
  });

  /** An open category or a search holds the map, so the legend has nothing to change. */
  protected readonly legendLocked = computed(() => this.selected() !== null || this.matches() !== null);

  protected readonly focus = computed(() =>
    mapFocus({ selected: this.selected(), matches: this.matches(), topicsOff: this.topicsOff() }, this.groups()),
  );

  protected readonly totals = computed(() => {
    const summary = this.data()?.summary;
    const value = (count: number | undefined): string | null => (summary ? formatCount(count ?? 0) : null);
    return [
      { label: 'monitoring programs', value: value(summary?.ProgramCount) },
      { label: 'mapped monitoring sites', value: value(summary?.MappedSiteCount) },
      { label: 'partner organizations', value: value(summary?.PartnerCount) },
    ];
  });

  /** True while a card toggle is changing the address, so the page does not scroll for it. */
  private toggling = false;
  private rendered = false;
  private spy: IntersectionObserver[] = [];

  constructor() {
    this.sections.active.set(HOME_SECTIONS[0].id);
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
        if (folder) this.scrollToCard(folder);
      });
    });

    this.destroyRef.onDestroy(() => {
      this.spy.forEach((observer) => observer.disconnect());
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

  protected toggle(folder: string): void {
    this.select(this.selected() === folder ? null : folder);
  }

  /** A topic checked or unchecked in the map legend. */
  protected toggleTopic(id: string): void {
    this.topicsOff.update((off) => {
      const next = new Set(off);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** "Show all sites": closes the open category, which gives the map back to the legend. */
  protected clearSelection(): void {
    this.select(null);
  }

  /** "Show in the list": filter All Programs to the category and go there. */
  protected showInList(group: CategoryGroup): void {
    this.list()?.showCategory(group.category.CategoryID);
    this.scrollToSection('all-programs', { focus: true, smooth: true });
  }

  /** A click on blank space in the hero or the topics section closes the category. */
  protected onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (!target?.closest('.hero, #categories')) return;
    if (target.closest('app-category-card, app-home-search, esa-card, a, button, input')) return;
    if (this.selected()) this.select(null);
  }

  private select(folder: string | null): void {
    if (folder === this.selected()) return;
    this.toggling = true;
    // Same route config for / and /category/:folder, so the page (and its map) is reused.
    void this.router.navigate(folder ? ['/category', folder] : ['/'], { replaceUrl: true });
  }

  // ---------- scrolling and the scroll spy ----------

  private onFirstRender(): void {
    if (this.rendered) return;
    this.rendered = true;
    this.startSpy();
    const fragment = this.route.snapshot.fragment;
    if (isHomeSection(fragment)) {
      this.scrollToSection(fragment, { focus: true, smooth: false });
    } else if (this.selected()) {
      this.scrollToCard(this.selected()!);
    }
  }

  private scrollToSection(id: HomeSectionId, { focus, smooth }: { focus: boolean; smooth: boolean }): void {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: this.behavior(smooth), block: 'start' });
    if (smooth) this.landOn(section);
    this.sections.active.set(id);
    if (focus) section.querySelector<HTMLElement>('[data-section-heading]')?.focus({ preventScroll: true });
  }

  /**
   * A smooth scroll aims at where the section is when it starts. A headline tile or the map
   * arriving above it on the way moves the section, and the scroll stops short. So when the
   * scroll ends, go to the section itself, unless the reader has taken over the scrolling.
   */
  private landOn(section: HTMLElement): void {
    const taken = ['wheel', 'touchstart', 'keydown'] as const;
    const stop = (): void => {
      window.clearTimeout(timer);
      document.removeEventListener('scrollend', land);
      for (const type of taken) window.removeEventListener(type, stop);
    };
    const land = (): void => {
      stop();
      section.scrollIntoView({ behavior: 'auto', block: 'start' });
    };
    // scrollend does not fire when the page was already there, or in a browser without it.
    const timer = window.setTimeout(land, 1500);
    document.addEventListener('scrollend', land, { once: true });
    for (const type of taken) window.addEventListener(type, stop, { once: true, passive: true });
  }

  /** A category opened from a link or the address: its card at the top of the window. */
  private scrollToCard(folder: string): void {
    const card = this.grid()?.nativeElement.querySelector<HTMLElement>(`[data-folder="${folder}"]`)?.closest('app-category-card');
    card?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }

  private behavior(smooth: boolean): ScrollBehavior {
    return smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto';
  }

  /**
   * The section in view: the last one, in page order, that reaches the band from under the
   * sticky nav to 40 percent down the window. At the very end of the page, the last section.
   * Above the first section, where only the hero and the headline measures are in the band,
   * the first section: without that the item marked at the end of the page stayed marked
   * after a return to the top.
   */
  private startSpy(): void {
    const ids = HOME_SECTIONS.map((section) => section.id);
    const nav = document.querySelector<HTMLElement>('.app-nav')?.offsetHeight ?? 0;
    const inBand = new Set<HomeSectionId>();
    let atEnd = false;
    const update = (): void => {
      const current = atEnd ? ids[ids.length - 1] : ([...ids].reverse().find((id) => inBand.has(id)) ?? ids[0]);
      this.sections.active.set(current);
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
}
