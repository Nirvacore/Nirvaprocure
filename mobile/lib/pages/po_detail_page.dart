import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';

/// PO detail — shows PO header, status badge, supplier, line items, action buttons.
class PoDetailPage extends StatefulWidget {
  const PoDetailPage({super.key, required this.id});
  final String id;

  @override
  State<PoDetailPage> createState() => _PoDetailPageState();
}

class _PoDetailPageState extends State<PoDetailPage> {
  Map<String, dynamic>? _po;
  bool _loading = true;
  bool _updating = false;
  static final _baht = NumberFormat.currency(locale: 'en_US', symbol: '฿ ', decimalDigits: 2);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _po = await Api.getPoDetail(widget.id);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _changeStatus(String newStatus) async {
    final l10n = L10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _updating = true);
    try {
      await Api.updatePoStatus(widget.id, newStatus);
      await _load();
      messenger.showSnackBar(SnackBar(
        content: Text(l10n.t('po_status_updated')),
        backgroundColor: Tokens.success,
      ));
    } catch (_) {
      messenger.showSnackBar(SnackBar(
        content: Text(l10n.t('po_status_update_fail')),
        backgroundColor: Tokens.danger,
      ));
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);

    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.t('po_detail_title'))),
        body: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    if (_po == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.t('po_detail_title'))),
        body: Center(child: Text(l10n.t('err.load'))),
      );
    }

    final po = _po!;
    final status = po['status'] as String? ?? 'draft';
    final items = (po['items'] as List?) ?? [];
    final total = (po['total_minor'] ?? 0) as int;
    final currency = (po['currency'] as String?) ?? 'THB';
    final supplierName = po['supplier_name'] as String?;

    return Scaffold(
      appBar: AppBar(
        title: Text(po['po_number'] as String? ?? l10n.t('po_detail_title')),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Status + total header ────────────────────────
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: const BorderSide(color: Tokens.gray200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _statusBadge(status, l10n),
                        const Spacer(),
                        Text(
                          '$currency ${(total / 100).toStringAsFixed(2)}',
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold,
                              color: Tokens.brand600),
                        ),
                      ],
                    ),
                    if (supplierName != null) ...[
                      const SizedBox(height: 12),
                      Row(children: [
                        const Icon(Icons.store, size: 16, color: Tokens.gray500),
                        const SizedBox(width: 8),
                        Text(supplierName,
                            style: const TextStyle(fontSize: 14, color: Tokens.gray500)),
                      ]),
                    ],
                    if (po['issued_at'] != null) ...[
                      const SizedBox(height: 8),
                      Row(children: [
                        const Icon(Icons.calendar_today, size: 14, color: Tokens.gray500),
                        const SizedBox(width: 8),
                        Text(
                          _formatDate(po['issued_at'] as String),
                          style: const TextStyle(fontSize: 12, color: Tokens.gray500),
                        ),
                      ]),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),

            // ── Line items ───────────────────────────────────
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: const BorderSide(color: Tokens.gray200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.t('po_items_heading'),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    if (items.isEmpty)
                      Text(l10n.t('no_data'),
                          style: const TextStyle(color: Tokens.gray500))
                    else
                      ...items.map((item) {
                        final it = item as Map<String, dynamic>;
                        final qty = it['quantity'] as num? ?? 0;
                        final unitPrice = (it['unit_price_minor'] ?? 0) as int;
                        final lineTotal = (it['line_total_minor'] ?? 0) as int;
                        return Padding(
                          padding: const EdgeInsets.symmetric(vertical: 6),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 28, height: 28,
                                decoration: BoxDecoration(
                                  color: Tokens.brand600.withAlpha(20),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Center(
                                  child: Text('${it['line_no']}',
                                      style: const TextStyle(fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: Tokens.brand600)),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(it['description'] as String? ?? '',
                                        style: const TextStyle(fontSize: 14,
                                            fontWeight: FontWeight.w500)),
                                    const SizedBox(height: 2),
                                    Text(
                                      '$qty ${it['unit'] ?? 'unit'} × ${_baht.format(unitPrice / 100)}',
                                      style: const TextStyle(fontSize: 12, color: Tokens.gray500),
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                _baht.format(lineTotal / 100),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                              ),
                            ],
                          ),
                        );
                      }),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // ── Action buttons based on status ───────────────
            if (status == 'draft')
              _ActionButton(
                onPressed: _updating ? null : () => _changeStatus('sent'),
                icon: Icons.send,
                label: l10n.t('po_action_send'),
                color: Tokens.brand600,
                filled: true,
              ),
            if (status == 'sent')
              _ActionButton(
                onPressed: _updating ? null : () => _changeStatus('acknowledged'),
                icon: Icons.handshake,
                label: l10n.t('po_action_acknowledge'),
                color: const Color(0xFF0D9488),
                filled: false,
              ),
            if (status == 'acknowledged' || status == 'partially_received')
              _ActionButton(
                onPressed: _updating ? null : () => _changeStatus('completed'),
                icon: Icons.check_circle,
                label: l10n.t('po_action_complete'),
                color: Tokens.success,
                filled: true,
              ),
            if (status != 'completed' && status != 'cancelled') ...[
              const SizedBox(height: 8),
              TextButton.icon(
                onPressed: _updating ? null : () => _changeStatus('cancelled'),
                icon: const Icon(Icons.cancel_outlined, color: Color(0xFFDC2626)),
                label: Text(l10n.t('po_action_cancel'),
                    style: const TextStyle(color: Color(0xFFDC2626))),
              ),
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _statusBadge(String s, L10n l10n) {
    final color = _statusColor(s);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: color.withAlpha(25),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        l10n.t('po_status_$s'),
        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: color),
      ),
    );
  }

  Color _statusColor(String s) => switch (s) {
    'draft'        => Tokens.gray500,
    'sent'         => const Color(0xFF2563EB),
    'acknowledged' => const Color(0xFF0D9488),
    'completed'    => const Color(0xFF16A34A),
    'cancelled'    => const Color(0xFFDC2626),
    _              => const Color(0xFFD97706),
  };

  String _formatDate(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return iso;
    return DateFormat('d MMM yyyy').format(dt.toLocal());
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.onPressed,
    required this.icon,
    required this.label,
    required this.color,
    required this.filled,
  });
  final VoidCallback? onPressed;
  final IconData icon;
  final String label;
  final Color color;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final style = filled
        ? ElevatedButton.styleFrom(
            backgroundColor: color,
            foregroundColor: Colors.white,
            minimumSize: const Size(double.infinity, 48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          )
        : OutlinedButton.styleFrom(
            foregroundColor: color,
            side: BorderSide(color: color),
            minimumSize: const Size(double.infinity, 48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          );

    return filled
        ? ElevatedButton.icon(
            onPressed: onPressed,
            icon: Icon(icon),
            label: Text(label),
            style: style,
          )
        : OutlinedButton.icon(
            onPressed: onPressed,
            icon: Icon(icon),
            label: Text(label),
            style: style,
          );
  }
}
