/**
 * Shared Chart.js configurations
 */

import { ChartConfiguration } from 'chart.js';

export const getBaseOptions = (title?: string): any => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#94a3b8',
        font: { family: 'Outfit', size: 12 },
        usePointStyle: true,
        padding: 20,
      },
    },
    tooltip: {
      backgroundColor: '#1e293b',
      titleFont: { family: 'Outfit', size: 14, weight: '600' },
      bodyFont: { family: 'Outfit', size: 13 },
      padding: 12,
      cornerRadius: 8,
      displayColors: false,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#64748b', font: { family: 'Outfit' } },
    },
    y: {
      grid: { color: 'rgba(148, 163, 184, 0.1)' },
      ticks: { color: '#64748b', font: { family: 'Outfit' } },
    },
  },
});

export const dashboardChartConfig: ChartConfiguration = {
  type: 'line',
  data: { datasets: [] }, // Default empty data
  options: {
    ...getBaseOptions('Spending Trend'),
    elements: {
      line: { tension: 0.4, borderWidth: 3, fill: true },
      point: { radius: 0, hoverRadius: 6 },
    },
  },
};

export const forecastChartConfig: ChartConfiguration = {
  type: 'line',
  data: { datasets: [] },
  options: {
    ...getBaseOptions('Wealth Projection'),
    scales: {
      x: { grid: { display: false } },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
      },
    },
  },
};

export const categoryChartConfig: ChartConfiguration = {
  type: 'doughnut',
  data: { datasets: [] },
  options: {
    ...getBaseOptions('Spending by Category'),
    cutout: '70%',
    plugins: {
      legend: { position: 'right' },
    },
  },
};
