import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

/// PR list — Shopee-style horizontal filter chips + inline search + pull-to-refresh.
class PrListPage extends StatefulWidget {
  const PrListPage({super.key});
  @override
  State<PrListPage> createState() => _PrListPageState();
}

class _PrListPageState extends State<PrListPage> {
  List<PrSummary> _all = [];
  bool _loading = true;
  String? _error;
  String _filter = 'all';
  String _sortOrder = 'newest'; // newest | oldest | amount
  final _searchCtrl = TextEditingController();
  String _query = '';
  Timer? _debounce;

  static final _baht = NumberFormat.currency(locale: 'en_US', symbol: '฿ ', decimalDigits: 2);

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
    setState(() { _loading = true; _error = null; });
    try {
      _all = await Api.listPr();
    } catch (e) {
      _error = '$e';
    }
    if (mounted) setState(() => _loading = false);
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = value.toLowerCase());
    });
  }

  List<PrSummary> get _filtered {
    var list = _filter == 'all' ? _all : _all.where((p) => p.status == _filter).toList();
    if (_query.isNotEmpty) {
      list = list.where((p) =>
        p.title.toLowerCase().contains(_query) ||
        p.prNumber.toLowerCase().contains(_query)
      ).toList();
    }
    // Sort
    switch (_sortOrder) {
      case 'oldest':
        list.sort((a, b) => a.createdAt.compareTo(b.createdAt));
        break;
      case 'amount':
        list.sort((a, b) => b.totalMinor.compareTo(a.totalMinor));
        break;
      default: // newest
        list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    }
    return list;
  }

  void _showSortMenu(BuildContext context) {
    final l10n = L10n.of(context);
    final opts = [
      ('newest', l10n.t('pr.list.sort.newest'), Icons.arrow_downward),
      ('oldest', l10n.t('pr.list.sort.oldest'), Icons.arrow_upward),
      ('amount', l10n.t('pr.list.sort.amount'), Icons.attach_money),
    ];
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 36, height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFD1D5DB),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              ...opts.map((o) {
                final (key, label, icon) = o;
                final selected = key == _sortOrder;
                return ListTile(
                  leading: Icon(icon,
                      color: selected ? Tokens.brand600 : Tokens.gray500),
                  title: Text(label,
                      style: TextStyle(
                        fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                        color: selected ? Tokens.brand600 : null,
                      )),
                  trailing: selected
                      ? const Icon(Icons.check, color: Tokens.brand600, size: 18)
                      : null,
                  onTap: () {
                    setState(() => _sortOrder = key);
                    Navigator.pop(context);
                  },
                );
              }),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final filtered = _filtered;

    final filters = [
      _FilterDef('all',      l10n.t('filter.all'),      Tokens.brand600),
      _FilterDef('pending',  l10n.t('status.pending'),   const Color(0xFFD97706)),
      _FilterDef('approved', l10n.t('status.approved'),  const Color(0xFF16A34A)),
      _FilterDef('rejected', l10n.t('status.rejected'),  const Color(0xFFDC2626)),
      _FilterDef('draft',    l10n.t('status.draft'),     Tokens.gray500),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('pr.list.heading')),
        actions: [
          IconButton(
            icon: Icon(
              Icons.sort,
              color: _sortOrder != 'newest' ? Tokens.brand600 : null,
            ),
            tooltip: l10n.t('pr.list.sort.newest'),
            onPressed: () => _showSortMenu(context),
          ),
          const LangButton(),
        ],
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

          // ── Shopee-style filter chips (horizontal scroll) ───
          SizedBox(
            height: 52,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final f = filters[i];
                final active = f.key == _filter;
                final count = f.key == 'all'
                    ? _all.length
                    : _all.where((p) => p.status == f.key).length;

                return GestureDetector(
                  onTap: () => setState(() => _filter = f.key),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? f.color : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: active ? f.color : const Color(0xFFD1D5DB),
                        width: active ? 1.5 : 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(f.label,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: active ? Colors.white : Tokens.gray700,
                            )),
                        if (count > 0) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color: active ? Colors.white.withAlpha(50) : f.color.withAlpha(20),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text('$count',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: active ? Colors.white : f.color,
                                )),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // ── Result count ───────────────────────────────────
          if (!_loading && _query.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  l10n.t('pr.list.results').replaceAll('{count}', '${filtered.length}'),
                  style: TextStyle(fontSize: 12, color: Tokens.gray500),
                ),
              ),
            ),

          // ── List body ──────────────────────────────────────
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                  : _error != null
                      ? Center(child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text('${l10n.t('err.load')}: $_error', textAlign: TextAlign.center),
                        ))
                      : filtered.isEmpty
                          ? ListView(
                              children: [
                                SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                                Center(
                                  child: Column(
                                    children: [
                                      Icon(Icons.inbox_outlined, size: 48, color: const Color(0xFFD1D5DB)),
                                      const SizedBox(height: 12),
                                      Text(
                                        _query.isNotEmpty
                                            ? l10n.t('pr.list.no_results')
                                            : l10n.t('pr.list.empty'),
                                        style: TextStyle(color: Tokens.gray500),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
                              itemCount: filtered.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 10),
                              itemBuilder: (_, i) => _PrCard(pr: filtered[i], formatter: _baht),
                            ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterDef {
  const _FilterDef(this.key, this.label, this.color);
  final String key, label;
  final Color color;
}

class _PrCard extends StatelessWidget {
  const _PrCard({required this.pr, required this.formatter});
  final PrSummary pr;
  final NumberFormat formatter;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Tokens.gray200),
      ),
      child: InkWell(
        onTap: () => context.push('/pr/${pr.id}'),
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(pr.prNumber,
                        style: TextStyle(fontSize: 12, color: Tokens.gray500, fontFamily: 'monospace')),
                  ),
                  _timeAgo(pr.createdAt),
                ],
              ),
              const SizedBox(height: 4),
              Text(pr.title,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _StatusChip(status: pr.status),
                  Text(formatter.format(pr.totalMinor / 100),
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _timeAgo(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) return const SizedBox.shrink();
    final diff = DateTime.now().difference(dt);
    String label;
    if (diff.inMinutes < 60) {
      label = '${diff.inMinutes}m';
    } else if (diff.inHours < 24) {
      label = '${diff.inHours}h';
    } else {
      label = '${diff.inDays}d';
    }
    return Text(label, style: TextStyle(fontSize: 12, color: Tokens.gray500));
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final label = l10n.t('status.$status', null) == 'status.$status'
        ? status
        : l10n.t('status.$status');
    final (bg, fg) = switch (status) {
      'pending'  => (const Color(0xFFFEF3C7), const Color(0xFF92400E)),
      'approved' => (const Color(0xFFDCFCE7), const Color(0xFF166534)),
      'rejected' => (const Color(0xFFFEE2E2), const Color(0xFF991B1B)),
      'draft'    => (Tokens.gray100,           Tokens.gray700),
      _          => (Tokens.gray100,           Tokens.gray700),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 12)),
    );
  }
}
