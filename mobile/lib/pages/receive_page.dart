import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../api/api_client.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

/// Goods Received (GR) page — confirms delivery of approved PRs.
/// Shows only approved PRs. User selects one, sees line items with quantities,
/// taps "Confirm Received" to mark it completed and update stock.
class ReceivePage extends StatefulWidget {
  const ReceivePage({super.key});
  @override
  State<ReceivePage> createState() => _ReceivePageState();
}

class _ReceivePageState extends State<ReceivePage> {
  List<PrSummary> _approved = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final all = await Api.listPr();
      _approved = all.where((p) => p.status == 'approved').toList();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('gr.heading')),
        actions: const [LangButton()],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
            : _approved.isEmpty
                ? ListView(children: [
                    SizedBox(height: MediaQuery.of(context).size.height * 0.3),
                    Center(
                      child: Column(children: [
                        const Icon(Icons.check_circle_outline, size: 56, color: Color(0xFFD1D5DB)),
                        const SizedBox(height: 12),
                        Text(l10n.t('gr.empty'),
                            style: const TextStyle(fontSize: 16, color: Tokens.gray500)),
                        const SizedBox(height: 4),
                        Text(l10n.t('gr.empty_sub'),
                            style: const TextStyle(fontSize: 13, color: Color(0xFFD1D5DB))),
                      ]),
                    ),
                  ])
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _approved.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _ApprovedPrCard(
                      pr: _approved[i],
                      onReceived: _load,
                    ),
                  ),
      ),
    );
  }
}

class _ApprovedPrCard extends StatefulWidget {
  const _ApprovedPrCard({required this.pr, required this.onReceived});
  final PrSummary pr;
  final VoidCallback onReceived;

  @override
  State<_ApprovedPrCard> createState() => _ApprovedPrCardState();
}

class _ApprovedPrCardState extends State<_ApprovedPrCard> {
  bool _expanded = false;
  bool _confirming = false;
  Map<String, dynamic>? _detail;
  bool _loadingDetail = false;

  Future<void> _loadDetail() async {
    if (_detail != null) return;
    setState(() => _loadingDetail = true);
    try {
      final res = await ApiClient.instance.raw.get('/pr/${widget.pr.id}');
      _detail = res.data as Map<String, dynamic>;
    } catch (_) {}
    if (mounted) setState(() => _loadingDetail = false);
  }

  Future<void> _confirmReceive() async {
    final l10n = L10n.of(context);
    final messenger = ScaffoldMessenger.of(context);

    // Show confirmation dialog
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(l10n.t('gr.confirm_title')),
        content: Text(l10n.t('gr.confirm_msg').replaceAll('{pr}', widget.pr.prNumber)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.t('common.back')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Tokens.success,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            child: Text(l10n.t('gr.confirm_btn')),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _confirming = true);
    try {
      // Build line items from detail
      final items = (_detail?['items'] as List?) ?? [];
      final lines = items
          .where((it) => (it as Map)['item_id'] != null)
          .map((it) {
            final m = it as Map<String, dynamic>;
            return {
              'line_item_id': m['id'],
              'item_id': m['item_id'],
              'quantity': m['quantity'],
            };
          })
          .toList();

      await ApiClient.instance.raw.post('/pr/${widget.pr.id}/receive', data: {
        'warehouse_id': 'default', // Will use the first warehouse
        'lines': lines,
      });

      messenger.showSnackBar(SnackBar(
        content: Text(l10n.t('gr.toast.success').replaceAll('{pr}', widget.pr.prNumber)),
        backgroundColor: Tokens.success,
      ));
      widget.onReceived();
    } catch (e) {
      messenger.showSnackBar(SnackBar(
        content: Text(l10n.t('gr.toast.fail')),
        backgroundColor: Tokens.danger,
      ));
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFBBF7D0)),
      ),
      child: Column(
        children: [
          // ── Header (always visible) ──
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () {
              setState(() => _expanded = !_expanded);
              if (_expanded) _loadDetail();
            },
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.local_shipping, color: Color(0xFF16A34A), size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.pr.title,
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 2),
                        Text(widget.pr.prNumber,
                            style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
                      ],
                    ),
                  ),
                  Icon(_expanded ? Icons.expand_less : Icons.expand_more,
                      color: Tokens.gray500),
                ],
              ),
            ),
          ),

          // ── Expanded detail ──
          if (_expanded) ...[
            const Divider(height: 1, indent: 16, endIndent: 16),
            if (_loadingDetail)
              const Padding(
                padding: EdgeInsets.all(20),
                child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
              )
            else if (_detail != null) ...[
              // Line items
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                child: Text(l10n.t('detail.items'),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tokens.gray500)),
              ),
              ...(_detail!['items'] as List? ?? []).map((it) {
                final m = it as Map<String, dynamic>;
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.inventory_2_outlined, size: 18, color: Tokens.gray500),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(m['description'] as String? ?? '—',
                            style: const TextStyle(fontSize: 14)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Tokens.gray100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text('× ${m['quantity']}',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                );
              }),

              // Confirm button
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
                child: SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: _confirming ? null : _confirmReceive,
                    icon: _confirming
                        ? const SizedBox(width: 18, height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.check_circle, size: 20),
                    label: Text(_confirming ? l10n.t('common.loading') : l10n.t('gr.confirm_btn')),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Tokens.success,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}
