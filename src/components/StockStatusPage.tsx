import React, { useMemo } from 'react';
import { Product } from '../types';
import BarChart from './BarChart';

interface StockStatusPageProps {
  products: Product[];
}

const StockStatusPage: React.FC<StockStatusPageProps> = ({ products }) => {

    const chartData = useMemo(() => {
        const sortedProducts = [...products].sort((a, b) => a.nom.localeCompare(b.nom));
        return {
            labels: sortedProducts.map(p => p.nom),
            // Stock information is no longer on the Product type, so this chart will show 0 values.
            values: sortedProducts.map(p => 0)
        };
    }, [products]);

  return (
    <div className="space-y-8">
        <div>
            <h1 className="text-2xl font-semibold text-gray-700">État du Stock par Produit</h1>
            <p className="text-sm text-gray-500">Visualisez la quantité en stock pour chaque produit.</p>
        </div>
        <div>
            <BarChart data={chartData} title="Nombre de caisses en stock" />
        </div>
    </div>
  );
};

export default StockStatusPage;