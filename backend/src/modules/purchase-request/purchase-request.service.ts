import { Injectable } from '@nestjs/common';

export interface PurchaseRequestItem {
  productId: string;
  supplierId: string;
  quantity: number;
  unitPrice: number;
  currency: 'THB' | 'USD' | 'CNY';
  notes?: string;
}

export interface PurchaseRequest {
  id: string;
  prNumber: string;
  departmentId: string;
  requestedBy: string;
  requestedByName: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'ordered' | 'received';
  items: PurchaseRequestItem[];
  totalAmount: number;
  currency: 'THB' | 'USD' | 'CNY';
  budget?: number;
  budgetCode?: string;
  deliveryDate?: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PurchaseRequestService {
  private prCounter = 1000;

  generatePRNumber(): string {
    this.prCounter++;
    const year = new Date().getFullYear();
    return `PR-${year}-${this.prCounter}`;
  }

  createPurchaseRequest(
    departmentId: string,
    userId: string,
    userName: string,
    items: PurchaseRequestItem[],
    notes?: string
  ): PurchaseRequest {
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const pr: PurchaseRequest = {
      id: `pr_${Date.now()}`,
      prNumber: this.generatePRNumber(),
      departmentId,
      requestedBy: userId,
      requestedByName: userName,
      status: 'draft',
      items,
      totalAmount,
      currency: items[0]?.currency || 'THB',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      notes,
    };

    return pr;
  }

  calculateTotals(items: PurchaseRequestItem[]): {
    subtotal: number;
    estimatedTax: number;
    total: number;
  } {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const estimatedTax = subtotal * 0.07; // 7% VAT
    const total = subtotal + estimatedTax;

    return { subtotal, estimatedTax, total };
  }

  validatePurchaseRequest(pr: PurchaseRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!pr.departmentId) {
      errors.push('Department is required');
    }

    if (!pr.requestedBy) {
      errors.push('Requester is required');
    }

    if (pr.items.length === 0) {
      errors.push('At least one item is required');
    }

    pr.items.forEach((item, index) => {
      if (!item.supplierId) {
        errors.push(`Item ${index + 1}: Supplier is required`);
      }
      if (!item.productId) {
        errors.push(`Item ${index + 1}: Product is required`);
      }
      if (item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
      }
      if (item.unitPrice <= 0) {
        errors.push(`Item ${index + 1}: Unit price must be greater than 0`);
      }
    });

    if (pr.budget && pr.totalAmount > pr.budget) {
      errors.push(`Total amount (${pr.totalAmount}) exceeds budget (${pr.budget})`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  getPurchaseRequestStatus(status: string): {
    label: string;
    color: string;
    nextActions: string[];
  } {
    const statuses: Record<
      string,
      { label: string; color: string; nextActions: string[] }
    > = {
      draft: {
        label: 'Draft',
        color: 'gray',
        nextActions: ['Submit for approval', 'Add items', 'Delete'],
      },
      submitted: {
        label: 'Submitted',
        color: 'blue',
        nextActions: ['Waiting for approval', 'Recall'],
      },
      approved: {
        label: 'Approved',
        color: 'green',
        nextActions: ['Create order', 'Send to supplier'],
      },
      rejected: {
        label: 'Rejected',
        color: 'red',
        nextActions: ['Edit and resubmit', 'Delete'],
      },
      ordered: {
        label: 'Ordered',
        color: 'purple',
        nextActions: ['Track order', 'Waiting for delivery'],
      },
      received: {
        label: 'Received',
        color: 'emerald',
        nextActions: ['Create invoice', 'Close'],
      },
    };

    return statuses[status] || { label: 'Unknown', color: 'gray', nextActions: [] };
  }

  formatCurrency(amount: number, currency: string): string {
    const formatter = new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency,
    });
    return formatter.format(amount);
  }
}
