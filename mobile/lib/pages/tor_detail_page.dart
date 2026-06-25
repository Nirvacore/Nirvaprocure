import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';

class TorDetailPage extends StatefulWidget {
  const TorDetailPage({super.key, required this.id});
  final String id;

  @override
  State<TorDetailPage> createState() => _TorDetailPageState();
}

class _TorDetailPageState extends State<TorDetailPage> {
  TorDraft? _draft;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _draft = await Api.getTorDraft(widget.id);
    } catch (_) {
      _draft = null;
    }
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);

    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.t('tor.list.heading'))),
        body: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    final draft = _draft;
    if (draft == null) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.t('tor.list.heading'))),
        body: Center(child: Text(l10n.t('err.load'))),
      );
    }

    final date = DateTime.tryParse(draft.createdAt);
    final fmtDate = date != null
        ? DateFormat.yMMMd(l10n.locale.languageCode).add_jm().format(date)
        : draft.createdAt;

    return Scaffold(
      appBar: AppBar(title: Text(draft.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                _statusBadge(draft.status, l10n),
                const SizedBox(width: 8),
                _kindBadge(draft.procurementKind, l10n),
                const Spacer(),
                Text(fmtDate, style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
              ],
            ),
            if (draft.linkedPrId != null) ...[
              const SizedBox(height: 16),
              InkWell(
                onTap: () => context.push('/pr/${draft.linkedPrId}'),
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Theme.of(context).cardColor,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Tokens.gray200),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFFDBEAFE),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.shopping_cart_outlined, color: Color(0xFF1D4ED8)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l10n.t('tor.linked_pr.title'),
                              style: const TextStyle(fontSize: 12, color: Tokens.gray500),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              draft.linkedPrNumber ?? draft.linkedPrId!,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              l10n.t('tor.linked_pr.view'),
                              style: const TextStyle(fontSize: 13, color: Tokens.brand600),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right, color: Tokens.gray400),
                    ],
                  ),
                ),
              ),
            ],
            const SizedBox(height: 16),
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: const BorderSide(color: Tokens.gray200),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: draft.bodyMarkdown?.trim().isNotEmpty == true
                    ? Text(
                        draft.bodyMarkdown!,
                        style: const TextStyle(fontSize: 14, height: 1.5),
                      )
                    : Text(
                        l10n.t('tor.detail.no_body'),
                        style: const TextStyle(color: Tokens.gray500),
                      ),
              ),
            ),
            if (draft.complianceChecklist.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(
                l10n.t('tor.checklist.title'),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              ...draft.complianceChecklist.entries.map(
                (e) => _checklistRow(e.key, e.value),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _statusBadge(String status, L10n l10n) {
    final label = switch (status) {
      'review' => l10n.t('tor.status.review'),
      'approved' => l10n.t('tor.status.approved'),
      'published' => l10n.t('tor.status.published'),
      _ => l10n.t('tor.status.draft'),
    };
    final colors = switch (status) {
      'review' => (const Color(0xFFFEF3C7), const Color(0xFFB45309)),
      'approved' => (const Color(0xFFD1FAE5), const Color(0xFF047857)),
      'published' => (const Color(0xFFE0E7FF), const Color(0xFF4338CA)),
      _ => (Tokens.gray100, Tokens.gray700),
    };
    return _pill(label, colors.$1, colors.$2);
  }

  Widget _kindBadge(String kind, L10n l10n) {
    final label = switch (kind) {
      'services' => l10n.t('tor.kind.services'),
      'construction' => l10n.t('tor.kind.construction'),
      _ => l10n.t('tor.kind.goods'),
    };
    return _pill(label, Tokens.gray100, Tokens.gray700);
  }

  Widget _pill(String label, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
    );
  }

  Widget _checklistRow(String key, String status) {
    final icon = switch (status) {
      'passed' => (Icons.check_circle, Tokens.success),
      'failed' => (Icons.cancel, Tokens.danger),
      _ => (Icons.remove_circle_outline, Tokens.gray400),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon.$1, size: 20, color: icon.$2),
          const SizedBox(width: 10),
          Expanded(child: Text(key, style: const TextStyle(fontSize: 14))),
        ],
      ),
    );
  }
}
