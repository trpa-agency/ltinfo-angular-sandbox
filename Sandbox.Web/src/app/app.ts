import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { catchError, filter, map, merge, of, switchMap, timer } from 'rxjs';

import { LoadState, failed, ready } from './api/load-state';
import { HealthStatus } from './api/models';
import { SandboxApiService } from './api/sandbox-api.service';
import { EsaBadge } from './ecology/esa-badge';
import { HOME_SECTIONS, HomeSectionId, HomeSections } from './pages/home/home-sections';

/** The home page answers / and /category/:folder. */
const isHomePath = (path: string): boolean => path === '/' || /^\/category\/[^/]+$/.test(path);

// The shell: the navy LT Info bar, the sticky nav row, the routed page, and a footer line
// that asks the API for /health so anyone can see that Angular, the API, and SQL Server
// are connected.
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterOutlet, EsaBadge],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly api = inject(SandboxApiService);
  private readonly router = inject(Router);
  private readonly sections = inject(HomeSections);

  protected readonly health = signal<LoadState<HealthStatus>>({ status: 'loading' });
  protected readonly navItems = HOME_SECTIONS;

  /** The path of the page on screen, without the query or the fragment. */
  private readonly path = signal('/');
  protected readonly fullBleed = signal(false);

  private readonly onHome = computed(() => isHomePath(this.path()));
  /** Nav links keep the current home address, so a selected category stays selected. */
  protected readonly homePath = computed(() => (this.onHome() ? this.path() : '/'));
  /** The section in view on the home page; nothing is marked on other pages. */
  protected readonly active = computed(() => (this.onHome() ? this.sections.active() : null));

  private readonly nav = viewChild.required<ElementRef<HTMLElement>>('nav');

  constructor() {
    const navigations = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    );

    // Track the page, give the home page its full width, and start a new page at the top
    // (a fragment or a category change within the home page does its own scrolling).
    navigations.pipe(takeUntilDestroyed()).subscribe((event) => {
      const previous = this.path();
      const tree = this.router.parseUrl(event.urlAfterRedirects);
      const path = `/${tree.root.children['primary']?.segments.map((s) => s.path).join('/') ?? ''}`;
      this.path.set(path);
      this.fullBleed.set(this.deepest(this.router.routerState.snapshot.root).data['fullBleed'] === true);
      const samePage = previous === path || (isHomePath(previous) && isHomePath(path));
      if (!samePage && !tree.fragment) window.scrollTo(0, 0);
    });

    // Ask at start, on every route change, and every 30 seconds, so the line
    // recovers on its own after the API or the database comes back.
    merge(timer(0, 30_000), navigations)
      .pipe(
        switchMap(() =>
          this.api.getHealth().pipe(
            map((health) => ready(health)),
            catchError((error: unknown) => of(failed<HealthStatus>(error))),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.health.set(state));

    // The nav row's height, for every sticky offset and scroll margin on the page.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const nav = this.nav().nativeElement;
      const root = document.documentElement;
      const observer = new ResizeObserver(() =>
        root.style.setProperty('--app-nav-height', `${nav.offsetHeight}px`),
      );
      observer.observe(nav);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  /** A plain click on a nav item scrolls the home page; the router updates the address. */
  protected go(event: MouseEvent, id: HomeSectionId): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    this.sections.go(id);
  }

  private deepest(snapshot: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let node = snapshot;
    while (node.firstChild) node = node.firstChild;
    return node;
  }
}
