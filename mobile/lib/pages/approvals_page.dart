import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class ApprovalsPage extends StatefulWidget {
  const ApprovalsPage({super.key});
  @override
  State<ApprovalsPage> createState() => _ApprovalsPageState();
}

class _ApprovalsPageState extends State<ApprovalsPage> {
  late Future<List<InboxEntry>> _future;
  static final _baht = NumberFormat.currency(locale: 'en_US', symbol: '฿ ', decimalDigits: 2);

  @override
  void initState() {
    super.initState();
    _future = Api.approvalsInbox();
  }

  Future<void> _refresh() async {
    setState(() => _future = Api.approvalsInbox());
    await _future;
  }

  /// Show confirmation dialog before rejecting.
  Future<bool> _confirmReject(InboxEntry item) async {
    final l10n = L10n.of(context);
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(l10n.t('approvals.reject_confirm_title')),
        content: Text(
          l10n.t('approvals.reject_confirm_body')
              .replaceAll('{title}', item.pr.title)
              .replaceAll('{amount}', _baht.format(item.pr.totalMinor / 100)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.t('common.cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: Tokens.danger),
            child: Text(l10n.t('approvals.reject')),
          ),
        ],
      ),
    );
    return result ?? false;
  }

  /// Optimistic decide with undo: remove the card immediately, show a
  /// SnackBar with UNDO, fire the API only if the user doesn't undo.
  Future<void> _decide(InboxEntry item, String decision) async {
    // For reject, confirm first
    if (decision == 'rejected') {
      final confirmed = await _confirmReject(item);
      if (!confirmed) return;
    }

    // Capture context-dependent objects before any async gap.
    final l10n     = L10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final list      = await _future;
    setState(() => _future = Future.value(
      list.where((e) => e.instanceId != item.instanceId).toList(),
    ));

    final statusKey = decision == 'approved' ? 'status.approved' : 'status.rejected';
    final controller = messenger.showSnackBar(SnackBar(
      content: Text('${item.pr.title} · ${l10n.t(statusKey)}'),
      duration: const Duration(seconds: 5),
      action: SnackBarAction(
        label: l10n.t('common.undo'),
        onPressed: () { /* closed reason = action, handled below */ },
      ),
    ));

    final reason = await controller.closed;
    if (reason == SnackBarClosedReason.action) {
      _refresh();
      return;
    }

    try {
      await Api.decide(item.instanceId, decision);
    } catch (e) {
      messenger.showSnackBar(SnackBar(
        content: Text('${l10n.t('err.load')}: $e'),
        backgroundColor: Tokens.danger,
      ));
      _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('approvals.heading')),
        actions: const [LangButton()],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<InboxEntry>>(
          future: _future,
          builder: (context, snap) {
            if (snap.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator(strokeWidth: 2));
            }
            if (snap.hasError) {
              return Center(child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text('${l10n.t('err.load')}: ${snap.error}',
                    textAlign: TextAlign.center),
              ));
            }
            final rows = snap.data ?? [];
            if (rows.isEmpty) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('🎉', style: TextStyle(fontSize: 48)),
                      const SizedBox(height: 8),
                      Text(l10n.t('approvals.empty'),
                          style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 4),
                      Text(l10n.t('approvals.empty.sub'),
                          style: const TextStyle(color: Tokens.gray500)),
                    ],
                  ),
                ),
              );
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Swipe hint
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
                  child: Row(
                    children: [
                      const Icon(Icons.swipe, size: 16, color: Tokens.gray500),
                      const SizedBox(width: 6),
                      Text(
                        l10n.t('approvals.swipe_hint'),
                        style: const TextStyle(fontSize: 12, color: Tokens.gray500),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (_, i) {
                      final entry = rows[i];
                      return Dismissible(
                        key: ValueKey(entry.instanceId),
                        // ── Swipe right → approve ─────────
                        background: Container(
                          alignment: Alignment.centerLeft,
                          padding: const EdgeInsets.only(left: 24),
                          decoration: BoxDecoration(
                            color: Tokens.success,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.check, color: Colors.white, size: 28),
                              const SizedBox(width: 8),
                              Text(l10n.t('approvals.approve'),
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                            ],
                          ),
                        ),
                        // ── Swipe left → reject ──────────
                        secondaryBackground: Container(
                          alignment: Alignment.centerRight,
                          padding: const EdgeInsets.only(right: 24),
                          decoration: BoxDecoration(
                            color: Tokens.danger,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(l10n.t('approvals.reject'),
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                              const SizedBox(width: 8),
                              const Icon(Icons.close, color: Colors.white, size: 28),
                            ],
                          ),
                        ),
                        confirmDismiss: (direction) async {
                          if (direction == DismissDirection.startToEnd) {
                            _decide(entry, 'approved');
                            return false; // we handle removal ourselves (optimistic)
                          } else {
                            _decide(entry, 'rejected');
                            return false;
                          }
                        },
                        child: _InboxCard(
                          entry: entry,
                          baht: _baht,
                          onApprove: () => _decide(entry, 'approved'),
                          onReject:  () => _decide(entry, 'rejected'),
                        ),
                      );
                    },
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _InboxCard extends StatelessWidget {
  const _InboxCard({
    required this.entry, required this.baht,
    required this.onApprove, required this.onReject,
  });
  final InboxEntry entry;
  final NumberFormat baht;
  final VoidCallback onApprove, onReject;

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final pr   = entry.pr;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: entry.urgent ? const Color(0xFFFCD34D) : Tokens.gray200),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/pr/${pr.id}'),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (entry.urgent) ...[
                Row(children: [
                  const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFB45309)),
                  const SizedBox(width: 6),
                  Text(l10n.t('approvals.urgent'),
                    style: const TextStyle(
                        color: Color(0xFF92400E), fontWeight: FontWeight.w600, fontSize: 13)),
                ]),
                const SizedBox(height: 8),
              ],
              Text(pr.prNumber, style: const TextStyle(color: Tokens.gray500, fontSize: 12)),
              const SizedBox(height: 2),
              Text(pr.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(l10n.t('approvals.step_n', {'n': '${entry.stepNo}'}),
                      style: const TextStyle(color: Tokens.gray500, fontSize: 13)),
                  Text(baht.format(pr.totalMinor / 100),
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 16),
              Row(children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: onApprove,
                    icon: const Icon(Icons.check),
                    label: Text(l10n.t('approvals.approve')),
                    style: ElevatedButton.styleFrom(backgroundColor: Tokens.success),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: onReject,
                    icon: const Icon(Icons.close, color: Tokens.danger),
                    label: Text(l10n.t('approvals.reject'),
                        style: const TextStyle(color: Tokens.danger)),
                    style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFFCA5A5), width: 2)),
                  ),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
  }
}
