import React from 'react';

interface LineChartProps {
    title: string;
    data: {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
            color: string;
        }[];
    };
}

const LineChart: React.FC<LineChartProps> = ({ title, data }) => {
    const padding = 50;
    const width = 500;
    const height = 300;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const allDataPoints = data.datasets.flatMap(ds => ds.data);
    const maxValue = allDataPoints.length > 0 ? Math.max(...allDataPoints) : 0;
    const numYLabels = 5;

    if (data.labels.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">{title}</h3>
                <div className="flex items-center justify-center h-64 text-gray-500">Aucune donnée à afficher</div>
            </div>
        );
    }
    
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-6">{title}</h3>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
                <defs>
                    {data.datasets.map((dataset, i) => (
                        <linearGradient key={`grad-${i}`} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={dataset.color} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={dataset.color} stopOpacity="0" />
                        </linearGradient>
                    ))}
                </defs>

                {/* Y-Axis Grid */}
                {Array.from({ length: numYLabels + 1 }).map((_, i) => {
                    const y = padding + chartHeight - (i / numYLabels) * chartHeight;
                    const value = (i / numYLabels) * maxValue;
                    return (
                        <g key={i}>
                            <text x={padding - 15} y={y} textAnchor="end" alignmentBaseline="middle" fontSize="10" className="fill-gray-400 font-medium">
                                {Math.round(value)}
                            </text>
                            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                        </g>
                    );
                })}

                {/* X-Axis Labels */}
                {data.labels.map((label, i) => {
                    const x = padding + (i / (data.labels.length - 1 || 1)) * chartWidth;
                    return (
                        <text key={i} x={x} y={height - padding + 20} textAnchor="middle" fontSize="10" className="fill-gray-400 font-medium">
                            {label}
                        </text>
                    );
                })}

                {/* Data Datasets */}
                {data.datasets.map((dataset, dsIndex) => {
                    const points = dataset.data.map((value, i) => {
                        const x = padding + (i / (data.labels.length - 1 || 1)) * chartWidth;
                        const y = padding + chartHeight - (value / (maxValue || 1)) * chartHeight;
                        return { x, y };
                    });

                    // Build path string for smooth curve (Bezier)
                    let d = `M ${points[0].x} ${points[0].y}`;
                    for (let i = 0; i < points.length - 1; i++) {
                        const curr = points[i];
                        const next = points[i + 1];
                        const controlX = (curr.x + next.x) / 2;
                        d += ` C ${controlX} ${curr.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
                    }

                    // For area fill, we need a closed path
                    const fillPath = `${d} L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`;

                    return (
                        <g key={dataset.label}>
                            <path d={fillPath} fill={`url(#gradient-${dsIndex})`} />
                            <path d={d} fill="none" stroke={dataset.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            {points.map((p, i) => (
                                <circle key={i} cx={p.x} cy={p.y} r="4" fill="white" stroke={dataset.color} strokeWidth="2" />
                            ))}
                        </g>
                    );
                })}
            </svg>
            <div className="flex flex-wrap justify-center mt-6 gap-4">
                {data.datasets.map(ds => (
                    <div key={ds.label} className="flex items-center">
                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: ds.color }}></span>
                        <span className="text-xs font-medium text-gray-500">{ds.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LineChart;
