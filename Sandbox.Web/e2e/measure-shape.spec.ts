// Shaping rows in the browser, for tables the server cannot shape: a month written as text, a
// chart by year or by month of the year from one date column, rows added up, counts turned into
// shares, and a category made of two fields. These run in Node against the pure measure code,
// on rows made here, so they do not depend on what a service holds today.
import { expect, test } from '@playwright/test';

import { formatValue } from '../src/app/lib/chart/format';
import { normalizeDate } from '../src/app/lib/map-service';
import type { Measure } from '../src/app/lib/measures';
import { SHARE_FIELD, measureColumns, measureSourceFields, measureYs, shapeRows, xDisplay } from '../src/app/lib/measures';

test.describe('A month written as text', () => {
  test('reads as the first of that month, with a two-digit year in this century', () => {
    expect(normalizeDate('Jul-17')).toBe('2017-07-01');
    expect(normalizeDate('Dec-23')).toBe('2023-12-01');
    expect(normalizeDate('July 2017')).toBe('2017-07-01');
    expect(normalizeDate('Sept. 2021')).toBe('2021-09-01');
  });

  test('reads the year first too, as a Year field joined to a Month field comes out', () => {
    expect(normalizeDate('2019 Jan')).toBe('2019-01-01');
    expect(normalizeDate('2025-Aug')).toBe('2025-08-01');
    expect(normalizeDate('2019 Winter')).toBe('2019 Winter');
    // A table with a Year column and a Month column: the two make the date axis.
    const monthly: Measure = { title: 'People', x: 'Year', xWith: 'Month', xType: 'date', dateStep: 'month', y: 'People' };
    const rows = shapeRows(monthly, [
      { Year: 2019, Month: 'Jan', People: 10 },
      { Year: 2019, Month: 'Feb', People: 12 },
    ]);
    expect(rows.map((r) => r['Year'])).toEqual(['2019-01-01', '2019-02-01']);
    expect(measureSourceFields(monthly)).toEqual(['Year', 'Month', 'People']);
  });

  test('leaves the dates it already read, and text that is not a month, as they were', () => {
    expect(normalizeDate('3/9/2021')).toBe('2021-03-09');
    expect(normalizeDate('2021-03-09T00:00:00')).toBe('2021-03-09');
    expect(normalizeDate(Date.UTC(2021, 2, 9))).toBe('2021-03-09');
    expect(normalizeDate('Q3-23')).toBe('Q3-23');
    expect(normalizeDate('Summer 2018')).toBe('Summer 2018');
  });

  test('a monthly date axis names the month, not its first day', () => {
    const monthly: Measure = { title: 'Rides', x: 'MONTH', xType: 'date', dateStep: 'month', y: 'Total' };
    expect(xDisplay(monthly, '2017-07-01')).toBe('July 2017');
    expect(xDisplay({ ...monthly, dateStep: undefined }, '2017-07-01')).toBe('2017-07-01');
  });
});

/** A table with one row a month and one column a service, like the transit ridership table. */
const RIDES = [
  { MONTH: 'Nov-18', Bus: 100, Shuttle: null, Total: 100 },
  { MONTH: 'Dec-18', Bus: 300, Shuttle: null, Total: 300 },
  { MONTH: 'Jan-19', Bus: 200, Shuttle: 50, Total: 250 },
  { MONTH: 'Feb-19', Bus: 100, Shuttle: 70, Total: 170 },
];

test.describe('The year and month read out of a date column', () => {
  const byMonth: Measure = { title: 'By month of the year', dateParts: 'MONTH', x: 'MONTH_month', xType: 'month', y: 'Total', seriesBy: 'MONTH_year' };

  test('each row gains a year and a month, and the year can be the series', () => {
    const rows = shapeRows(byMonth, RIDES);
    expect(rows.map((r) => [r['MONTH_year'], r['MONTH_month'], r['Total']])).toEqual([
      ['2018', 11, 100],
      ['2018', 12, 300],
      ['2019', 1, 250],
      ['2019', 2, 170],
    ]);
  });

  test('the server is asked for the date column, never for the parts made from it', () => {
    expect(measureSourceFields(byMonth)).toEqual(['MONTH', 'Total']);
    // An ordinary measure still asks for exactly the fields its settings name.
    expect(measureSourceFields({ title: 'Plain', x: 'Year', y: 'Value', seriesBy: 'Season', pick: 'Name' })).toEqual(['Year', 'Value', 'Season', 'Name']);
  });
});

test.describe('Rows added up in the browser', () => {
  const byYear: Measure = {
    title: 'By year',
    dateParts: 'MONTH',
    x: 'MONTH_year',
    y: [
      { field: 'Bus', name: 'Bus' },
      { field: 'Shuttle', name: 'Shuttle' },
    ],
    combine: 'sum',
    type: 'stacked',
  };

  test('one row a year, each service summed, and a service with no number left empty', () => {
    const rows = shapeRows(byYear, RIDES);
    expect(rows.map((r) => [r['MONTH_year'], r['Bus'], r['Shuttle']])).toEqual([
      [2018, 400, null],
      [2019, 300, 120],
    ]);
  });

  test('without combine the rows stay one a month', () => {
    expect(shapeRows({ ...byYear, combine: undefined }, RIDES)).toHaveLength(RIDES.length);
  });
});

/** A table of counts by year, season, day, and way of traveling, like the mode share table. */
const TRIPS = [
  { Year: 2021, Season: 'Spring', Day: 'Thursday', Mode: 'Car', Number: 900 },
  { Year: 2021, Season: 'Spring', Day: 'Thursday', Mode: 'Walk', Number: 100 },
  { Year: 2021, Season: 'Fall', Day: 'Thursday', Mode: 'Car', Number: 150 },
  { Year: 2021, Season: 'Fall', Day: 'Thursday', Mode: 'Walk', Number: 50 },
  { Year: 2021, Season: 'Fall', Day: 'Saturday', Mode: 'Car', Number: 30 },
  { Year: 2021, Season: 'Fall', Day: 'Saturday', Mode: 'Walk', Number: 10 },
];

test.describe('Counts charted as shares, on a category made of two fields', () => {
  const shares: Measure = {
    title: 'Mode share',
    x: 'Year',
    xWith: 'Season',
    xType: 'category',
    y: 'Number',
    yName: 'Trips',
    yLabel: 'Share of trips',
    seriesBy: 'Mode',
    seriesLabel: 'Travel',
    pick: 'Day',
    pickLabel: 'Day',
    share: true,
    format: '.1%',
    type: 'stacked',
  };

  test('the second field joins x, so two seasons of one year are two categories', () => {
    const rows = shapeRows(shares, TRIPS);
    expect([...new Set(rows.map((r) => r['Year']))]).toEqual(['2021 Spring', '2021 Fall']);
    expect(measureSourceFields(shares)).toEqual(['Year', 'Season', 'Number', 'Mode', 'Day']);
  });

  test('each count becomes its share of the total at its category and pick', () => {
    const rows = shapeRows(shares, TRIPS);
    expect(rows.map((r) => [r['Year'], r['Day'], r['Mode'], r[SHARE_FIELD]])).toEqual([
      ['2021 Spring', 'Thursday', 'Car', 0.9],
      ['2021 Spring', 'Thursday', 'Walk', 0.1],
      ['2021 Fall', 'Thursday', 'Car', 0.75],
      ['2021 Fall', 'Thursday', 'Walk', 0.25],
      // Saturday is a total of its own, not part of Thursday's.
      ['2021 Fall', 'Saturday', 'Car', 0.75],
      ['2021 Fall', 'Saturday', 'Walk', 0.25],
    ]);
  });

  test('the chart reads the share; the table keeps the count beside it as a plain number', () => {
    expect(measureYs(shares)).toEqual([{ field: SHARE_FIELD, name: 'Share of trips' }]);
    expect(measureColumns(shares)).toEqual([
      { field: 'Year', headerName: 'Year' },
      { field: 'Mode', headerName: 'Travel' },
      { field: 'Day', headerName: 'Day' },
      { field: SHARE_FIELD, headerName: 'Share of trips', num: true },
      { field: 'Number', headerName: 'Trips', num: true, format: '' },
    ]);
  });

  test('a category with no trips at all has no share, not a share of zero', () => {
    const rows = shapeRows(shares, [{ Year: 2022, Season: 'Fall', Day: 'Thursday', Mode: 'Car', Number: 0 }]);
    expect(rows[0][SHARE_FIELD]).toBeNull();
  });

  test('a share under one percent can keep a decimal', () => {
    expect(formatValue(0.0031, '.1%')).toBe('0.3%');
    expect(formatValue(0.0031, '.0%')).toBe('0%');
    expect(formatValue(0.861, '.1%')).toBe('86.1%');
  });
});

/** A layer kept by hand: one agency spelled three ways, and a year typed as text. */
const SEGMENTS = [
  { Agency: 'PLACER COUNTY', Built: '2013', Kind: 'Path', Miles: 2 },
  { Agency: 'Placer County', Built: ' 2013', Kind: 'Path', Miles: 3 },
  { Agency: 'Placer county', Built: '2012?', Kind: 'Lane', Miles: 1 },
  { Agency: 'TCPUD', Built: '2012', Kind: 'Lane', Miles: 4 },
];

test.describe('Spelling variants read as one value', () => {
  const byAgency: Measure = {
    title: 'Miles by agency',
    x: 'Agency',
    xType: 'category',
    y: 'Miles',
    merge: { Agency: { 'PLACER COUNTY': 'Placer County', 'Placer county': 'Placer County', TCPUD: 'Tahoe City Public Utility District' } },
    combine: 'sum',
  };

  test('the variants of a name become one category, and combine adds them up', () => {
    const rows = shapeRows(byAgency, SEGMENTS);
    expect(rows.map((r) => [r['Agency'], r['Miles']])).toEqual([
      ['Placer County', 6],
      ['Tahoe City Public Utility District', 4],
    ]);
  });

  test('a value the map does not list is left as the source holds it', () => {
    const rows = shapeRows({ ...byAgency, merge: { Agency: { TCPUD: 'Tahoe City Public Utility District' } }, combine: undefined }, SEGMENTS);
    expect(rows.map((r) => r['Agency'])).toEqual(['PLACER COUNTY', 'Placer County', 'Placer county', 'Tahoe City Public Utility District']);
  });

  test('it applies to any field: a year typed with a space or a question mark, and the series', () => {
    const byYear: Measure = {
      title: 'Miles built each year',
      x: 'Built',
      y: 'Miles',
      seriesBy: 'Kind',
      merge: { Built: { ' 2013': '2013', '2012?': '2012' }, Kind: { Lane: 'Bike lane' } },
      combine: 'sum',
      type: 'stacked',
    };
    const rows = shapeRows(byYear, SEGMENTS);
    expect(rows.map((r) => [r['Built'], r['Kind'], r['Miles']])).toEqual([
      ['2013', 'Path', 5],
      ['2012', 'Bike lane', 5],
    ]);
    // The source is still asked for the fields by their own names.
    expect(measureSourceFields(byYear)).toEqual(['Built', 'Miles', 'Kind']);
  });
});
