import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { PurchaseRequestService, PurchaseRequestItem } from './purchase-request.service';

@Controller('purchase-requests')
export class PurchaseRequestController {
  constructor(private readonly prService: PurchaseRequestService) {}

  @Post()
  createPurchaseRequest(
    @Body()
    body: {
      departmentId: string;
      userId: string;
      userName: string;
      items: PurchaseRequestItem[];
      notes?: string;
    }
  ) {
    const pr = this.prService.createPurchaseRequest(
      body.departmentId,
      body.userId,
      body.userName,
      body.items,
      body.notes
    );

    const validation = this.prService.validatePurchaseRequest(pr);

    return {
      purchaseRequest: pr,
      validation,
      totals: this.prService.calculateTotals(pr.items),
    };
  }

  @Get()
  listPurchaseRequests(
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('limit') limit: string = '50'
  ) {
    // Mock list (would query database)
    return {
      purchaseRequests: [],
      total: 0,
      limit: parseInt(limit),
      filters: { departmentId, status },
    };
  }

  @Get(':id')
  getPurchaseRequest(@Param('id') id: string) {
    // Mock get (would query database)
    return {
      purchaseRequest: null,
      error: 'Not found',
    };
  }

  @Post(':id/submit')
  submitPurchaseRequest(@Param('id') id: string) {
    return {
      message: 'Purchase request submitted for approval',
      prId: id,
      status: 'submitted',
    };
  }

  @Post(':id/approve')
  approvePurchaseRequest(
    @Param('id') id: string,
    @Body() body: { approvedBy: string; notes?: string }
  ) {
    return {
      message: 'Purchase request approved',
      prId: id,
      status: 'approved',
      approvedBy: body.approvedBy,
      approvedAt: new Date().toISOString(),
    };
  }

  @Post(':id/reject')
  rejectPurchaseRequest(
    @Param('id') id: string,
    @Body() body: { rejectionReason: string; rejectedBy: string }
  ) {
    return {
      message: 'Purchase request rejected',
      prId: id,
      status: 'rejected',
      reason: body.rejectionReason,
      rejectedBy: body.rejectedBy,
    };
  }

  @Get(':id/totals')
  calculateTotals(@Param('id') id: string) {
    // Mock calculation
    return {
      prId: id,
      subtotal: 0,
      tax: 0,
      total: 0,
      currency: 'THB',
    };
  }

  @Get(':id/status')
  getPRStatus(@Param('id') id: string) {
    const status = 'draft';
    const statusInfo = this.prService.getPurchaseRequestStatus(status);
    return {
      prId: id,
      status,
      ...statusInfo,
    };
  }
}
