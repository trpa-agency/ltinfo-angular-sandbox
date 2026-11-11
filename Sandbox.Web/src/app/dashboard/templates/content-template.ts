import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { EsaCard } from '../../ecology/esa-card';
import { PhotoGallery } from '../photos/photo-gallery';
import {
  Band,
  MeasurementsBlock,
  PerYearBlock,
  ProgramPartners,
  ProgramStory,
  SitesBlock,
} from './blocks';
import { ProgramHeader } from './program-header';
import { TemplateBase } from './template-base';

/** The longest first paragraph, in characters, that is shown as the lead in the header. */
const LEAD_MAX_LENGTH = 320;

// The content layout, for programs with little or no data on the page. The
// stored word for it is "context".
//
//   1. the feature header: the name, the first paragraph of the description as
//      a lead, quiet tiles, and the key photo, large
//   2. About this program: the rest of the story at a reading width, with the
//      photo gallery beside it in large tiles, and the partners
//   3. Measurements and Sites, only when the program has them configured
//
// A data section with nothing configured is left out here, not shown empty:
// this layout is for programs that are not about the data on the page.
@Component({
  selector: 'app-content-template',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Band,
    EsaCard,
    MeasurementsBlock,
    PerYearBlock,
    PhotoGallery,
    ProgramHeader,
    ProgramPartners,
    ProgramStory,
    SitesBlock,
  ],
  host: { 'data-template': 'context' },
  templateUrl: './content-template.html',
  styleUrl: './content-template.scss',
})
export class ContentTemplate extends TemplateBase {
  /**
   * The first paragraph of the description, shown under the name in the header.
   * Only a short first paragraph makes a lead; a long one stays in the story.
   */
  protected readonly lead = computed(() => {
    const first = this.description()[0];
    return first && first.length <= LEAD_MAX_LENGTH ? first : null;
  });

  /** The description after the lead, for the story card. */
  protected readonly restOfDescription = computed(() =>
    this.lead() === null ? this.description() : this.description().slice(1),
  );

  /**
   * The story card is on the page when it has something to say, and also when
   * the program has no text at all, so the reader gets the empty state. It is
   * left out only when the lead in the header was the whole story.
   */
  protected readonly showStory = computed(
    () =>
      this.restOfDescription().length > 0 || this.approach().length > 0 || this.lead() === null,
  );

  protected readonly hasCharts = computed(
    () => this.data().measures.length > 0 || this.data().perYear !== null,
  );
}
