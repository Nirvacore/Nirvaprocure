import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../l10n/l10n.dart';
import '../api/endpoints.dart';
import '../widgets/lang_button.dart';

/// "More" tab — minimal 3-column grid of all secondary screens.
/// Inspired by LINE's More tab and Grab's menu grid.
/// Now a StatefulWidget to load live badge counts.
class MorePage extends StatefulWidget {
  const MorePage({super.key});
  @override
  State<MorePage> createState() => _MorePageState();
}

class _MorePageState extends State<MorePage> {
  int _notifUnread = 0;
  int _pendingApprovals = 0;
  int _lowStock = 0;

  @override
  void initState() {
    super.initState();
    _loadBadges();
  }

  Future<void> _loadBadges() async {
    try {
      final results = await Future.wait([
        Api.listNotifications(),
        Api.approvalsInbox(),
        Api.stockOnHand(),
      ]);
      if (!mounted) return;
      final notifs = results[0] as List<AppNotification>;
      final inbox = results[1] as List<InboxEntry>;
      final stock = results[2] as List<StockOnHand>;
      setState(() {
        _notifUnread = notifs.where((n) => n.readAt == null).length;
        _pendingApprovals = inbox.length;
        _lowStock = stock.where((s) => s.belowReorder).length;
      });
    } catch (_) {}
  }

  Future<void> _confirmLogout() async {
    final l10n = L10n.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(l10n.t('logout.confirm_title')),
        content: Text(l10n.t('logout.confirm_body')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.t('common.cancel')),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: Text(l10n.t('nav.logout')),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await Api.logout();
      if (mounted) context.go('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('nav.more')),
        actions: [
          const LangButton(),
          IconButton(
            icon: const Icon(Icons.logout, size: 22),
            onPressed: _confirmLogout,
            tooltip: l10n.t('nav.logout'),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: GridView.count(
          crossAxisCount: 3,
          mainAxisSpacing: 16,
          crossAxisSpacing: 16,
          childAspectRatio: 0.95,
          children: [
            _Tile(icon: Icons.person_outline, label: l10n.t('profile.heading'),
                color: const Color(0xFF4F46E5), onTap: () => context.push('/profile')),
            _Tile(icon: Icons.search, label: l10n.t('search.hint').split(',')[0],
                color: const Color(0xFF0EA5E9), onTap: () => context.push('/search')),
            _Tile(icon: Icons.bar_chart, label: l10n.t('more.analytics'),
                color: const Color(0xFF7C3AED), onTap: () => context.push('/analytics')),
            _Tile(icon: Icons.inventory_2_outlined, label: l10n.t('more.stock'),
                color: const Color(0xFF0369A1), badge: _lowStock,
                onTap: () => context.push('/stock')),
            _Tile(icon: Icons.people_outline, label: l10n.t('more.suppliers'),
                color: const Color(0xFF059669), onTap: () => context.push('/suppliers')),
            _Tile(icon: Icons.account_balance_wallet_outlined, label: l10n.t('more.budget'),
                color: const Color(0xFF16A34A), onTap: () => context.push('/budget')),
            _Tile(icon: Icons.notifications_outlined, label: l10n.t('more.notif'),
                color: const Color(0xFFD97706), badge: _notifUnread,
                onTap: () => context.push('/notifications')),
            _Tile(icon: Icons.local_shipping_outlined, label: l10n.t('more.receive'),
                color: const Color(0xFF0D9488), onTap: () => context.push('/receive')),
            _Tile(icon: Icons.history, label: l10n.t('more.audit'),
                color: const Color(0xFF6366F1), onTap: () => context.push('/audit')),
            _Tile(icon: Icons.settings_outlined, label: l10n.t('more.settings'),
                color: const Color(0xFF6B7280), onTap: () => context.push('/settings')),
            _Tile(icon: Icons.receipt_long, label: l10n.t('more.po'),
                color: const Color(0xFF2563EB), onTap: () => context.push('/po')),
            _Tile(icon: Icons.pie_chart_outline, label: l10n.t('more.charts'),
                color: const Color(0xFF8B5CF6), onTap: () => context.push('/charts')),
            _Tile(icon: Icons.qr_code_scanner, label: l10n.t('more.scanner'),
                color: const Color(0xFF0891B2), onTap: () => context.push('/scanner')),
            _Tile(icon: Icons.balance, label: l10n.t('more.tor'),
                color: const Color(0xFF4F46E5), onTap: () => context.push('/gov/tor')),
            _Tile(icon: Icons.fingerprint, label: l10n.t('more.biometric'),
                color: const Color(0xFFDC2626), onTap: () => context.push('/biometric')),
          ],
        ),
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.label, required this.color, required this.onTap, this.badge = 0});
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 52, height: 52,
                decoration: BoxDecoration(
                  color: color.withAlpha(20),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: color, size: 26),
              ),
              if (badge > 0)
                Positioned(
                  right: -6, top: -6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDC2626),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      badge > 99 ? '99+' : '$badge',
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(label, textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
              maxLines: 2, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}
