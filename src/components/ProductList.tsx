import React from 'react';
import { Product } from '../types';

interface ProductListProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
  isLoading: boolean;
  currencySymbol: string;
}

const ProductList: React.FC<ProductListProps> = ({ products, onEdit, onDelete, isLoading, currencySymbol }) => {
  if (isLoading) {
    return <div className="text-center py-10">Chargement des produits...</div>;
  }

  if (products.length === 0) {
    return <div className="text-center py-10 bg-white rounded-lg shadow-md">Aucun produit trouvé.</div>;
  }
  
  return (
    <div>
      {/* Desktop Table View */}
      <div className="hidden md:block bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code-barres</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{product.nom}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800">
                        {product.categorie}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{product.codeBarres}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center space-x-3">
                        <button onClick={() => onEdit(product)} className="text-indigo-600 hover:text-indigo-900 transition-colors">
                          Éditer
                        </button>
                        <button onClick={() => onDelete(product.id)} className="text-red-600 hover:text-red-900 transition-colors">
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
       {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {products.map((product) => {
          return (
            <div key={product.id} className="bg-white p-4 rounded-lg shadow-md">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-md font-bold text-gray-900">{product.nom}</h3>
                  <p className="text-sm text-gray-500 font-mono">{product.codeBarres}</p>
                </div>
                <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800">
                  {product.categorie}
                </span>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end space-x-4 text-sm font-medium">
                <button onClick={() => onEdit(product)} className="text-indigo-600 hover:text-indigo-900">Éditer</button>
                <button onClick={() => onDelete(product.id)} className="text-red-600 hover:text-red-900">Supprimer</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default ProductList;