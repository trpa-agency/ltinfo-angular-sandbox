import { ChangeDetectionStrategy, Component } from '@angular/core';

import { EsaCard } from '../../ecology/esa-card';
import { PhotoGallery } from '../photos/photo-gallery';
import {
  Band,
  FilterBar,
  HeaderLinks,
  MeasurementsBlock,
  PerYearBlock,
  ProgramPartners,
  ProgramStory,
  SitesBlock,
} from './blocks';
import { ProgramHeader } from './program-header';
import { TemplateBase } from './template-base';

// The map layout, for programs with many mapped sites or areas.
//
//   1. the compact header
//   2. Sites: the map and site list, tall, the full width of the page
//   3. Measurements: the charts, then the sites-monitored-each-year chart
//   4. About this program: the story beside the partners
//   5. Photos
@Component({
  selector: 'app-map-template',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Band,
    FilterBar,
    HeaderLinks,
    EsaCard,
    MeasurementsBlock,
    PerYearBlock,
    PhotoGallery,
    ProgramHeader,
    ProgramPartners,
    ProgramStory,
    SitesBlock,
  ],
  host: { 'data-template': 'map' },
  templateUrl: './map-template.html',
  styleUrl: './map-template.scss',
})
export class MapTemplate extends TemplateBase {}
