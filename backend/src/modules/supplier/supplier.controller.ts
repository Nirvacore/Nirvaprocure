import { Controller, Get, Param, Query } from '@nestjs/common';
import { SupplierService } from './supplier.service';

@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Get()
  getSuppliers(@Query('category') category?: string) {
    if (category) {
      return {
        suppliers: this.supplierService.searchSuppliers('', category),
        total: 0,
      };
    }
    return {
      suppliers: this.supplierService.getSuppliers(),
      total: this.supplierService.getSuppliers().length,
    };
  }

  @Get('search')
  searchSuppliers(@Query('q') query: string, @Query('category') category?: string) {
    return {
      suppliers: this.supplierService.searchSuppliers(query, category),
      query,
      category,
    };
  }

  @Get('categories')
  getCategories() {
    return {
      categories: this.supplierService.getCategories(),
    };
  }

  @Get(':id')
  getSupplier(@Param('id') id: string) {
    const supplier = this.supplierService.getSupplierById(id);
    if (!supplier) {
      return { error: 'Supplier not found' };
    }
    return { supplier };
  }

  @Get(':id/products')
  getSupplierProducts(@Param('id') id: string) {
    const supplier = this.supplierService.getSupplierById(id);
    if (!supplier) {
      return { error: 'Supplier not found' };
    }
    return {
      supplier,
      products: this.supplierService.getProductsBySupplier(id),
    };
  }
}
