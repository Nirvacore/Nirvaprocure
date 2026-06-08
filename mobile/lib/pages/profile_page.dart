import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../l10n/l10n.dart';
import '../api/endpoints.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

/// Profile page — LINE-style user profile with avatar, stats, quick settings.
/// Clean, minimal layout with large avatar at top, info card, stats row, and
/// settings shortcuts.
class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map<String, dynamic>? _stats;
  UserProfile? _profile;
  bool _loading = true;
  int _supplierCount = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        Api.analyticsSummary(),
        Api.getMe(),
        Api.listSuppliers(),
      ]);
      _stats = results[0] as Map<String, dynamic>;
      _profile = results[1] as UserProfile;
      _supplierCount = (results[2] as List).length;
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
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
    final totalPr = (_stats?['total_pr_count'] as int?) ?? 0;
    final spentRaw = (_stats?['total_spent_minor'] as int?) ?? 0;
    final spent = (spentRaw / 100).round();
    final displayName = _profile?.fullName ?? l10n.t('profile.user');
    final displayRole = _profile?.role ?? _profile?.orgName ?? l10n.t('profile.role');

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('profile.heading')),
        actions: const [LangButton()],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
          children: [
            // ── Avatar + name card ──────────────────────────────
            Center(
              child: Column(
                children: [
                  Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [Color(0xFF6366F1), Color(0xFF4F46E5)],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: Tokens.brand600.withAlpha(40),
                          blurRadius: 24,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.person, color: Colors.white, size: 44),
                  ),
                  const SizedBox(height: 16),
                  Text(displayName,
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text(displayRole,
                      style: const TextStyle(fontSize: 14, color: Tokens.gray500)),
                  if (_profile?.email != null) ...[
                    const SizedBox(height: 2),
                    Text(_profile!.email,
                        style: const TextStyle(fontSize: 12, color: Color(0xFFD1D5DB))),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 28),

            // ── Stats row ──────────────────────────────────────
            Row(
              children: [
                Expanded(child: _MiniStat(
                  label: l10n.t('profile.stat.prs'),
                  value: '$totalPr',
                  icon: Icons.receipt_long,
                  color: Tokens.brand600,
                )),
                const SizedBox(width: 12),
                Expanded(child: _MiniStat(
                  label: l10n.t('profile.stat.spent'),
                  value: _fmtSpend(spent),
                  icon: Icons.payments,
                  color: const Color(0xFF7C3AED),
                )),
                const SizedBox(width: 12),
                Expanded(child: _MiniStat(
                  label: l10n.t('profile.stat.suppliers'),
                  value: '$_supplierCount',
                  icon: Icons.people,
                  color: const Color(0xFF059669),
                )),
              ],
            ),
            const SizedBox(height: 28),

            // ── Quick settings menu ────────────────────────────
            _MenuSection(
              title: l10n.t('profile.section.account'),
              children: [
                _MenuItem(
                  icon: Icons.language,
                  label: l10n.t('profile.menu.language'),
                  trailing: Text(_currentLangLabel(l10n),
                      style: const TextStyle(fontSize: 13, color: Tokens.gray500)),
                  onTap: () => context.push('/settings'),
                ),
                _MenuItem(
                  icon: l10n.isDark ? Icons.light_mode : Icons.dark_mode,
                  label: l10n.t('profile.menu.darkmode'),
                  trailing: Text(l10n.isDark ? 'ON' : 'OFF',
                      style: const TextStyle(fontSize: 13, color: Tokens.gray500)),
                  onTap: () => l10n.toggleDark(),
                ),
                _MenuItem(
                  icon: Icons.notifications_outlined,
                  label: l10n.t('profile.menu.notif'),
                  onTap: () => context.push('/notifications'),
                ),
                _MenuItem(
                  icon: Icons.security,
                  label: l10n.t('profile.menu.security'),
                  onTap: () => context.push('/settings'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _MenuSection(
              title: l10n.t('profile.section.org'),
              children: [
                _MenuItem(
                  icon: Icons.people_outline,
                  label: l10n.t('profile.menu.team'),
                  onTap: () => context.push('/settings'),
                ),
                _MenuItem(
                  icon: Icons.business_outlined,
                  label: l10n.t('profile.menu.departments'),
                  onTap: () => context.push('/settings'),
                ),
                _MenuItem(
                  icon: Icons.history,
                  label: l10n.t('profile.menu.audit'),
                  onTap: () => context.push('/audit'),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // ── Logout button ──────────────────────────────────
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _confirmLogout,
                icon: const Icon(Icons.logout, size: 18),
                label: Text(l10n.t('nav.logout')),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red.shade600,
                  side: BorderSide(color: Colors.red.shade200, width: 1.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _fmtSpend(int baht) {
    if (baht >= 1000000) return '฿${(baht / 1000000).toStringAsFixed(1)}M';
    if (baht >= 1000) return '฿${(baht / 1000).toStringAsFixed(0)}K';
    return '฿$baht';
  }

  String _currentLangLabel(L10n l10n) {
    const labels = {
      'th': 'ไทย', 'en': 'EN', 'zh': '中文', 'ja': '日本語',
      'vi': 'VI', 'id': 'ID', 'my': 'MY', 'km': 'KM',
    };
    return labels[l10n.locale.languageCode] ?? 'TH';
  }
}

// ── Mini stat card ──────────────────────────────────────────────────────────
class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value, required this.icon, required this.color});
  final String label, value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: const Border.fromBorderSide(BorderSide(color: Tokens.gray200)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 10, color: Tokens.gray500),
              textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

// ── Menu section ────────────────────────────────────────────────────────────
class _MenuSection extends StatelessWidget {
  const _MenuSection({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Tokens.gray500)),
        const SizedBox(height: 8),
        Container(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            border: const Border.fromBorderSide(BorderSide(color: Tokens.gray200)),
          ),
          child: Column(children: children),
        ),
      ],
    );
  }
}

class _MenuItem extends StatelessWidget {
  const _MenuItem({required this.icon, required this.label, this.trailing, required this.onTap});
  final IconData icon;
  final String label;
  final Widget? trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: Tokens.gray100,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: Tokens.gray700),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text(label, style: const TextStyle(fontSize: 15))),
            if (trailing != null) ...[trailing!, const SizedBox(width: 4)],
            const Icon(Icons.chevron_right, size: 18, color: Tokens.gray500),
          ],
        ),
      ),
    );
  }
}
