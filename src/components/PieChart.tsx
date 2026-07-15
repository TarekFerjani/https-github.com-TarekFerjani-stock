import React from 'react';

interface PieChartProps {
  title: string;
  data: { label: string; value: number; color: string }[];
  currencySymbol?: string;
}

const PieChart: React.FC<PieChartProps> = ({ title, data, currencySymbol = '' }) => {
  const totalValue = data.reduce((sum, item) => sum + item.value, 0);

  if (data.length === 0) {
    return (
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
        <h3 className="text-lg font-bold text-gray-800 mb-6">{title}</h3>
        <div className="flex items-center justify-center h-48 text-gray-400 font-medium">
            Aucune donnée à afficher
        </div>
       </div>
    );
  }

  let cumulativePercent = 0;

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full group">
      <h3 className="text-lg font-bold text-gray-800 mb-6">{title}</h3>
      <div className="flex flex-col md:flex-row items-center justify-between">
        <div className="w-48 h-48 relative transition-transform duration-300 group-hover:scale-105">
           <svg viewBox="-1 -1 2 2" className="drop-shadow-sm" style={{ transform: 'rotate(-90deg)' }}>
            {data.map(item => {
              const percent = totalValue > 0 ? item.value / totalValue : 0;
              const [startX, startY] = getCoordinatesForPercent(cumulativePercent);
              cumulativePercent += percent;
              const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
              const largeArcFlag = percent > 0.5 ? 1 : 0;
              const pathData = [
                `M ${startX} ${startY}`, // Move
                `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
                `L 0 0`, // Line to center
              ].join(' ');
              return <path key={item.label} d={pathData} fill={item.color} />;
            })}
            {/* Center Hole for Donut Style */}
            <circle cx="0" cy="0" r="0.6" fill="white" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
             <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total</span>
             <span className="text-xl font-bold text-gray-700">{currencySymbol ? totalValue.toLocaleString() : totalValue}</span>
          </div>
        </div>
        <div className="mt-6 md:mt-0 md:ml-6 space-y-4 flex-1">
          {data.map(item => (
            <div key={item.label} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <span className="inline-block w-3 h-3 rounded-full mr-3" style={{ backgroundColor: item.color }}></span>
                <span className="text-sm font-medium text-gray-600">{item.label}</span>
              </div>
              <div className="text-right">
                <span className="block text-sm font-bold text-gray-800">
                    {currencySymbol}{item.value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                    {(totalValue > 0 ? (item.value / totalValue) * 100 : 0).toFixed(1)}% du total
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PieChart;
