import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import Chart, { TooltipItem } from 'chart.js/auto';
import { formatCurrency } from '@/utils/formatters';

interface ForecastChartProps {
    data: {
        date: string;
        balance: number;
        isFuture?: boolean;
    }[];
}

export const ForecastChart = ({ data }: ForecastChartProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    useEffect(() => {
        if (!canvasRef.current || data.length === 0) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Destroy previous instance
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        // 1. Create Premium Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 450);
        gradient.addColorStop(0, 'rgba(124, 58, 237, 0.4)'); // Brand Primary (Purple)
        gradient.addColorStop(0.5, 'rgba(124, 58, 237, 0.1)');
        gradient.addColorStop(1, 'rgba(124, 58, 237, 0.0)');

        // 2. Prepare Data
        // Sort by date just in case, ensuring correct rendering order
        const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const labels = sortedData.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
        const values = sortedData.map(d => d.balance);

        const isDark = document.documentElement.classList.contains('dark');
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDark ? '#94a3b8' : '#64748b';

        // 3. Init Chart
        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Projected Net Worth',
                        data: values,
                        borderColor: '#7c3aed', // brand-primary
                        backgroundColor: gradient,
                        borderWidth: 3,
                        tension: 0.4, // Smooth "organic" curve
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#7c3aed',
                        pointBorderWidth: 2,
                        pointHoverBorderWidth: 3,
                        pointHoverBackgroundColor: '#7c3aed', // Invert on hover
                        pointHoverBorderColor: '#ffffff'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? '#1e293b' : '#ffffff',
                        titleColor: isDark ? '#f8fafc' : '#0f172a',
                        bodyColor: isDark ? '#cbd5e1' : '#475569',
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 12,
                        displayColors: false,
                        titleFont: { family: "'Outfit', sans-serif", size: 14, weight: 'bold' },
                        bodyFont: { family: "'Inter', sans-serif", size: 13 },
                        callbacks: {
                            label: (context: TooltipItem<'line'>) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += formatCurrency(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false, // Allow negative values to show naturally
                        grid: {
                            color: (context) => {
                                if (context.tick.value === 0) return isDark ? '#cbd5e1' : '#475569'; // Highlight zero line
                                return gridColor;
                            },
                        },
                        ticks: {
                            color: textColor,
                            font: { family: "'Inter', sans-serif", size: 11 },
                            callback: (value) => formatCurrency(value as number, undefined, true) // Compact notation
                        },
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: textColor,
                            font: { family: "'Inter', sans-serif", size: 11 },
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 8
                        },
                        border: { display: false }
                    }
                }
            }
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [data]);

    return (
        <div className="w-full h-[350px] relative">
            <canvas ref={canvasRef} />
        </div>
    );
};
