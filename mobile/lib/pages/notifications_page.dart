import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../l10n/l10n.dart';
import '../api/endpoints.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List<AppNotification> _items = [];
  bool _loading = true;
  String? _error;
  bool _lineLinked = false;
  bool _unreadOnly = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        Api.listNotifications(),
        Api.lineStatus(),
      ]);
      _items = results[0] as List<AppNotification>;
      _lineLinked = results[1] as bool;
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<AppNotification> get _filtered =>
      _unreadOnly ? _items.where((n) => n.readAt == null).toList() : _items;

  bool get _hasUnread => _items.any((n) => n.readAt == null);

  Future<void> _markAllRead() async {
    try {
      await Api.markAllNotificationsRead();
      setState(() {
        _items = _items
            .map((n) => AppNotification(
                  id: n.id, type: n.type, title: n.title, body: n.body,
                  createdAt: n.createdAt,
                  readAt: n.readAt ?? DateTime.now().toIso8601String(),
                  refId: n.refId,
                ))
            .toList();
      });
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(L10n.of(context).t('err.load'))),
        );
      }
    }
  }

  void _onTap(AppNotification n) {
    // Mark as read optimistically
    if (n.readAt == null) {
      Api.markNotificationRead(n.id).catchError((_) {});
      final idx = _items.indexWhere((x) => x.id == n.id);
      if (idx >= 0) {
        setState(() {
          _items[idx] = AppNotification(
            id: n.id, type: n.type, title: n.title, body: n.body,
            createdAt: n.createdAt, readAt: DateTime.now().toIso8601String(),
            refId: n.refId,
          );
        });
      }
    }

    // Navigate based on type + refId
    if (n.refId == null) return;
    final ref = n.refId!;
    switch (n.type) {
      case 'approval_needed':
      case 'pr_approved':
      case 'pr_rejected':
      case 'pr_submitted':
      case 'comment':
        context.push('/pr/$ref');
        break;
      case 'po_status_changed':
      case 'po_created':
        context.push('/po/$ref');
        break;
      case 'stock_low':
        context.push('/stock');
        break;
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final filtered = _filtered;
    final unreadCount = _items.where((n) => n.readAt == null).length;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('notif.heading')),
        actions: [
          if (!_loading && _hasUnread)
            IconButton(
              icon: const Icon(Icons.done_all, size: 22),
              tooltip: l10n.t('notif.mark_all_read'),
              onPressed: _markAllRead,
            ),
          const LangButton(),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : _error != null
              ? Center(child: Text(l10n.t('err.load')))
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // ── LINE status card ────────────────────────────
                      _LineStatusCard(linked: _lineLinked, l10n: l10n),
                      const SizedBox(height: 16),

                      // ── Section header + unread filter ──────────────
                      Row(
                        children: [
                          Expanded(
                            child: Text(l10n.t('notif.recent'),
                                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                          ),
                          // Unread-only toggle chip
                          GestureDetector(
                            onTap: () => setState(() => _unreadOnly = !_unreadOnly),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: _unreadOnly ? const Color(0xFF2563EB) : Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: _unreadOnly
                                      ? const Color(0xFF2563EB)
                                      : const Color(0xFFD1D5DB),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.circle, size: 8,
                                      color: _unreadOnly
                                          ? Colors.white
                                          : const Color(0xFF2563EB)),
                                  const SizedBox(width: 6),
                                  Text(
                                    l10n.t('notif.filter.unread_only'),
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: _unreadOnly
                                          ? Colors.white
                                          : Tokens.gray700,
                                    ),
                                  ),
                                  if (unreadCount > 0) ...[
                                    const SizedBox(width: 5),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: _unreadOnly
                                            ? Colors.white.withAlpha(50)
                                            : const Color(0xFF2563EB).withAlpha(20),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text('$unreadCount',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.bold,
                                            color: _unreadOnly
                                                ? Colors.white
                                                : const Color(0xFF2563EB),
                                          )),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // ── Notification list ───────────────────────────
                      if (filtered.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 40),
                          child: Column(
                            children: [
                              Icon(Icons.notifications_none, size: 48,
                                  color: const Color(0xFFD1D5DB)),
                              const SizedBox(height: 8),
                              Text(
                                _unreadOnly
                                    ? l10n.t('notif.empty')
                                    : l10n.t('notif.empty'),
                                style: TextStyle(color: Tokens.gray500),
                              ),
                            ],
                          ),
                        )
                      else
                        ...List.generate(filtered.length, (i) {
                          final n = filtered[i];
                          return Padding(
                            padding: EdgeInsets.only(bottom: i < filtered.length - 1 ? 8 : 0),
                            child: _NotificationTile(
                              notification: n,
                              l10n: l10n,
                              onTap: () => _onTap(n),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }
}

// ── LINE status card ─────────────────────────────────────────────────────────
class _LineStatusCard extends StatelessWidget {
  const _LineStatusCard({required this.linked, required this.l10n});
  final bool linked;
  final L10n l10n;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: linked ? const Color(0xFFF0FDF4) : const Color(0xFFFEF3C7),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: linked ? const Color(0xFF06C755) : const Color(0xFFD97706),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.chat_bubble_outline, color: Colors.white, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('LINE',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 2),
                  Text(
                    linked ? l10n.t('notif.line.linked') : l10n.t('notif.line.not_linked'),
                    style: TextStyle(
                        fontSize: 13,
                        color: linked ? const Color(0xFF15803D) : const Color(0xFF92400E)),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: linked ? const Color(0xFFDCFCE7) : const Color(0xFFFEF9C3),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                linked ? l10n.t('notif.line.status.on') : l10n.t('notif.line.status.off'),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: linked ? const Color(0xFF16A34A) : const Color(0xFFCA8A04),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Notification tile ────────────────────────────────────────────────────────
class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.l10n, required this.onTap});
  final AppNotification notification;
  final L10n l10n;
  final VoidCallback onTap;

  IconData get _icon {
    switch (notification.type) {
      case 'approval_needed':   return Icons.how_to_vote;
      case 'pr_approved':       return Icons.check_circle;
      case 'pr_rejected':       return Icons.cancel;
      case 'pr_submitted':      return Icons.send;
      case 'stock_low':         return Icons.warning_amber;
      case 'comment':           return Icons.chat_bubble_outline;
      case 'po_status_changed': return Icons.receipt_long;
      case 'po_created':        return Icons.receipt_long;
      default:                  return Icons.notifications;
    }
  }

  Color get _iconColor {
    switch (notification.type) {
      case 'approval_needed':   return const Color(0xFFD97706);
      case 'pr_approved':       return const Color(0xFF16A34A);
      case 'pr_rejected':       return const Color(0xFFDC2626);
      case 'pr_submitted':      return const Color(0xFF2563EB);
      case 'stock_low':         return const Color(0xFFF59E0B);
      case 'comment':           return const Color(0xFF7C3AED);
      case 'po_status_changed': return const Color(0xFF0284C7);
      case 'po_created':        return const Color(0xFF0891B2);
      default:                  return Tokens.gray500;
    }
  }

  String _timeAgo() {
    final t = DateTime.tryParse(notification.createdAt);
    if (t == null) return '';
    final diff = DateTime.now().difference(t);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    return '${diff.inDays}d';
  }

  @override
  Widget build(BuildContext context) {
    final isUnread = notification.readAt == null;
    return Card(
      elevation: 0,
      color: isUnread ? const Color(0xFFF0F7FF) : Theme.of(context).colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Tokens.gray200),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38, height: 38,
                decoration: BoxDecoration(
                  color: _iconColor.withAlpha(25),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(_icon, color: _iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(notification.title,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: isUnread ? FontWeight.w600 : FontWeight.normal,
                        )),
                    if (notification.body != null) ...[
                      const SizedBox(height: 2),
                      Text(notification.body!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 13, color: Tokens.gray500)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(_timeAgo(), style: TextStyle(fontSize: 12, color: Tokens.gray500)),
                  if (isUnread) ...[
                    const SizedBox(height: 6),
                    Container(
                      width: 8, height: 8,
                      decoration: const BoxDecoration(
                          color: Color(0xFF2563EB), shape: BoxShape.circle),
                    ),
                  ],
                ],
              ),
              if (notification.refId != null) ...[
                const SizedBox(width: 4),
                Icon(Icons.chevron_right, size: 18, color: Tokens.gray500),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
