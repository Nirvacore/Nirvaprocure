import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class TorListPage extends StatefulWidget {
  const TorListPage({super.key});

  @override
  State<TorListPage> createState() => _TorListPageState();
}

class _TorListPageState extends State<TorListPage> {
  List<TorListItem> _all = [];
  bool _loading = true;
  String? _error;
  String _filter = 'all';
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _all = await Api.listTorDrafts();
    } catch (e) {
      _error = '$e';
    }
    if (mounted) setState(() => _loading = false);
  }

  List<TorListItem> get _filtered {
    var list = _filter == 'all'
        ? _all
        : _all.where((row) => row.status == _filter).toList();
    final q = _query.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list
          .where((row) => row.title.toLowerCase().contains(q))
          .toList();
    }
    list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final filters = [
      ('all', l10n.t('po_filter_all')),
      ('draft', l10n.t('tor.status.draft')),
      ('review', l10n.t('tor.status.review')),
      ('approved', l10n.t('tor.status.approved')),
      ('published', l10n.t('tor.status.published')),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('tor.list.heading')),
        actions: const [LangButton()],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/gov/tor/new'),
        icon: const Icon(Icons.add),
        label: Text(l10n.t('tor.list.new')),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: l10n.t('tor.list.search_hint'),
                prefixIcon: const Icon(Icons.search, size: 20),
                isDense: true,
                filled: true,
                fillColor: Tokens.gray50,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final (key, label) = filters[i];
                final selected = _filter == key;
                return FilterChip(
                  label: Text(label),
                  selected: selected,
                  onSelected: (_) => setState(() => _filter = key),
                  selectedColor: Tokens.brand50,
                  checkmarkColor: Tokens.brand600,
                  labelStyle: TextStyle(
                    color: selected ? Tokens.brand700 : Tokens.gray600,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : _error != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(_error!, textAlign: TextAlign.center),
                            const SizedBox(height: 12),
                            IconButton(
                              onPressed: _load,
                              icon: const Icon(Icons.refresh),
                              tooltip: l10n.t('common.error'),
                            ),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: _filtered.isEmpty
                            ? ListView(
                                children: [
                                  SizedBox(
                                    height: MediaQuery.of(context).size.height * 0.4,
                                    child: Center(
                                      child: Text(
                                        l10n.t('tor.list.empty'),
                                        style: const TextStyle(color: Tokens.gray500),
                                      ),
                                    ),
                                  ),
                                ],
                              )
                            : ListView.separated(
                                padding: const EdgeInsets.all(16),
                                itemCount: _filtered.length,
                                separatorBuilder: (_, __) => const SizedBox(height: 10),
                                itemBuilder: (_, i) => _TorCard(
                                  row: _filtered[i],
                                  onTap: () => context.push('/gov/tor/${_filtered[i].id}'),
                                ),
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _TorCard extends StatelessWidget {
  const _TorCard({required this.row, required this.onTap});
  final TorListItem row;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final date = DateTime.tryParse(row.createdAt);
    final fmtDate = date != null
        ? DateFormat.yMMMd(l10n.locale.languageCode).format(date)
        : row.createdAt;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).cardColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Tokens.gray200),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: Tokens.brand50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.balance, color: Tokens.brand600, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    row.title,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      _chip(l10n.t(_kindKey(row.procurementKind)), Tokens.gray100, Tokens.gray700),
                      _chip(l10n.t(_statusKey(row.status)), ..._statusColors(row.status)),
                      if (row.linkedPrId != null)
                        _chip(
                          l10n.t('tor.linked_pr.badge', {
                            'number': row.linkedPrNumber ?? row.linkedPrId!,
                          }),
                          const Color(0xFFDBEAFE),
                          const Color(0xFF1D4ED8),
                          icon: Icons.shopping_cart_outlined,
                        ),
                      Text(fmtDate, style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: Tokens.gray400),
          ],
        ),
      ),
    );
  }

  String _kindKey(String kind) => switch (kind) {
        'services' => 'tor.kind.services',
        'construction' => 'tor.kind.construction',
        _ => 'tor.kind.goods',
      };

  String _statusKey(String status) => switch (status) {
        'review' => 'tor.status.review',
        'approved' => 'tor.status.approved',
        'published' => 'tor.status.published',
        _ => 'tor.status.draft',
      };

  List<Color> _statusColors(String status) => switch (status) {
        'review' => [const Color(0xFFFEF3C7), const Color(0xFFB45309)],
        'approved' => [const Color(0xFFD1FAE5), const Color(0xFF047857)],
        'published' => [const Color(0xFFE0E7FF), const Color(0xFF4338CA)],
        _ => [Tokens.gray100, Tokens.gray700],
      };

  Widget _chip(String label, Color bg, Color fg, {IconData? icon}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: fg),
            const SizedBox(width: 4),
          ],
          Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
        ],
      ),
    );
  }
}
