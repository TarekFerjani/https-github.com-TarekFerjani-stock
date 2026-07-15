import React from 'react';

interface StatCardProps {
  title: string;
  value: string;
  icon: 'box' | 'cash' | 'warning' | 'x-circle' | 'users';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => {
  const iconSvg = {
    box: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
    users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
    cash: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />,
    warning: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
    'x-circle': <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  };

  const iconColor = {
      box: 'bg-blue-100 text-blue-600',
      users: 'bg-purple-100 text-purple-600',
      cash: 'bg-green-100 text-green-600',
      warning: 'bg-yellow-100 text-yellow-600',
      'x-circle': 'bg-red-100 text-red-600'
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4 hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer">
      <div className={`p-3.5 rounded-xl ${iconColor[icon]}`}>
        <svg className="h-7 w-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {iconSvg[icon]}
        </svg>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;