import 'server-only';

import type { TopLevelSpec } from 'vega-lite';

// Brand colours from docs/09-agentic-architecture.md
const COLOURS = {
  primary: '#1D9E75',
  secondary: '#534AB7',
  accent: '#D85A30',
  neutral: '#888780',
  bg: '#FFFFFF',
  text: '#2C2C2A',
  grid: '#D3D1C7',
} as const;

const MULTI_COLOURS = [
  COLOURS.primary,
  COLOURS.secondary,
  COLOURS.accent,
  '#E8A838',
  '#3B82C4',
  COLOURS.neutral,
];

// ---------------------------------------------------------------------------
// Chart specs
// ---------------------------------------------------------------------------

export interface PriceTrendPoint {
  month: string;
  median_price: number;
  town?: string;
}

export function priceTrendSpec(
  data: PriceTrendPoint[],
  title: string,
): TopLevelSpec {
  const hasTowns = data.some((d) => d.town);

  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: 600,
    height: 350,
    title: { text: title, color: COLOURS.text, fontSize: 16 },
    data: { values: data },
    mark: { type: 'line', strokeWidth: 2.5, point: { size: 40 } },
    encoding: {
      x: {
        field: 'month',
        type: 'temporal',
        axis: { title: null, gridColor: COLOURS.grid, gridOpacity: 0.3 },
      },
      y: {
        field: 'median_price',
        type: 'quantitative',
        axis: { title: 'Median price (€)', format: '~s', gridColor: COLOURS.grid, gridOpacity: 0.3 },
      },
      ...(hasTowns
        ? {
            color: {
              field: 'town',
              type: 'nominal',
              scale: { range: MULTI_COLOURS },
              legend: { title: null },
            },
          }
        : { color: { value: COLOURS.primary } }),
    },
    config: {
      background: COLOURS.bg,
      font: 'system-ui, -apple-system, sans-serif',
      axis: { labelColor: COLOURS.text, titleColor: COLOURS.text },
    },
  };
}

export interface TownComparisonPoint {
  town: string;
  median_price: number;
}

export function townComparisonSpec(
  data: TownComparisonPoint[],
  title: string,
): TopLevelSpec {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: 500,
    height: Math.max(200, data.length * 45),
    title: { text: title, color: COLOURS.text, fontSize: 16 },
    data: { values: data },
    mark: { type: 'bar', cornerRadiusEnd: 4, color: COLOURS.primary },
    encoding: {
      y: {
        field: 'town',
        type: 'nominal',
        sort: '-x',
        axis: { title: null, labelColor: COLOURS.text },
      },
      x: {
        field: 'median_price',
        type: 'quantitative',
        axis: { title: 'Median price (€)', format: '~s', gridColor: COLOURS.grid, gridOpacity: 0.3 },
      },
    },
    config: {
      background: COLOURS.bg,
      font: 'system-ui, -apple-system, sans-serif',
      axis: { labelColor: COLOURS.text, titleColor: COLOURS.text },
    },
  };
}

export interface PropertyTypeMixPoint {
  property_type: string;
  count: number;
}

export function propertyTypeMixSpec(
  data: PropertyTypeMixPoint[],
  title: string,
): TopLevelSpec {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: 300,
    height: 300,
    title: { text: title, color: COLOURS.text, fontSize: 16 },
    data: { values: data },
    mark: { type: 'arc', innerRadius: 60 },
    encoding: {
      theta: { field: 'count', type: 'quantitative', stack: true },
      color: {
        field: 'property_type',
        type: 'nominal',
        scale: { range: MULTI_COLOURS },
        legend: { title: null },
      },
    },
    config: {
      background: COLOURS.bg,
      font: 'system-ui, -apple-system, sans-serif',
    },
  };
}

// ---------------------------------------------------------------------------
// Renderer — spec to SVG string (no canvas, no native deps)
// ---------------------------------------------------------------------------

export async function renderChartToSvg(spec: TopLevelSpec): Promise<string> {
  const vega = await import('vega');
  const vegaLite = await import('vega-lite');

  const vegaSpec = vegaLite.compile(spec).spec;
  const view = new vega.View(vega.parse(vegaSpec), { renderer: 'none' });
  return view.toSVG();
}
