import { ChartConfiguration, ChartOptions, ChartType } from 'chart.js';

// ==================== UTILS ====================

/**
 * Helper to retrieve CSS variable values.
 * Expects variables to be in "r g b" format (e.g., "99 102 241") for usage with alpha.
 */
function getCssColor(variable: string, alpha = 1): string {
  if (typeof window === 'undefined') return 'rgba(0, 0, 0, 0)';
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return `rgba(${value} / ${alpha})`;
}

/**
 * Deep merges two objects.
 * Uses 'any' for the source to allow merging partial config overrides 
 * that might technically mismatch strict Chart.js types during the merge process,
 * but validates the return via generic T.
 */
function deepMerge<T>(target: T, source: any): T {
  const isObject = (obj: any) => obj && typeof obj === 'object';

  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  const output: any = { ...target };

  Object.keys(source).forEach((key) => {
    const targetValue = output[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      output[key] = [...targetValue, ...sourceValue];
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      output[key] = deepMerge(targetValue, sourceValue);
    } else {
      output[key] = sourceValue;
    }
  });

  return output as T;
}

// ==================== THEME ====================

const getChartTheme = () => ({
  colors: {
    text: getCssColor('--text-secondary'),
    axis: getCssColor('--text-secondary'),
    grid: getCssColor('--border', 0.1),
    tooltipBg: getCssColor('--bg-panel'),
    tooltipTitle: getCssColor('--text-primary'),
  },
  fonts: {
    family: "'Outfit', sans-serif",
    size: 12,
  },
});

// ==================== BASE OPTIONS ====================

const _getCommonPlugins = (theme: ReturnType<typeof getChartTheme>, title?: string) => ({
  title: title
    ? {
      display: true,
      text: title,
      color: theme.colors.text,
      font: {
        family: theme.fonts.family,
        size: 16,
        weight: 'bold' as const,
      },
      padding: { bottom: 20 },
    }
    : undefined,
  legend: {
    position: 'bottom' as const,
    labels: {
      color: theme.colors.text,
      font: { family: theme.fonts.family, size: theme.fonts.size },
      usePointStyle: true,
      padding: 20,
    },
  },
  tooltip: {
    backgroundColor: theme.colors.tooltipBg,
    titleColor: theme.colors.tooltipTitle,
    titleFont: { family: theme.fonts.family, size: 14, weight: 'bold' as const },
    bodyFont: { family: theme.fonts.family, size: 13 },
    padding: 12,
    cornerRadius: 8,
    displayColors: false,
  },
});

/**
 * Generates base options for Cartesian charts (Line, Bar) which use Axes.
 */
export const getBaseCartesianOptions = <TType extends ChartType = 'line'>(title?: string): ChartOptions<TType> => {
  const theme = getChartTheme();

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: _getCommonPlugins(theme, title),
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: theme.colors.axis, font: { family: theme.fonts.family } },
      },
      y: {
        grid: { color: theme.colors.grid },
        ticks: { color: theme.colors.axis, font: { family: theme.fonts.family } },
      },
    },
  } as ChartOptions<TType>;
};

/**
 * Generates base options for Polar charts (Doughnut, Pie) which DO NOT use Axes.
 */
export const getBasePolarOptions = <TType extends ChartType = 'doughnut'>(title?: string): ChartOptions<TType> => {
  const theme = getChartTheme();

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: _getCommonPlugins(theme, title),
  } as ChartOptions<TType>;
};

// ==================== DATA CONFIGS ====================

export type DashboardChartData = number | null;
export type ForecastChartData = number | null;
export type CategoryChartData = number;

// ==================== CHART CONFIGS ====================

export const getDashboardChartConfig = (): ChartConfiguration<'line', DashboardChartData, string> => ({
  type: 'line',
  data: { datasets: [] },
  options: deepMerge(getBaseCartesianOptions<'line'>('Spending Trend'), {
    elements: {
      line: { tension: 0.4, borderWidth: 3, fill: true },
      point: { radius: 0, hoverRadius: 6 },
    },
  }),
});

export const getForecastChartConfig = (): ChartConfiguration<'line', ForecastChartData, string> => ({
  type: 'line',
  data: { datasets: [] },
  options: deepMerge(getBaseCartesianOptions<'line'>('Wealth Projection'), {
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }),
});

export const getCategoryChartConfig = (): ChartConfiguration<'doughnut', CategoryChartData, string> => ({
  type: 'doughnut',
  data: { datasets: [] },
  options: deepMerge(getBasePolarOptions<'doughnut'>('Spending by Category'), {
    cutout: '70%',
    plugins: {
      legend: {
        position: 'right',
      },
    },
  }),
});