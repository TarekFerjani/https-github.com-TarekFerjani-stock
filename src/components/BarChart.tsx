import React from 'react';

interface BarChartProps {
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

const BarChart: React.FC<BarChartProps> = ({ title, data }) => {
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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6">{title}</h3>
                <div className="flex items-center justify-center h-64 text-gray-400">Aucune donnée à afficher</div>
            </div>
        );
    }
    
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
            <h3 className="text-lg font-bold text-gray-800 mb-6">{title}</h3>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
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
                    const totalBarSpace = chartWidth / data.labels.length;
                    const x = padding + (i + 0.5) * totalBarSpace;
                    return (
                        <text key={i} x={x} y={height - padding + 20} textAnchor="middle" fontSize="10" className="fill-gray-400 font-medium overflow-visible">
                            {label.length > 12 ? label.substring(0, 10) + '...' : label}
                        </text>
                    );
                })}

                {/* Data Bars */}
                {data.datasets.map((dataset, dsIndex) => {
                    const totalBarSpace = chartWidth / data.labels.length;
                    const barWidth = totalBarSpace * 0.5 / data.datasets.length;
                    
                    return data.labels.map((_, i) => {
                        const value = dataset.data[i] || 0;
                        const centerX = padding + (i + 0.5) * totalBarSpace;
                        const offsetX = (dsIndex - (data.datasets.length - 1) / 2) * barWidth;
                        const x = centerX + offsetX - barWidth / 2;
                        
                        const barHeight = (value / (maxValue || 1)) * chartHeight;
                        const y = padding + chartHeight - barHeight;
                        
                        return (
                           <rect 
                             key={`${dsIndex}-${i}`} 
                             x={x} 
                             y={y} 
                             width={barWidth} 
                             height={barHeight} 
                             fill={dataset.color} 
                             rx={barWidth / 4} 
                           >
                               <title>{`${dataset.label}: ${value}`}</title>
                           </rect>
                        );
                    });
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

export default BarChart;