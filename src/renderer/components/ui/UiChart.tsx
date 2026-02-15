import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chart, registerables, ChartConfiguration } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

// Set default font family
Chart.defaults.font.family = "'Outfit', 'Inter', sans-serif";

interface UiChartProps {
    type: ChartConfiguration['type'];
    data: ChartConfiguration['data'];
    options?: ChartConfiguration['options'];
    height?: number | string;
    className?: string;
}

export const UiChart = ({ type, data, options, height = 300, className = '' }: UiChartProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);
    const [isDark, setIsDark] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Monitor Dark Mode changes
    useEffect(() => {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);

    // Initialize / Update Chart
    useEffect(() => {
        if (!canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Destroy previous instance
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        // Theme-aware defaults
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';
        const textColor = isDark ? '#94a3b8' : '#64748b'; // slate-400 vs slate-500

        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: textColor }
                },
                tooltip: {
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    titleColor: isDark ? '#f1f5f9' : '#0f172a',
                    bodyColor: isDark ? '#cbd5e1' : '#334155',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor, display: false },
                    ticks: { color: textColor }
                },
                y: {
                    grid: { color: gridColor, borderDash: [4, 4] } as any,
                    ticks: { color: textColor },
                    border: { display: false }
                }
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
        } as const;

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            plugins: { ...defaultOptions.plugins, ...options?.plugins },
            scales: { ...defaultOptions.scales, ...options?.scales }
        };

        const createGradient = (ctx: CanvasRenderingContext2D, colorHex: string) => {
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, colorHex + '40'); // 25% opacity
            gradient.addColorStop(1, colorHex + '00'); // 0% opacity
            return gradient;
        };

        // Apply gradients to line datasets if not present
        const enhancedData = {
            ...data,
            datasets: data.datasets.map(ds => {
                if (ds.type === 'line' && ds.fill && typeof ds.backgroundColor === 'string' && ds.backgroundColor.startsWith('rgba')) {
                    // Extract base color if possible, or just default. 
                    // For now, simpler approach: if borderColor is set, use it for gradient
                    if (ds.borderColor && typeof ds.borderColor === 'string') {
                        return {
                            ...ds,
                            backgroundColor: createGradient(ctx, ds.borderColor),
                        }
                    }
                }
                return ds;
            })
        };

        chartInstance.current = new Chart(ctx, {
            type,
            data: enhancedData,
            options: mergedOptions
        });

        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
            }
        };
    }, [data, options, type, isDark]);

    return (
        <div className={`w-full relative ${className}`} style={{ height: typeof height === 'number' ? `${height}px` : height }}>
            <canvas ref={canvasRef} />
        </div>
    );
};
