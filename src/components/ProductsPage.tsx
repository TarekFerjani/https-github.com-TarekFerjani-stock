import React, { useState, useMemo } from 'react';
import { Product, Settings } from '../types';
import ProductList from './ProductList';
import AddProductModal from './AddProductModal';
import { inventoryService } from '../services/inventoryService';

interface ProductsPageProps {
  products: Product[];
  fetchAllData: () => void;
  isLoading: boolean;
  searchTerm: string;
  settings: Settings;
}

const ProductsPage: React.FC<ProductsPageProps> = ({ products, fetchAllData, isLoading, searchTerm, settings }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);

  const handleAddProduct = async (product: Omit<Product, 'id'>) => {
    await inventoryService.addProduct(product);
    fetchAllData();
    closeModal();
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    await inventoryService.updateProduct(updatedProduct);
    fetchAllData();
    closeModal();
  };
  
  const handleDeleteProduct = async (productId: string) => {
    if(window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')){
        try {
            await inventoryService.deleteProduct(productId);
            fetchAllData();
        } catch (error: any) {
            alert(`Erreur: ${error.message}`);
        }
    }
  };

  const openAddModal = () => {
    setProductToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setProductToEdit(product);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setProductToEdit(null);
  };

  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.codeBarres && product.codeBarres.includes(searchTerm)) ||
      product.categorie.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-700">Gestion des Produits</h1>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center h-10 w-10 md:w-auto md:px-4 md:py-2 bg-primary-600 text-white rounded-full md:rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all"
          aria-label="Ajouter un Produit"
        >
          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden md:inline ml-2">Ajouter un Produit</span>
        </button>
      </div>
      <ProductList
        products={filteredProducts}
        onEdit={openEditModal}
        onDelete={handleDeleteProduct}
        isLoading={isLoading}
        currencySymbol={settings.currencySymbol}
      />
      {isModalOpen && (
        <AddProductModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
          productToEdit={productToEdit}
        />
      )}
    </div>
  );
};

export default ProductsPage;