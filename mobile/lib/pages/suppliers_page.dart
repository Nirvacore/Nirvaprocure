import 'dart:async';
import 'package:flutter/material.dart';
import '../l10n/l10n.dart';
import '../api/endpoints.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';
import 'supplier_detail_page.dart';

class SuppliersPage extends StatefulWidget {
  const SuppliersPage({super.key});
  @override
  State<SuppliersPage> createState() => _SuppliersPageState();
}

class _SuppliersPageState extends State<SuppliersPage> {
  List<Supplier> _all = [];
  List<Supplier> _filtered = [];
  bool _loading = true;
  String? _error;
  final _search = TextEditingController();
  String _query = '';
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await Api.listSuppliers();
      _all = data;
      _applyFilter();
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) {
        _query = value.toLowerCase();
        _applyFilter();
      }
    });
  }

  void _applyFilter() {
    setState(() {
      _filtered = _query.isEmpty
          ? List.of(_all)
          : _all.where((s) =>
                s.name.toLowerCase().contains(_query) ||
                s.code.toLowerCase().contains(_query) ||
                (s.contact?.toLowerCase().contains(_query) ?? false))
              .toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('suppliers.heading')),
        actions: const [LangButton()],
      ),
      body: Column(
        children: [
          // ── Search bar ──────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              controller: _search,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: l10n.t('suppliers.search'),
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () {
                          _search.clear();
                          _query = '';
                          _applyFilter();
                        },
                      )
                    : null,
                isDense: true,
                filled: true,
                fillColor: Tokens.gray100,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),

          // ── Risk tier legend ─────────────────────────────────────
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _LegendDot(color: const Color(0xFF22C55E), label: l10n.t('suppliers.risk.low')),
                const SizedBox(width: 12),
                _LegendDot(color: const Color(0xFFF59E0B), label: l10n.t('suppliers.risk.medium')),
                const SizedBox(width: 12),
                _LegendDot(color: const Color(0xFFF97316), label: l10n.t('suppliers.risk.high')),
                const SizedBox(width: 12),
                _LegendDot(color: const Color(0xFFEF4444), label: l10n.t('suppliers.risk.critical')),
              ],
            ),
          ),

          // ── Result count when searching ──────────────────────────
          if (!_loading && _query.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  '${_filtered.length} / ${_all.length}',
                  style: const TextStyle(fontSize: 12, color: Tokens.gray500),
                ),
              ),
            ),

          const Divider(height: 1),

          // ── List ────────────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : _error != null
                    ? Center(child: Text(l10n.t('err.load')))
                    : _filtered.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.people_outline, size: 48, color: Color(0xFFD1D5DB)),
                                const SizedBox(height: 12),
                                Text(
                                  _query.isNotEmpty
                                      ? l10n.t('search.no_result')
                                      : l10n.t('suppliers.empty'),
                                  style: const TextStyle(color: Tokens.gray500),
                                ),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: _filtered.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (_, i) => _SupplierCard(supplier: _filtered[i], l10n: l10n),
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

// ── Legend dot ────────────────────────────────────────────────────────────────
class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});
  final Color color;
  final String label;
  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 11)),
      ],
    );
  }
}

// ── Supplier card ────────────────────────────────────────────────────────────
class _SupplierCard extends StatelessWidget {
  const _SupplierCard({required this.supplier, required this.l10n});
  final Supplier supplier;
  final L10n l10n;

  Color get _riskColor {
    switch (supplier.riskTier) {
      case 'low':      return const Color(0xFF22C55E);
      case 'medium':   return const Color(0xFFF59E0B);
      case 'high':     return const Color(0xFFF97316);
      case 'critical': return const Color(0xFFEF4444);
      default:         return Tokens.gray500;
    }
  }

  Color get _riskBg {
    switch (supplier.riskTier) {
      case 'low':      return const Color(0xFFF0FDF4);
      case 'medium':   return const Color(0xFFFEFCE8);
      case 'high':     return const Color(0xFFFFF7ED);
      case 'critical': return const Color(0xFFFEF2F2);
      default:         return Tokens.gray100;
    }
  }

  String get _riskLabel {
    switch (supplier.riskTier) {
      case 'low':      return l10n.t('suppliers.risk.low');
      case 'medium':   return l10n.t('suppliers.risk.medium');
      case 'high':     return l10n.t('suppliers.risk.high');
      case 'critical': return l10n.t('suppliers.risk.critical');
      default:         return '—';
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => SupplierDetailPage(supplier: supplier)),
      ),
      child: Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Tokens.gray200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // name + risk badge
            Row(
              children: [
                Expanded(
                  child: Text(supplier.name,
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _riskBg,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(width: 8, height: 8, decoration: BoxDecoration(color: _riskColor, shape: BoxShape.circle)),
                      const SizedBox(width: 6),
                      Text(_riskLabel, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _riskColor)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // code + category
            Row(
              children: [
                const Icon(Icons.badge_outlined, size: 14, color: Tokens.gray500),
                const SizedBox(width: 4),
                Text(supplier.code, style: const TextStyle(fontSize: 13, color: Tokens.gray500)),
                if (supplier.category != null) ...[
                  const SizedBox(width: 12),
                  const Icon(Icons.category_outlined, size: 14, color: Tokens.gray500),
                  const SizedBox(width: 4),
                  Text(supplier.category!, style: const TextStyle(fontSize: 13, color: Tokens.gray500)),
                ],
              ],
            ),
            if (supplier.contact != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.email_outlined, size: 14, color: Tokens.gray500),
                  const SizedBox(width: 4),
                  Text(supplier.contact!, style: const TextStyle(fontSize: 13, color: Tokens.gray500)),
                ],
              ),
            ],
            if (supplier.totalPrCount > 0) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  _Chip(icon: Icons.receipt_long, label: '${supplier.totalPrCount} PRs'),
                  const SizedBox(width: 8),
                  _Chip(icon: Icons.payments_outlined,
                      label: '฿${(supplier.totalSpentMinor / 100).toStringAsFixed(0)}'),
                ],
              ),
            ],
          ],
        ),
      ),
    ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label});
  final IconData icon;
  final String label;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Tokens.gray100,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: Tokens.gray500),
          const SizedBox(width: 4),
          Text(label, style: TextStyle(fontSize: 12, color: Tokens.gray700)),
        ],
      ),
    );
  }
}
