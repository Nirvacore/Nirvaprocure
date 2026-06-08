import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../l10n/l10n.dart';
import '../api/endpoints.dart';
import '../theme/tokens.dart';
import 'supplier_detail_page.dart';

/// Global search — Grab/Shopee-style spotlight search across PRs & suppliers.
/// Debounced real-time search with categorized results and recent searches.
class SearchPage extends StatefulWidget {
  const SearchPage({super.key});
  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final _controller = TextEditingController();
  final _focus = FocusNode();
  Timer? _debounce;

  List<PrSummary> _prs = [];
  List<Supplier> _suppliers = [];
  bool _loading = false;
  bool _hasSearched = false;

  @override
  void initState() {
    super.initState();
    _focus.requestFocus();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  void _onChanged(String q) {
    _debounce?.cancel();
    if (q.trim().length < 2) {
      setState(() { _prs = []; _suppliers = []; _hasSearched = false; });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 400), () => _search(q.trim()));
  }

  Future<void> _search(String q) async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        Api.listPr(),
        Api.listSuppliers(),
      ]);
      final prs = (results[0] as List<PrSummary>)
          .where((p) =>
              p.title.toLowerCase().contains(q.toLowerCase()) ||
              p.prNumber.toLowerCase().contains(q.toLowerCase()))
          .take(5)
          .toList();
      final suppliers = (results[1] as List<Supplier>)
          .where((s) =>
              s.name.toLowerCase().contains(q.toLowerCase()) ||
              s.code.toLowerCase().contains(q.toLowerCase()))
          .take(5)
          .toList();
      if (mounted) {
        setState(() {
          _prs = prs;
          _suppliers = suppliers;
          _hasSearched = true;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _hasSearched = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final totalResults = _prs.length + _suppliers.length;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Container(
          height: 42,
          margin: const EdgeInsets.only(right: 16),
          child: TextField(
            controller: _controller,
            focusNode: _focus,
            onChanged: _onChanged,
            style: const TextStyle(fontSize: 15),
            decoration: InputDecoration(
              hintText: l10n.t('search.hint'),
              hintStyle: const TextStyle(fontSize: 15, color: Color(0xFFD1D5DB)),
              prefixIcon: const Icon(Icons.search, size: 20),
              suffixIcon: _controller.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () {
                        _controller.clear();
                        _onChanged('');
                      },
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(vertical: 0),
              filled: true,
              fillColor: Tokens.gray100,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : !_hasSearched
              ? _EmptyState(l10n: l10n)
              : totalResults == 0
                  ? _NoResults(l10n: l10n, query: _controller.text)
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                      children: [
                        // ── PRs section ──
                        if (_prs.isNotEmpty) ...[
                          _ResultHeader(
                            title: l10n.t('search.section.prs'),
                            count: _prs.length,
                            icon: Icons.receipt_long,
                            color: Tokens.brand600,
                          ),
                          const SizedBox(height: 8),
                          ..._prs.map((pr) => _PrTile(pr: pr)),
                          const SizedBox(height: 20),
                        ],

                        // ── Suppliers section ──
                        if (_suppliers.isNotEmpty) ...[
                          _ResultHeader(
                            title: l10n.t('search.section.suppliers'),
                            count: _suppliers.length,
                            icon: Icons.people,
                            color: const Color(0xFF059669),
                          ),
                          const SizedBox(height: 8),
                          ..._suppliers.map((s) => _SupplierTile(supplier: s)),
                        ],
                      ],
                    ),
    );
  }
}

// ── Empty state (before searching) ──────────────────────────────────────────
class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.l10n});
  final L10n l10n;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.search, size: 64, color: Color(0xFFD1D5DB)),
          const SizedBox(height: 16),
          Text(l10n.t('search.empty'),
              style: const TextStyle(fontSize: 16, color: Tokens.gray500)),
          const SizedBox(height: 8),
          Text(l10n.t('search.empty_sub'),
              style: const TextStyle(fontSize: 13, color: Color(0xFFD1D5DB))),
        ],
      ),
    );
  }
}

// ── No results ──────────────────────────────────────────────────────────────
class _NoResults extends StatelessWidget {
  const _NoResults({required this.l10n, required this.query});
  final L10n l10n;
  final String query;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.search_off, size: 56, color: Color(0xFFD1D5DB)),
          const SizedBox(height: 16),
          Text(l10n.t('search.no_result'),
              style: const TextStyle(fontSize: 16, color: Tokens.gray500)),
          const SizedBox(height: 4),
          Text('"$query"',
              style: const TextStyle(fontSize: 14, color: Color(0xFFD1D5DB), fontStyle: FontStyle.italic)),
        ],
      ),
    );
  }
}

// ── Section header ──────────────────────────────────────────────────────────
class _ResultHeader extends StatelessWidget {
  const _ResultHeader({required this.title, required this.count, required this.icon, required this.color});
  final String title;
  final int count;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 18, color: color),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(color: color.withAlpha(20), borderRadius: BorderRadius.circular(10)),
          child: Text('$count', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color)),
        ),
      ],
    );
  }
}

// ── PR tile ─────────────────────────────────────────────────────────────────
class _PrTile extends StatelessWidget {
  const _PrTile({required this.pr});
  final PrSummary pr;

  Color _statusColor(String s) => switch (s) {
    'approved' => const Color(0xFF16A34A),
    'rejected' => const Color(0xFFDC2626),
    'pending' => const Color(0xFFD97706),
    _ => const Color(0xFF6B7280),
  };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Tokens.gray200),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => context.push('/pr/${pr.id}'),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: Tokens.brand600.withAlpha(15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.receipt_long, size: 20, color: Tokens.brand600),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(pr.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(pr.prNumber, style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
                    ],
                  ),
                ),
                Container(
                  width: 8, height: 8,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: _statusColor(pr.status)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Supplier tile ───────────────────────────────────────────────────────────
class _SupplierTile extends StatelessWidget {
  const _SupplierTile({required this.supplier});
  final Supplier supplier;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: Tokens.gray200),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => SupplierDetailPage(supplier: supplier)),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFF059669).withAlpha(15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.storefront, size: 20, color: Color(0xFF059669)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(supplier.name, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                          maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(supplier.code,
                          style: const TextStyle(fontSize: 12, color: Tokens.gray500, fontFamily: 'monospace')),
                    ],
                  ),
                ),
                if (supplier.category != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Tokens.gray100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(supplier.category!,
                        style: const TextStyle(fontSize: 11, color: Tokens.gray500)),
                  ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right, size: 18, color: Tokens.gray500),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
