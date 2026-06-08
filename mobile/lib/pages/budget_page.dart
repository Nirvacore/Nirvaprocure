import 'package:flutter/material.dart';
import '../l10n/l10n.dart';
import '../api/endpoints.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class BudgetPage extends StatefulWidget {
  const BudgetPage({super.key});
  @override
  State<BudgetPage> createState() => _BudgetPageState();
}

class _BudgetPageState extends State<BudgetPage> {
  List<BudgetRow> _rows = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      _rows = await Api.listBudgets();
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);

    // Summary totals
    final totalBudget = _rows.fold<int>(0, (s, r) => s + r.amountMinor);
    final totalSpent  = _rows.fold<int>(0, (s, r) => s + r.spentMinor);
    final overCount   = _rows.where((r) => r.spentMinor > r.amountMinor).length;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('budget.heading')),
        actions: const [LangButton()],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
            : _error != null
                ? ListView(
                    children: [
                      SizedBox(height: MediaQuery.of(context).size.height * 0.3),
                      Center(child: Text(l10n.t('err.load'),
                          style: const TextStyle(color: Tokens.gray500))),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // ── Summary cards row ────────────────────────
                      Row(
                        children: [
                          Expanded(child: _SummaryCard(
                            label: l10n.t('budget.total'),
                            value: '฿${_fmt(totalBudget)}',
                            color: const Color(0xFF2563EB),
                          )),
                          const SizedBox(width: 10),
                          Expanded(child: _SummaryCard(
                            label: l10n.t('budget.spent'),
                            value: '฿${_fmt(totalSpent)}',
                            color: const Color(0xFF7C3AED),
                          )),
                          const SizedBox(width: 10),
                          Expanded(child: _SummaryCard(
                            label: l10n.t('budget.over'),
                            value: '$overCount',
                            color: overCount > 0 ? const Color(0xFFDC2626) : const Color(0xFF16A34A),
                          )),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // ── Department list ──────────────────────────
                      if (_rows.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 40),
                          child: Center(
                            child: Column(
                              children: [
                                const Icon(Icons.account_balance_wallet_outlined,
                                    size: 48, color: Color(0xFFD1D5DB)),
                                const SizedBox(height: 12),
                                Text(l10n.t('budget.empty'),
                                    style: const TextStyle(color: Tokens.gray500)),
                              ],
                            ),
                          ),
                        )
                      else
                        ...List.generate(_rows.length, (i) => Padding(
                          padding: EdgeInsets.only(bottom: i < _rows.length - 1 ? 10 : 0),
                          child: _BudgetCard(row: _rows[i], l10n: l10n),
                        )),
                    ],
                  ),
      ),
    );
  }

  String _fmt(int minor) {
    final baht = (minor / 100).round();
    if (baht >= 1000000) return '${(baht / 1000000).toStringAsFixed(1)}M';
    if (baht >= 1000) return '${(baht / 1000).toStringAsFixed(0)}K';
    return baht.toString();
  }
}

// ── Summary card ─────────────────────────────────────────────────────────────
class _SummaryCard extends StatelessWidget {
  const _SummaryCard({required this.label, required this.value, required this.color});
  final String label, value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: color.withAlpha(20),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 11, color: color.withAlpha(180))),
          ],
        ),
      ),
    );
  }
}

// ── Budget card per department ────────────────────────────────────────────────
class _BudgetCard extends StatelessWidget {
  const _BudgetCard({required this.row, required this.l10n});
  final BudgetRow row;
  final L10n l10n;

  @override
  Widget build(BuildContext context) {
    final pct = row.amountMinor > 0 ? (row.spentMinor / row.amountMinor) : 0.0;
    final over = pct > 1.0;
    final barColor = over
        ? const Color(0xFFDC2626)
        : pct > 0.8
            ? const Color(0xFFF59E0B)
            : const Color(0xFF16A34A);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: over ? const Color(0xFFFECACA) : Tokens.gray200),
      ),
      color: over ? const Color(0xFFFEF2F2) : Theme.of(context).colorScheme.surface,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: dept name + percentage
            Row(
              children: [
                Expanded(
                  child: Text(row.departmentName,
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: barColor.withAlpha(25),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '${(pct * 100).clamp(0, 999).toStringAsFixed(0)}%',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: barColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Progress bar
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: LinearProgressIndicator(
                value: pct.clamp(0.0, 1.0),
                minHeight: 8,
                backgroundColor: Tokens.gray200,
                valueColor: AlwaysStoppedAnimation(barColor),
              ),
            ),
            const SizedBox(height: 8),

            // Spent / Budget row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${l10n.t('budget.used')}: ฿${_fmt(row.spentMinor)}',
                  style: const TextStyle(fontSize: 13, color: Tokens.gray500),
                ),
                Text(
                  '${l10n.t('budget.limit')}: ฿${_fmt(row.amountMinor)}',
                  style: const TextStyle(fontSize: 13, color: Tokens.gray500),
                ),
              ],
            ),

            if (row.softBlock) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.block, size: 14, color: Color(0xFFDC2626)),
                  const SizedBox(width: 4),
                  Text(l10n.t('budget.soft_block'),
                      style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _fmt(int minor) {
    final baht = (minor / 100).round();
    if (baht >= 1000000) return '${(baht / 1000000).toStringAsFixed(1)}M';
    if (baht >= 1000) return '${(baht / 1000).toStringAsFixed(0)}K';
    return baht.toString();
  }
}
