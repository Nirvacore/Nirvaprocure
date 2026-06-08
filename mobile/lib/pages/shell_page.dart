import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../l10n/l10n.dart';
import '../api/endpoints.dart';

/// Persistent bottom-nav shell — wraps the 4 main tabs.
/// The FAB in the center navigates to /pr/new (create PR).
class ShellPage extends StatefulWidget {
  const ShellPage({super.key, required this.child});
  final Widget child;

  @override
  State<ShellPage> createState() => _ShellPageState();
}

class _ShellPageState extends State<ShellPage> {
  int _pendingCount = 0;

  @override
  void initState() {
    super.initState();
    _loadBadge();
  }

  Future<void> _loadBadge() async {
    try {
      final inbox = await Api.approvalsInbox();
      if (mounted) setState(() => _pendingCount = inbox.length);
    } catch (_) {}
  }

  static int _index(String location) {
    if (location.startsWith('/approvals')) return 1;
    if (location.startsWith('/more'))      return 3;
    if (location.startsWith('/pr'))        return 2;
    return 0; // home
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final location = GoRouterState.of(context).matchedLocation;
    final idx = _index(location);

    return Scaffold(
      body: widget.child,
      floatingActionButton: FloatingActionButton(
        heroTag: 'fab_create_pr',
        onPressed: () => context.push('/pr/new'),
        backgroundColor: const Color(0xFF4F46E5),
        foregroundColor: Colors.white,
        elevation: 4,
        shape: const CircleBorder(),
        child: const Icon(Icons.add, size: 28),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        height: 64,
        padding: EdgeInsets.zero,
        color: Colors.white,
        surfaceTintColor: Colors.white,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _NavItem(
              icon: Icons.home_outlined,
              activeIcon: Icons.home,
              label: l10n.t('nav.home'),
              active: idx == 0,
              onTap: () => context.go('/'),
            ),
            _NavItem(
              icon: Icons.how_to_vote_outlined,
              activeIcon: Icons.how_to_vote,
              label: l10n.t('nav.approvals'),
              active: idx == 1,
              badge: _pendingCount,
              onTap: () {
                context.go('/approvals');
                _loadBadge(); // refresh on tap
              },
            ),
            const SizedBox(width: 48), // space for FAB
            _NavItem(
              icon: Icons.list_alt_outlined,
              activeIcon: Icons.list_alt,
              label: l10n.t('nav.pr'),
              active: idx == 2,
              onTap: () => context.go('/pr'),
            ),
            _NavItem(
              icon: Icons.grid_view_outlined,
              activeIcon: Icons.grid_view,
              label: l10n.t('nav.more'),
              active: idx == 3,
              onTap: () => context.go('/more'),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon, required this.activeIcon,
    required this.label, required this.active, required this.onTap,
    this.badge = 0,
  });
  final IconData icon, activeIcon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    final color = active ? const Color(0xFF4F46E5) : const Color(0xFF9CA3AF);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 64,
        height: 56,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(active ? activeIcon : icon, color: color, size: 24),
                if (badge > 0)
                  Positioned(
                    right: -8,
                    top: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDC2626),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      constraints: const BoxConstraints(minWidth: 16, minHeight: 14),
                      child: Text(
                        badge > 99 ? '99+' : '$badge',
                        style: const TextStyle(fontSize: 9, color: Colors.white, fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, color: color, fontWeight: active ? FontWeight.w600 : FontWeight.normal)),
          ],
        ),
      ),
    );
  }
}
