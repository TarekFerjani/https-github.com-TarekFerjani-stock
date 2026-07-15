import React, { useState, useEffect } from 'react';
import { Product } from '../types';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (product: Product) => void;
  productToEdit: Product | null;
}

const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onAddProduct, onUpdateProduct, productToEdit }) => {
  const [product, setProduct] = useState({
    nom: '', categorie: '', codeBarres: ''
  });

  useEffect(() => {
    if (productToEdit) {
      setProduct({
        nom: productToEdit.nom,
        categorie: productToEdit.categorie,
        codeBarres: productToEdit.codeBarres || ''
      });
    } else {
      setProduct({
        nom: '', categorie: '', codeBarres: ''
      });
    }
  }, [productToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProduct(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (productToEdit) {
      onUpdateProduct({ ...product, id: productToEdit.id });
    } else {
      onAddProduct(product);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-full overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center pb-3 border-b">
            <h3 className="text-xl font-semibold text-gray-800">{productToEdit ? 'Éditer le Produit' : 'Ajouter un Produit'}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="nom" className="block text-sm font-medium text-gray-700">Nom du Produit</label>
              <input type="text" name="nom" id="nom" value={product.nom} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" required />
            </div>
            <div>
              <label htmlFor="categorie" className="block text-sm font-medium text-gray-700">Catégorie</label>
              <input type="text" name="categorie" id="categorie" value={product.categorie} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" required/>
            </div>
            <div>
              <label htmlFor="codeBarres" className="block text-sm font-medium text-gray-700">Code-barres</label>
              <input type="text" name="codeBarres" id="codeBarres" value={product.codeBarres} onChange={handleChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm" />
            </div>
            <div className="pt-4 flex justify-end space-x-2">
              <button type="button" onClick={onClose} className="py-2 px-4 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">Annuler</button>
              <button type="submit" className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">{productToEdit ? 'Mettre à Jour' : 'Ajouter'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddProductModal;
