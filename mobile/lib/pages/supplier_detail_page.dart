import 'package:flutter/material.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';

/// Supplier detail — shows full supplier info, risk badge, stats, and contact.
class SupplierDetailPage extends StatelessWidget {
  const SupplierDetailPage({super.key, required this.supplier});
  final Supplier supplier;

  Color _riskColor(String? tier) => switch (tier) {
    'low'      => const Color(0xFF22C55E),
    'medium'   => const Color(0xFFF59E0B),
    'high'     => const Color(0xFFF97316),
    'critical' => const Color(0xFFEF4444),
    _          => Tokens.gray500,
  };

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final risk = supplier.riskTier ?? 'low';
    final rColor = _riskColor(risk);

    return Scaffold(
      appBar: AppBar(title: Text(supplier.name)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Header card ──────────────────────────────────────────
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: Tokens.gray200),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: Tokens.brand600.withAlpha(20),
                    child: Text(
                      supplier.name.isNotEmpty ? supplier.name[0].toUpperCase() : '?',
                      style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold,
                          color: Tokens.brand600),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(supplier.name,
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center),
                  const SizedBox(height: 4),
                  Text(supplier.code,
                      style: const TextStyle(fontSize: 14, color: Tokens.gray500)),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: rColor.withAlpha(25),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(width: 10, height: 10,
                            decoration: BoxDecoration(color: rColor, shape: BoxShape.circle)),
                        const SizedBox(width: 8),
                        Text(
                          l10n.t('suppliers.risk.$risk'),
                          style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: rColor),
                        ),
                        Text(
                          ' ${l10n.t('supplier_risk_label')}',
                          style: TextStyle(fontSize: 14, color: rColor.withAlpha(200)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // ── Stats row ────────────────────────────────────────────
          Row(
            children: [
              Expanded(child: _StatBox(
                label: l10n.t('supplier_stat_prs'),
                value: '${supplier.totalPrCount}',
                icon: Icons.receipt_long,
                color: Tokens.brand600,
              )),
              const SizedBox(width: 12),
              Expanded(child: _StatBox(
                label: l10n.t('supplier_stat_spent'),
                value: '฿${(supplier.totalSpentMinor / 100).toStringAsFixed(0)}',
                icon: Icons.payments,
                color: const Color(0xFF7C3AED),
              )),
            ],
          ),
          const SizedBox(height: 16),

          // ── Contact info ─────────────────────────────────────────
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
                  Text(l10n.t('supplier_contact'),
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  if (supplier.contact != null)
                    _InfoRow(icon: Icons.email_outlined,
                        label: l10n.t('supplier_email'), value: supplier.contact!),
                  if (supplier.category != null) ...[
                    const SizedBox(height: 8),
                    _InfoRow(icon: Icons.category_outlined,
                        label: l10n.t('supplier_category'), value: supplier.category!),
                  ],
                  if (supplier.contact == null && supplier.category == null)
                    Text(l10n.t('no_data'),
                        style: const TextStyle(color: Tokens.gray500)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatBox extends StatelessWidget {
  const _StatBox({required this.label, required this.value, required this.icon, required this.color});
  final String label, value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Tokens.gray200),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 12),
        child: Column(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 12, color: color.withAlpha(180)),
                textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label, value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Tokens.gray500),
        const SizedBox(width: 8),
        Text('$label: ', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
        Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
      ],
    );
  }
}
