import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'api_client.dart';

/// Typed wrappers around the API. Keep the surface small here — every method
/// in this file maps 1:1 to a backend endpoint, and the only place we deal
/// with raw dio responses is inside these functions.

class LoginResult {
  LoginResult({required this.token, required this.refreshToken, required this.user});
  final String token;
  final String refreshToken;
  final SessionUser user;
}

class SessionUser {
  SessionUser({required this.id, required this.email, required this.fullName, required this.orgId});
  final String id;
  final String email;
  final String fullName;
  final String orgId;

  factory SessionUser.fromJson(Map<String, dynamic> j) => SessionUser(
        id:       j['id']       as String,
        email:    j['email']    as String,
        fullName: j['full_name'] as String,
        orgId:    j['org_id']   as String,
      );
}

class PrSummary {
  PrSummary({
    required this.id, required this.prNumber, required this.title, required this.status,
    required this.totalMinor, required this.createdAt,
  });
  final String id, prNumber, title, status, createdAt;
  final int    totalMinor;

  factory PrSummary.fromJson(Map<String, dynamic> j) => PrSummary(
        id:         j['id']         as String,
        prNumber:   j['pr_number']  as String,
        title:      j['title']      as String,
        status:     j['status']     as String,
        totalMinor: (j['total']?['amount_minor'] ?? 0) as int,
        createdAt:  j['created_at'] as String,
      );
}

class InboxEntry {
  InboxEntry({required this.instanceId, required this.stepNo, required this.waitingSince, required this.pr});
  final String instanceId;
  final int stepNo;
  final String waitingSince;
  final PrSummary pr;

  factory InboxEntry.fromJson(Map<String, dynamic> j) => InboxEntry(
        instanceId:   j['instance_id']   as String,
        stepNo:       j['step_no']       as int,
        waitingSince: j['waiting_since'] as String,
        pr:           PrSummary.fromJson(j['pr'] as Map<String, dynamic>),
      );

  /// Convenience: true when the item has been sitting > 48h.
  bool get urgent {
    final t = DateTime.tryParse(waitingSince);
    if (t == null) return false;
    return DateTime.now().difference(t).inHours > 48;
  }
}

class PrComment {
  PrComment({
    required this.id, required this.body, required this.createdAt,
    required this.authorId, required this.authorName,
  });
  final String id, body, createdAt, authorId, authorName;

  factory PrComment.fromJson(Map<String, dynamic> j) => PrComment(
        id:         j['id']          as String,
        body:       j['body']        as String,
        createdAt:  j['created_at']  as String,
        authorId:   j['author_id']   as String,
        authorName: (j['author_name'] as String?) ?? (j['author_id'] as String),
      );
}

class Api {
  Api._();
  static final Dio _dio = ApiClient.instance.raw;

  // ---------------------------------------------------------------------------
  // auth
  // ---------------------------------------------------------------------------
  static Future<LoginResult> login(String email, String password) async {
    final res = await _dio.post('/auth/login', data: {'email': email, 'password': password});
    final data = res.data as Map<String, dynamic>;
    final result = LoginResult(
      token:        data['token']         as String,
      refreshToken: data['refresh_token'] as String,
      user:         SessionUser.fromJson(data['user'] as Map<String, dynamic>),
    );
    await ApiClient.instance.setTokens(access: result.token, refresh: result.refreshToken);
    return result;
  }

  static Future<void> logout() async {
    try { await _dio.post('/auth/logout'); } catch (_) { /* ignore */ }
    await ApiClient.instance.clearTokens();
  }

  // ---------------------------------------------------------------------------
  // pr
  // ---------------------------------------------------------------------------
  static Future<List<PrSummary>> listPr() async {
    final res  = await _dio.get('/pr');
    final list = (res.data['data'] as List).cast<Map<String, dynamic>>();
    return list.map(PrSummary.fromJson).toList(growable: false);
  }

  /// Parse a marketplace URL → returns a draft line item the buyer can edit.
  static Future<Map<String, dynamic>> importLink(String url) async {
    final res = await _dio.post('/pr/import-link', data: {'url': url});
    return res.data as Map<String, dynamic>;
  }

  /// Create a draft PR.
  static Future<PrSummary> createPr({
    required String title,
    String? justification,
    required List<Map<String, dynamic>> items,
  }) async {
    final res = await _dio.post('/pr', data: {
      'title': title,
      if (justification != null) 'justification': justification,
      'items': items,
    });
    return PrSummary.fromJson(res.data as Map<String, dynamic>);
  }

  /// Submit a draft PR for approval.
  static Future<void> submitPr(String id) async {
    await _dio.post('/pr/$id/submit');
  }

  // ---------------------------------------------------------------------------
  // people (users + departments)
  // ---------------------------------------------------------------------------
  static Future<List<Map<String, dynamic>>> listUsers() async {
    final res = await _dio.get('/people/users');
    return (res.data as List).cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> listDepartments() async {
    final res = await _dio.get('/people/departments');
    return (res.data as List).cast<Map<String, dynamic>>();
  }

  // ---------------------------------------------------------------------------
  // profile (current user)
  // ---------------------------------------------------------------------------
  static Future<UserProfile> getMe() async {
    final res = await _dio.get('/people/me');
    return UserProfile.fromJson(res.data as Map<String, dynamic>);
  }

  // ---------------------------------------------------------------------------
  // analytics
  // ---------------------------------------------------------------------------
  static Future<Map<String, dynamic>> analyticsSummary() async {
    final res = await _dio.get('/analytics/summary');
    return res.data as Map<String, dynamic>;
  }

  // ---------------------------------------------------------------------------
  // comments
  // ---------------------------------------------------------------------------
  static Future<List<PrComment>> listComments(String prId) async {
    final res  = await _dio.get('/pr/$prId/comments');
    final list = (res.data as List).cast<Map<String, dynamic>>();
    return list.map(PrComment.fromJson).toList(growable: false);
  }

  static Future<PrComment> addComment(String prId, String body) async {
    final res = await _dio.post('/pr/$prId/comments', data: {'body': body});
    return PrComment.fromJson(res.data as Map<String, dynamic>);
  }

  // ---------------------------------------------------------------------------
  // approvals
  // ---------------------------------------------------------------------------
  static Future<List<InboxEntry>> approvalsInbox() async {
    final res  = await _dio.get('/approvals/inbox');
    final list = (res.data as List).cast<Map<String, dynamic>>();
    return list.map(InboxEntry.fromJson).toList(growable: false);
  }

  static Future<void> decide(String instanceId, String decision, {String? comment}) async {
    await _dio.post('/approvals/$instanceId/decision',
        data: {'decision': decision, if (comment != null) 'comment': comment});
  }

  // ---------------------------------------------------------------------------
  // stock
  // ---------------------------------------------------------------------------
  static Future<List<StockWarehouse>> listWarehouses() async {
    final res  = await _dio.get('/stock/warehouses');
    final list = (res.data as List).cast<Map<String, dynamic>>();
    return list.map(StockWarehouse.fromJson).toList(growable: false);
  }

  static Future<void> recordStockMovement({
    required String itemId,
    required String warehouseId,
    required String type,
    required int qty,
    String? note,
  }) async {
    await _dio.post('/stock/movements', data: {
      'item_id': itemId,
      'warehouse_id': warehouseId,
      'type': type,
      'qty': qty,
      if (note != null && note.isNotEmpty) 'note': note,
    });
  }

  static Future<List<StockOnHand>> stockOnHand({String? warehouseId}) async {
    final res = await _dio.get('/stock/on-hand',
        queryParameters: {if (warehouseId != null) 'warehouse_id': warehouseId});
    final list = (res.data as List).cast<Map<String, dynamic>>();
    return list.map(StockOnHand.fromJson).toList(growable: false);
  }

  // ---------------------------------------------------------------------------
  // suppliers
  // ---------------------------------------------------------------------------
  static Future<List<Supplier>> listSuppliers() async {
    final res  = await _dio.get('/suppliers');
    final list = (res.data as List).cast<Map<String, dynamic>>();
    return list.map(Supplier.fromJson).toList(growable: false);
  }

  // ---------------------------------------------------------------------------
  // notifications
  // ---------------------------------------------------------------------------
  static Future<List<AppNotification>> listNotifications() async {
    final res  = await _dio.get('/notifications');
    final list = (res.data as List).cast<Map<String, dynamic>>();
    return list.map(AppNotification.fromJson).toList(growable: false);
  }

  static Future<bool> lineStatus() async {
    final res = await _dio.get('/notifications/line/status');
    return (res.data['linked'] as bool?) ?? false;
  }

  static Future<void> markNotificationRead(String id) async {
    await _dio.patch('/notifications/$id/read');
  }

  static Future<void> markAllNotificationsRead() async {
    await _dio.patch('/notifications/read-all');
  }

  // ---------------------------------------------------------------------------
  // PO (purchase orders)
  // ---------------------------------------------------------------------------
  static Future<List<PoSummary>> listPo({String? status}) async {
    final res = await _dio.get('/po',
        queryParameters: {if (status != null) 'status': status});
    final list = (res.data as List).cast<Map<String, dynamic>>();
    return list.map(PoSummary.fromJson).toList(growable: false);
  }

  static Future<Map<String, dynamic>> getPoDetail(String id) async {
    final res = await _dio.get('/po/$id');
    return res.data as Map<String, dynamic>;
  }

  static Future<PoSummary> createPoFromPr(String prId, {String? supplierId}) async {
    final res = await _dio.post('/po', data: {
      'pr_id': prId,
      if (supplierId != null) 'supplier_id': supplierId,
    });
    return PoSummary.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<void> updatePoStatus(String id, String status) async {
    await _dio.patch('/po/$id/status', data: {'status': status});
  }

  // ---------------------------------------------------------------------------
  // attachments
  // ---------------------------------------------------------------------------
  static Future<List<AttachmentInfo>> listAttachments(String prId) async {
    final res = await _dio.get('/pr/$prId/attachments');
    final list = (res.data as List).cast<Map<String, dynamic>>();
    return list.map(AttachmentInfo.fromJson).toList(growable: false);
  }

  static Future<AttachmentInfo> addAttachment(String prId, {
    required String fileName,
    required String fileType,
    required int fileSize,
    required String storageKey,
  }) async {
    final res = await _dio.post('/pr/$prId/attachments', data: {
      'file_name': fileName,
      'file_type': fileType,
      'file_size': fileSize,
      'storage_key': storageKey,
    });
    return AttachmentInfo.fromJson(res.data as Map<String, dynamic>);
  }

  static Future<void> deleteAttachment(String prId, String id) async {
    await _dio.delete('/pr/$prId/attachments/$id');
  }

  // ---------------------------------------------------------------------------
  // FCM
  // ---------------------------------------------------------------------------
  static Future<void> registerFcmToken(String token, String platform) async {
    await _dio.post('/notifications/fcm/token', data: {
      'token': token,
      'platform': platform,
    });
  }

  // ---------------------------------------------------------------------------
  // budgets
  // ---------------------------------------------------------------------------
  static Future<List<BudgetRow>> listBudgets({String? month}) async {
    final res = await _dio.get('/budgets',
        queryParameters: {if (month != null) 'month': month});
    final list = (res.data as List).cast<Map<String, dynamic>>();
    return list.map(BudgetRow.fromJson).toList(growable: false);
  }

  // ---------------------------------------------------------------------------
  // audit log
  // ---------------------------------------------------------------------------
  static Future<AuditPage> auditLog({String? cursor, int limit = 50}) async {
    final res = await _dio.get('/audit/log',
        queryParameters: {'limit': limit, if (cursor != null) 'cursor': cursor});
    final data = res.data as Map<String, dynamic>;
    final list = (data['data'] as List).cast<Map<String, dynamic>>();
    return AuditPage(
      entries: list.map(AuditEntry.fromJson).toList(growable: false),
      nextCursor: data['next_cursor'] as String?,
    );
  }
}

class StockWarehouse {
  StockWarehouse({required this.id, required this.name, required this.code, required this.isActive});
  final String id, name, code;
  final bool isActive;

  factory StockWarehouse.fromJson(Map<String, dynamic> j) => StockWarehouse(
        id:       j['id']        as String,
        name:     j['name']      as String,
        code:     j['code']      as String,
        isActive: (j['is_active'] as bool?) ?? true,
      );
}

class StockOnHand {
  StockOnHand({
    required this.itemId, required this.sku, required this.name, required this.unit,
    required this.warehouseId, required this.warehouseCode, required this.warehouseName,
    required this.qty, this.reorderPoint, required this.belowReorder,
  });
  final String itemId, sku, name, unit, warehouseId, warehouseCode, warehouseName;
  final int qty;
  final int? reorderPoint;
  final bool belowReorder;

  factory StockOnHand.fromJson(Map<String, dynamic> j) => StockOnHand(
        itemId:        j['item_id']        as String,
        sku:           j['sku']            as String,
        name:          j['name']           as String,
        unit:          j['unit']           as String,
        warehouseId:   j['warehouse_id']   as String,
        warehouseCode: j['warehouse_code'] as String,
        warehouseName: j['warehouse_name'] as String,
        qty:           (j['qty'] ?? 0)     as int,
        reorderPoint:  j['reorder_point']  as int?,
        belowReorder:  (j['below_reorder'] as bool?) ?? false,
      );
}

class Supplier {
  Supplier({
    required this.id, required this.name, required this.code,
    this.category, this.contact, this.riskTier,
    this.totalPrCount = 0, this.totalSpentMinor = 0,
  });
  final String id, name, code;
  final String? category, contact, riskTier;
  final int totalPrCount, totalSpentMinor;

  factory Supplier.fromJson(Map<String, dynamic> j) => Supplier(
        id:              j['id']               as String,
        name:            j['name']             as String,
        code:            (j['code'] as String?) ?? '',
        category:        j['category']         as String?,
        contact:         j['contact_email']    as String?,
        riskTier:        j['risk_tier']        as String?,
        totalPrCount:    (j['total_pr_count']  as int?) ?? 0,
        totalSpentMinor: (j['total_spent_minor'] as int?) ?? 0,
      );
}

class AppNotification {
  AppNotification({
    required this.id, required this.type, required this.title,
    this.body, required this.createdAt, this.readAt, this.refId,
  });
  final String id, type, title, createdAt;
  final String? body, readAt, refId;

  factory AppNotification.fromJson(Map<String, dynamic> j) => AppNotification(
        id:        j['id']         as String,
        type:      j['type']       as String,
        title:     j['title']      as String,
        body:      j['body']       as String?,
        createdAt: j['created_at'] as String,
        readAt:    j['read_at']    as String?,
        refId:     j['ref_id']     as String?,
      );
}

class BudgetRow {
  BudgetRow({
    required this.departmentId, required this.departmentName,
    required this.amountMinor, required this.spentMinor,
    this.softBlock = false,
  });
  final String departmentId, departmentName;
  final int amountMinor, spentMinor;
  final bool softBlock;

  factory BudgetRow.fromJson(Map<String, dynamic> j) => BudgetRow(
        departmentId:   j['department_id']   as String,
        departmentName: (j['department_name'] as String?) ?? '',
        amountMinor:    (j['amount_minor'] as int?) ?? 0,
        spentMinor:     (j['spent_minor']  as int?) ?? 0,
        softBlock:      (j['soft_block']   as bool?) ?? false,
      );
}

class AuditEntry {
  AuditEntry({
    required this.id, required this.action, required this.actorId,
    this.actorName, this.entityType, this.entityId, required this.createdAt,
  });
  final String id, action, actorId, createdAt;
  final String? actorName, entityType, entityId;

  factory AuditEntry.fromJson(Map<String, dynamic> j) => AuditEntry(
        id:         j['id']          as String,
        action:     j['action']      as String,
        actorId:    j['actor_id']    as String,
        actorName:  j['actor_name']  as String?,
        entityType: j['entity_type'] as String?,
        entityId:   j['entity_id']   as String?,
        createdAt:  j['created_at']  as String,
      );
}

class AuditPage {
  AuditPage({required this.entries, this.nextCursor});
  final List<AuditEntry> entries;
  final String? nextCursor;
}

class PoSummary {
  PoSummary({
    required this.id, required this.poNumber, required this.status,
    required this.totalMinor, this.prId, this.supplierName,
    required this.createdAt, this.currency = 'THB',
  });
  final String id, poNumber, status, createdAt, currency;
  final String? prId, supplierName;
  final int totalMinor;

  factory PoSummary.fromJson(Map<String, dynamic> j) => PoSummary(
        id:           j['id']            as String,
        poNumber:     j['po_number']     as String,
        status:       j['status']        as String,
        totalMinor:   (j['total_minor'] ?? 0) as int,
        prId:         j['pr_id']         as String?,
        supplierName: j['supplier_name'] as String?,
        createdAt:    j['created_at']    as String,
        currency:     (j['currency'] as String?) ?? 'THB',
      );
}

class AttachmentInfo {
  AttachmentInfo({
    required this.id, required this.fileName, required this.fileType,
    required this.fileSize, required this.storageKey, required this.createdAt,
  });
  final String id, fileName, fileType, storageKey, createdAt;
  final int fileSize;

  factory AttachmentInfo.fromJson(Map<String, dynamic> j) => AttachmentInfo(
        id:         j['id']          as String,
        fileName:   j['file_name']   as String,
        fileType:   j['file_type']   as String,
        fileSize:   (j['file_size'] ?? 0) as int,
        storageKey: j['storage_key'] as String,
        createdAt:  j['created_at']  as String,
      );

  String get sizeLabel {
    if (fileSize < 1024) return '$fileSize B';
    if (fileSize < 1024 * 1024) return '${(fileSize / 1024).toStringAsFixed(1)} KB';
    return '${(fileSize / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  IconData get icon {
    if (fileType.startsWith('image/')) return Icons.image;
    if (fileType.contains('pdf')) return Icons.picture_as_pdf;
    if (fileType.contains('spreadsheet') || fileType.contains('excel')) return Icons.table_chart;
    return Icons.attach_file;
  }
}

class UserProfile {
  UserProfile({
    required this.id, required this.email, required this.fullName,
    this.department, this.role, this.orgName, this.preferredLocale,
  });
  final String id, email, fullName;
  final String? department, role, orgName, preferredLocale;

  factory UserProfile.fromJson(Map<String, dynamic> j) => UserProfile(
        id:              j['id']               as String,
        email:           j['email']            as String,
        fullName:        (j['full_name'] as String?) ?? '',
        department:      j['department']       as String?,
        role:            j['role']             as String?,
        orgName:         j['org_name']         as String?,
        preferredLocale: j['preferred_locale'] as String?,
      );
}
