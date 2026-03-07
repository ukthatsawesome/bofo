import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import Chart from 'chart.js/auto';
import { formatCurrency } from '@/utils/formatters';

interface SandboxChartProps {
  baseline: any[];
  scenario: any[];
}

export const SandboxChart = ({ baseline, scenario }: SandboxChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || scenario.length === 0) return;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const isDark = document.documentElement.classList.contains('dark');

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: scenario.map((d) =>
          new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        ),
        datasets: [
          {
            label: 'Without Plan',
            data: baseline.map((d) => d.balance),
            borderColor: '#94a3b8',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: 'With Plan',
            data: scenario.map((d) => d.balance),
            borderColor: '#7c3aed',
            backgroundColor: 'rgba(124, 58, 237, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              usePointStyle: true,
              boxWidth: 8,
              padding: 20,
              font: { size: 12, weight: 'bold' },
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += formatCurrency(context.parsed.y);
                }
                return label;
              },
            },
          },
        },
        scales: {
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: {
              callback: (value) => formatCurrency(value as number),
            },
          },
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
            },
          },
        },
      },
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [baseline, scenario]);

  return (
    <div className="w-full h-[400px] relative">
      <canvas ref={canvasRef} />
    </div>
  );
};
