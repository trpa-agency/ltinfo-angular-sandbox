import { ChangeDetectionStrategy, Component } from '@angular/core';

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

// The charts layout, for programs with long data records.
//
//   1. the compact header
//   2. Measurements: the charts, in pairs and full rows from panelSpans
//   3. Sites: the map and site list at normal height, above the
//      sites-monitored-each-year chart
//   4. About this program: the story beside the partners
//   5. Photos
@Component({
  selector: 'app-charts-template',
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
  host: { 'data-template': 'charts' },
  templateUrl: './charts-template.html',
  styleUrl: './charts-template.scss',
})
export class ChartsTemplate extends TemplateBase {}
