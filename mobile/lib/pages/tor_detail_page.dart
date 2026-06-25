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
  bool _workflowBusy = false;

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

  String? _advanceKey(String status) => switch (status) {
        'draft' => 'tor.action.submit_review',
        'review' => 'tor.action.approve',
        'approved' => 'tor.action.archive',
        _ => null,
      };

  String? _revertKey(String status) => switch (status) {
        'review' => 'tor.action.send_back',
        _ => null,
      };

  Future<void> _advance() async {
    final l10n = L10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _workflowBusy = true);
    try {
      final updated = await Api.advanceTorDraft(widget.id);
      if (!mounted) return;
      setState(() => _draft = updated);
      messenger.showSnackBar(SnackBar(content: Text(l10n.t('tor.toast.status'))));
    } catch (err) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('${l10n.t('common.error')}: $err'),
          backgroundColor: Tokens.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _workflowBusy = false);
    }
  }

  Future<void> _revert() async {
    final l10n = L10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _workflowBusy = true);
    try {
      final updated = await Api.revertTorDraft(widget.id);
      if (!mounted) return;
      setState(() => _draft = updated);
      messenger.showSnackBar(SnackBar(content: Text(l10n.t('tor.toast.status'))));
    } catch (err) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('${l10n.t('common.error')}: $err'),
          backgroundColor: Tokens.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _workflowBusy = false);
    }
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
    final advanceKey = _advanceKey(draft.status);
    final revertKey = _revertKey(draft.status);
    final hasActions = advanceKey != null || revertKey != null;

    return Scaffold(
      appBar: AppBar(title: Text(draft.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
      bottomNavigationBar: hasActions
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: Row(
                  children: [
                    if (revertKey != null) ...[
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _workflowBusy ? null : _revert,
                          icon: _workflowBusy
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.undo, size: 18),
                          label: Text(l10n.t(revertKey)),
                        ),
                      ),
                      if (advanceKey != null) const SizedBox(width: 10),
                    ],
                    if (advanceKey != null)
                      Expanded(
                        flex: revertKey != null ? 1 : 1,
                        child: FilledButton.icon(
                          onPressed: _workflowBusy ? null : _advance,
                          icon: _workflowBusy && revertKey == null
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.arrow_forward, size: 18),
                          label: Text(l10n.t(advanceKey)),
                        ),
                      ),
                  ],
                ),
              ),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: EdgeInsets.fromLTRB(16, 16, 16, hasActions ? 8 : 16),
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
                (e) => _checklistRow(e.key, e.value, l10n),
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

  String _checklistLabel(String key, L10n l10n) {
    final mapped = switch (key) {
      'scope' => 'tor.checklist.scope',
      'budget' => 'tor.checklist.budget',
      'deliverables' => 'tor.checklist.deliverables',
      'evaluation' => 'tor.checklist.evaluation',
      'timeline' => 'tor.checklist.timeline',
      'qualifications' => 'tor.checklist.qualifications',
      _ => null,
    };
    return mapped != null ? l10n.t(mapped) : key;
  }

  Widget _checklistRow(String key, String status, L10n l10n) {
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
          Expanded(child: Text(_checklistLabel(key, l10n), style: const TextStyle(fontSize: 14))),
        ],
      ),
    );
  }
}
