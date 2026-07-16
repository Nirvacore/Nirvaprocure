import { Injectable } from '@nestjs/common';

export interface Supplier {
  id: string;
  name: string;
  nameTh: string;
  type: 'marketplace' | 'direct' | 'international';
  url: string;
  logo?: string;
  rating?: number;
  status: 'active' | 'inactive';
  country: string;
  tags: string[];
  categories: string[];
}

export interface Product {
  id: string;
  supplierId: string;
  name: string;
  nameTh: string;
  sku: string;
  price: number;
  currency: 'THB' | 'USD' | 'CNY';
  quantity: number;
  minOrder: number;
  leadTimeDays: number;
  image?: string;
  rating?: number;
  category: string;
  tags: string[];
}

@Injectable()
export class SupplierService {
  getSuppliers(): Supplier[] {
    return [
      {
        id: 'lazada-th',
        name: 'Lazada Thailand',
        nameTh: 'ลาซาด้าไทย',
        type: 'marketplace',
        url: 'https://www.lazada.co.th',
        rating: 4.5,
        status: 'active',
        country: 'TH',
        tags: ['marketplace', 'fast-shipping', 'thai'],
        categories: ['electronics', 'office-supplies', 'equipment'],
      },
      {
        id: 'alibaba',
        name: 'Alibaba International',
        nameTh: 'อาลีบาบาเอกสารการส่งออก',
        type: 'international',
        url: 'https://www.alibaba.com',
        rating: 4.2,
        status: 'active',
        country: 'CN',
        tags: ['wholesale', 'bulk', 'international', 'bulk-order'],
        categories: ['manufacturing', 'wholesale', 'equipment'],
      },
      {
        id: 'central-world',
        name: 'Central World',
        nameTh: 'เซนทรัลเวิลด์',
        type: 'direct',
        url: 'https://www.centralworld.co.th',
        rating: 4.7,
        status: 'active',
        country: 'TH',
        tags: ['local', 'retail', 'office-supplies'],
        categories: ['office-supplies', 'furniture', 'electronics'],
      },
      {
        id: 'makro',
        name: 'Makro Thailand',
        nameTh: 'มาโคร ไทยแลนด์',
        type: 'direct',
        url: 'https://www.makrothailand.com',
        rating: 4.4,
        status: 'active',
        country: 'TH',
        tags: ['wholesale', 'bulk', 'local', 'office-supplies'],
        categories: ['office-supplies', 'equipment', 'supplies'],
      },
      {
        id: 'amazon-us',
        name: 'Amazon USA',
        nameTh: 'อเมซอน ยูเอสเอ',
        type: 'international',
        url: 'https://www.amazon.com',
        rating: 4.8,
        status: 'active',
        country: 'US',
        tags: ['international', 'electronics', 'reliable'],
        categories: ['electronics', 'equipment', 'supplies'],
      },
    ];
  }

  getSupplierById(id: string): Supplier | undefined {
    return this.getSuppliers().find((s) => s.id === id);
  }

  searchSuppliers(query: string, category?: string): Supplier[] {
    const suppliers = this.getSuppliers();
    return suppliers.filter((s) => {
      const matchesQuery =
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.nameTh.includes(query) ||
        s.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()));

      const matchesCategory = !category || s.categories.includes(category);

      return matchesQuery && matchesCategory;
    });
  }

  getProductsBySupplier(supplierId: string): Product[] {
    const mockProducts: Record<string, Product[]> = {
      'lazada-th': [
        {
          id: 'LAZ-001',
          supplierId: 'lazada-th',
          name: 'Office Chair Executive',
          nameTh: 'เก้าอี้สำนักงานผู้บริหาร',
          sku: 'OC-EXE-001',
          price: 4500,
          currency: 'THB',
          quantity: 50,
          minOrder: 1,
          leadTimeDays: 3,
          rating: 4.6,
          category: 'furniture',
          tags: ['office', 'chair', 'ergonomic'],
        },
        {
          id: 'LAZ-002',
          supplierId: 'lazada-th',
          name: 'A4 Paper Ream (500 sheets)',
          nameTh: 'กระดาษ A4 รีม 500 แผ่น',
          sku: 'PAPER-A4-500',
          price: 180,
          currency: 'THB',
          quantity: 1000,
          minOrder: 10,
          leadTimeDays: 2,
          rating: 4.5,
          category: 'supplies',
          tags: ['paper', 'office-supplies'],
        },
      ],
      alibaba: [
        {
          id: 'ALI-001',
          supplierId: 'alibaba',
          name: 'Bulk USB Cable (100 pieces)',
          nameTh: 'สายเคเบิล USB จำนวนมาก 100 ชิ้น',
          sku: 'USB-BULK-100',
          price: 800,
          currency: 'CNY',
          quantity: 1000,
          minOrder: 100,
          leadTimeDays: 21,
          rating: 4.3,
          category: 'electronics',
          tags: ['wholesale', 'bulk', 'cables'],
        },
      ],
      'central-world': [
        {
          id: 'CW-001',
          supplierId: 'central-world',
          name: 'Desktop Lamp LED',
          nameTh: 'โคมไฟตั้งโต๊ะ LED',
          sku: 'LAMP-LED-001',
          price: 1200,
          currency: 'THB',
          quantity: 100,
          minOrder: 1,
          leadTimeDays: 1,
          rating: 4.7,
          category: 'equipment',
          tags: ['lighting', 'led', 'energy-efficient'],
        },
      ],
    };

    return mockProducts[supplierId] || [];
  }

  getCategories(): string[] {
    return [
      'electronics',
      'office-supplies',
      'furniture',
      'equipment',
      'supplies',
      'manufacturing',
      'wholesale',
    ];
  }
}
