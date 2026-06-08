import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

/// Purchase Orders — list view with status chips + inline search, Shopee-style.
class PoListPage extends StatefulWidget {
  const PoListPage({super.key});

  @override
  State<PoListPage> createState() => _PoListPageState();
}

class _PoListPageState extends State<PoListPage> {
  List<PoSummary> _all = [];
  bool _loading = true;
  String _filter = 'all';
  final _searchCtrl = TextEditingController();
  String _query = '';
  Timer? _debounce;

  static const _filters = ['all', 'draft', 'sent', 'acknowledged', 'completed', 'cancelled'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _all = await Api.listPo();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = value.toLowerCase());
    });
  }

  List<PoSummary> get _filtered {
    var list = _filter == 'all' ? _all : _all.where((p) => p.status == _filter).toList();
    if (_query.isNotEmpty) {
      list = list.where((p) =>
        p.poNumber.toLowerCase().contains(_query) ||
        (p.supplierName?.toLowerCase().contains(_query) ?? false)
      ).toList();
    }
    return list;
  }

  int _countFor(String f) =>
      f == 'all' ? _all.length : _all.where((p) => p.status == f).length;

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final filtered = _filtered;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('po_title')),
        actions: const [LangButton()],
      ),
      body: Column(
        children: [
          // ── Search bar ───────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              controller: _searchCtrl,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: l10n.t('pr.list.search_hint'),
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _query = '');
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

          // ── Filter chips ─────────────────────────────────
          SizedBox(
            height: 52,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: _filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final f = _filters[i];
                final active = f == _filter;
                final count = _countFor(f);
                final color = _filterColor(f);
                return GestureDetector(
                  onTap: () => setState(() => _filter = f),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? color : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: active ? color : const Color(0xFFD1D5DB),
                        width: active ? 1.5 : 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          l10n.t('po_filter_$f'),
                          style: TextStyle(
                            color: active ? Colors.white : Tokens.gray700,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        if (count > 0) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color: active ? Colors.white.withAlpha(50) : color.withAlpha(20),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '$count',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: active ? Colors.white : color,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // ── List ─────────────────────────────────────────
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                  : filtered.isEmpty
                      ? ListView(
                          children: [
                            SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                            Center(
                              child: Column(
                                children: [
                                  const Icon(Icons.receipt_long, size: 48, color: Color(0xFFD1D5DB)),
                                  const SizedBox(height: 12),
                                  Text(l10n.t('no_data'),
                                      style: const TextStyle(color: Tokens.gray500)),
                                ],
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                          itemCount: filtered.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) => _PoCard(po: filtered[i]),
                        ),
            ),
          ),
        ],
      ),
    );
  }

  Color _filterColor(String f) => switch (f) {
    'all'          => Tokens.brand600,
    'draft'        => Tokens.gray500,
    'sent'         => const Color(0xFF2563EB),
    'acknowledged' => const Color(0xFF0D9488),
    'completed'    => const Color(0xFF16A34A),
    'cancelled'    => const Color(0xFFDC2626),
    _              => Tokens.gray500,
  };
}

class _PoCard extends StatelessWidget {
  const _PoCard({required this.po});
  final PoSummary po;

  Color _statusColor(String s) => switch (s) {
    'draft'        => Tokens.gray500,
    'sent'         => const Color(0xFF2563EB),
    'acknowledged' => const Color(0xFF0D9488),
    'completed'    => const Color(0xFF16A34A),
    'cancelled'    => const Color(0xFFDC2626),
    _              => const Color(0xFFD97706),
  };

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final color = _statusColor(po.status);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Tokens.gray200),
      ),
      child: InkWell(
        onTap: () => context.push('/po/${po.id}'),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(po.poNumber,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                          color: Tokens.brand600, fontFamily: 'monospace')),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: color.withAlpha(20),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      l10n.t('po_status_${po.status}'),
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color),
                    ),
                  ),
                ],
              ),
              if (po.supplierName != null) ...[
                const SizedBox(height: 8),
                Row(children: [
                  const Icon(Icons.store, size: 14, color: Tokens.gray500),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(po.supplierName!,
                        style: const TextStyle(fontSize: 13, color: Tokens.gray500)),
                  ),
                ]),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  Text(
                    '${po.currency} ${(po.totalMinor / 100).toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  const Spacer(),
                  Text(_timeAgo(po.createdAt),
                      style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _timeAgo(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return '';
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    return '${diff.inDays}d';
  }
}
