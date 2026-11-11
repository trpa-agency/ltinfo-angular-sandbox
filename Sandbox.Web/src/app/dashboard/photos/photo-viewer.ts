import { Injectable, computed, signal } from '@angular/core';

import type { ProgramImage } from '../../api/models';

/**
 * The photos of the program on screen, shared by the hero, the gallery, and the
 * larger view. The program page provides one of these; the three photo
 * components inject it, so a click on any photo opens the same dialog and a
 * photo that fails to load is treated the same way everywhere.
 */
@Injectable()
export class PhotoViewer {
  private readonly all = signal<readonly ProgramImage[]>([]);
  private readonly failedIds = signal<ReadonlySet<number>>(new Set());
  private readonly openId = signal<number | null>(null);

  /** The program name, for alt text when a photo has no caption. */
  readonly programName = signal('');

  /** Photos that have not failed to load, key photo first. These are the ones the larger view pages through. */
  readonly photos = computed(() => this.all().filter((photo) => !this.failedIds().has(photo.MonitoringProgramImageID)));

  /** The photo in the larger view, or null when the dialog is closed. */
  readonly current = computed(() => {
    const id = this.openId();
    return id === null ? null : (this.photos().find((photo) => photo.MonitoringProgramImageID === id) ?? null);
  });

  /** Where the open photo sits among the viewable ones, counted from 1. Zero when closed. */
  readonly position = computed(() => {
    const current = this.current();
    return current ? this.photos().indexOf(current) + 1 : 0;
  });

  /** Called by the page when a program loads. */
  setProgram(name: string, images: readonly ProgramImage[]): void {
    this.programName.set(name);
    this.all.set(images);
    this.failedIds.set(new Set());
    this.openId.set(null);
  }

  hasFailed(photo: ProgramImage): boolean {
    return this.failedIds().has(photo.MonitoringProgramImageID);
  }

  /** The file did not load. The photo leaves the larger view and its tile shows the fallback. */
  markFailed(photo: ProgramImage): void {
    this.failedIds.update((ids) => new Set([...ids, photo.MonitoringProgramImageID]));
    if (this.openId() === photo.MonitoringProgramImageID) this.openId.set(null);
  }

  open(photo: ProgramImage): void {
    if (!this.hasFailed(photo)) this.openId.set(photo.MonitoringProgramImageID);
  }

  close(): void {
    this.openId.set(null);
  }

  /** Moves to the next (1) or previous (-1) photo, wrapping at either end. */
  step(direction: 1 | -1): void {
    const photos = this.photos();
    const current = this.current();
    if (!current || photos.length < 2) return;
    const next = (photos.indexOf(current) + direction + photos.length) % photos.length;
    this.openId.set(photos[next].MonitoringProgramImageID);
  }

  /** Alt text: the caption when there is one, else what the photo is of. */
  altText(photo: ProgramImage): string {
    const caption = photo.Caption?.trim();
    if (caption) return caption;
    const name = this.programName();
    return name ? `Photo from the ${name} monitoring program` : 'Program photo';
  }
}

/** A photo credit that is a web address reads better as a link to its site. */
export function creditLink(credit: string | null | undefined): { href: string; host: string } | null {
  const text = credit?.trim() ?? '';
  if (!/^https?:\/\//i.test(text)) return null;
  try {
    const url = new URL(text);
    return { href: url.href, host: url.hostname.replace(/^www\./, '') };
  } catch {
    return null;
  }
}
