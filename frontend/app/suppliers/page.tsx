'use client';

import { useEffect, useState } from 'react';
import { Search, MapPin, Star, Tag, ShoppingCart } from 'lucide-react';

interface Supplier {
  id: string;
  name: string;
  nameTh: string;
  type: 'marketplace' | 'direct' | 'international';
  rating?: number;
  country: string;
  tags: string[];
  categories: string[];
}

interface Product {
  id: string;
  supplierId: string;
  name: string;
  nameTh: string;
  sku: string;
  price: number;
  currency: 'THB' | 'USD' | 'CNY';
  minOrder: number;
  leadTimeDays: number;
  rating?: number;
  category: string;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<Product[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [suppliersRes, categoriesRes] = await Promise.all([
          fetch('/api/suppliers'),
          fetch('/api/suppliers/categories'),
        ]);

        const supplierData = await suppliersRes.json();
        const categoryData = await categoriesRes.json();

        setSuppliers(supplierData.suppliers || []);
        setFilteredSuppliers(supplierData.suppliers || []);
        setCategories(categoryData.categories || []);
      } catch (error) {
        console.error('Failed to load suppliers:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    let filtered = suppliers;

    if (searchQuery) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.nameTh.includes(searchQuery) ||
          s.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    if (selectedCategory) {
      filtered = filtered.filter((s) => s.categories.includes(selectedCategory));
    }

    setFilteredSuppliers(filtered);
  }, [searchQuery, selectedCategory, suppliers]);

  const handleViewProducts = async (supplier: Supplier) => {
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}/products`);
      const data = await res.json();
      setSupplierProducts(data.products || []);
      setSelectedSupplier(supplier);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading suppliers...</div>;
  }

  // Detail view
  if (selectedSupplier) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <button
              onClick={() => setSelectedSupplier(null)}
              className="mb-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Suppliers
            </button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{selectedSupplier.name}</h1>
                <p className="text-slate-600 mt-1">{selectedSupplier.nameTh}</p>
              </div>
              <div className="flex items-center gap-4">
                {selectedSupplier.rating && (
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                    <span className="font-bold text-lg">{selectedSupplier.rating}</span>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-sm text-slate-600">Country</p>
                  <p className="font-semibold">{selectedSupplier.country}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h2 className="text-2xl font-bold mb-6">Products ({supplierProducts.length})</h2>
          {supplierProducts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg">
              <p className="text-slate-500">No products available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {supplierProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow p-6 border border-slate-200">
                  <h3 className="font-bold text-slate-900">{product.name}</h3>
                  <p className="text-sm text-slate-600">{product.nameTh}</p>
                  <p className="text-xs text-slate-500 mt-1">SKU: {product.sku}</p>
                  <div className="space-y-2 mt-4 pt-4 border-t">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">Price</span>
                      <span className="font-bold">{product.price} {product.currency}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Min Order</span>
                      <span>{product.minOrder} units</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Lead Time</span>
                      <span>{product.leadTimeDays} days</span>
                    </div>
                  </div>
                  <button className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg flex items-center justify-center gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Create PR
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold">Supplier Catalog</h1>
          <p className="text-slate-600 mt-2">ค้นหาและเลือกซัพพลายเออร์เพื่อจัดซื้อวัสดุและอุปกรณ์</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-4 py-2 rounded-full text-sm font-medium ${selectedCategory === '' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium capitalize ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}
              >
                {cat.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Supplier Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filteredSuppliers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">No suppliers found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.map((supplier) => (
              <div key={supplier.id} className="bg-white rounded-lg shadow hover:shadow-lg transition border border-slate-200">
                <div className="p-6 border-b">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="text-lg font-bold">{supplier.name}</h2>
                      <p className="text-sm text-slate-600">{supplier.nameTh}</p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                      {supplier.type}
                    </span>
                  </div>
                  <div className="flex gap-4 text-sm">
                    {supplier.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        {supplier.rating}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-slate-600">
                      <MapPin className="w-4 h-4" />
                      {supplier.country}
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  {supplier.categories.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-slate-500 mb-2">CATEGORIES</p>
                      <div className="flex flex-wrap gap-1">
                        {supplier.categories.slice(0, 3).map((cat) => (
                          <span key={cat} className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded">
                            {cat.replace('-', ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {supplier.tags.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-2">TAGS</p>
                      <div className="flex flex-wrap gap-1">
                        {supplier.tags.map((tag) => (
                          <span key={tag} className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                            <Tag className="w-3 h-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 border-t">
                  <button
                    onClick={() => handleViewProducts(supplier)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg"
                  >
                    View Products
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
