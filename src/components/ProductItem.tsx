import React from 'react';
import { Product } from '../types';

interface ProductItemProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;
}

const ProductItem: React.FC<ProductItemProps> = ({ product, onEdit, onDelete }) => {
  return (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">{product.nom}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{product.codeBarres}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800">
          {product.categorie}
        </span>
      </td>
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
  );
};

export default ProductItem;