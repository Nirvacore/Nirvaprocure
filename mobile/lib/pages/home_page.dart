import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../l10n/l10n.dart';
import '../api/endpoints.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

/// Home tab — minimalist dashboard with live stats + quick actions.
/// Inspired by Grab driver home, Shopee seller center, LINE Pay balance card.
class HomePage extends StatefulWidget {
  const HomePage({super.key});
  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  Map<String, dynamic>? _stats;
  int _pendingCount = 0;
  List<PrSummary>? _recentPrs;
  bool _loading = true;

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
        Api.approvalsInbox(),
        Api.listPr(),
      ]);
      _stats = results[0] as Map<String, dynamic>;
      _pendingCount = (results[1] as List).length;
      _recentPrs = results[2] as List<PrSummary>;
    } catch (_) {
      // gracefully show zeros
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final totalPr   = (_stats?['total_pr_count'] as int?) ?? 0;
    final spentRaw  = (_stats?['total_spent_minor'] as int?) ?? 0;
    final spent     = (spentRaw / 100).round();

    return Scaffold(
      appBar: AppBar(
        title: const Text('NIRVAPROCURE', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20)),
        actions: [
          IconButton(
            icon: const Icon(Icons.search, size: 22),
            onPressed: () => context.push('/search'),
            tooltip: l10n.t('search.hint'),
          ),
          GestureDetector(
            onTap: () => context.push('/profile'),
            child: const Padding(
              padding: EdgeInsets.only(right: 12),
              child: CircleAvatar(
                radius: 16,
                backgroundColor: Color(0xFFE0E7FF),
                child: Icon(Icons.person, size: 18, color: Color(0xFF4F46E5)),
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            // ── Greeting ──────────────────────────────────────────
            Text(_greeting(l10n),
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),

            // ── Stats row (3 cards) ───────────────────────────────
            Row(
              children: [
                Expanded(child: _StatChip(
                  label: l10n.t('home.stat.pending'),
                  value: '$_pendingCount',
                  color: _pendingCount > 0 ? Tokens.warning : Tokens.success,
                  icon: Icons.how_to_vote,
                  onTap: () => context.go('/approvals'),
                )),
                const SizedBox(width: 10),
                Expanded(child: _StatChip(
                  label: l10n.t('home.stat.prs'),
                  value: '$totalPr',
                  color: Tokens.brand600,
                  icon: Icons.receipt_long,
                  onTap: () => context.go('/pr'),
                )),
                const SizedBox(width: 10),
                Expanded(child: _StatChip(
                  label: l10n.t('home.stat.spent'),
                  value: _fmtSpend(spent),
                  color: const Color(0xFF7C3AED),
                  icon: Icons.payments,
                  onTap: () => context.go('/analytics'),
                )),
              ],
            ),
            const SizedBox(height: 24),

            // ── Quick actions (horizontal scroll chips) ───────────
            Text(l10n.t('home.quick'),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            SizedBox(
              height: 88,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [
                  _QuickAction(
                    icon: Icons.add_circle, color: Tokens.brand600,
                    label: l10n.t('home.action.new'),
                    onTap: () => context.push('/pr/new'),
                  ),
                  _QuickAction(
                    icon: Icons.inventory_2, color: const Color(0xFF0369A1),
                    label: l10n.t('more.stock'),
                    onTap: () => context.push('/stock'),
                  ),
                  _QuickAction(
                    icon: Icons.people, color: const Color(0xFF059669),
                    label: l10n.t('more.suppliers'),
                    onTap: () => context.push('/suppliers'),
                  ),
                  _QuickAction(
                    icon: Icons.account_balance_wallet, color: const Color(0xFF16A34A),
                    label: l10n.t('more.budget'),
                    onTap: () => context.push('/budget'),
                  ),
                  _QuickAction(
                    icon: Icons.receipt_long, color: const Color(0xFF0891B2),
                    label: l10n.t('more.po'),
                    onTap: () => context.push('/po'),
                  ),
                  _QuickAction(
                    icon: Icons.bar_chart, color: const Color(0xFF7C3AED),
                    label: l10n.t('more.analytics'),
                    onTap: () => context.push('/analytics'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Pending approvals preview ─────────────────────────
            if (_pendingCount > 0) ...[
              _SectionHeader(
                title: l10n.t('home.pending_title'),
                badge: '$_pendingCount',
                onTap: () => context.go('/approvals'),
              ),
              const SizedBox(height: 10),
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: Color(0xFFFDE68A)),
                ),
                color: const Color(0xFFFFFBEB),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => context.go('/approvals'),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Container(
                          width: 44, height: 44,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.how_to_vote, color: Color(0xFFD97706), size: 22),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l10n.t('home.pending_msg').replaceAll('{count}', '$_pendingCount'),
                                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
                              ),
                              const SizedBox(height: 2),
                              Text(l10n.t('home.pending_sub'),
                                  style: TextStyle(fontSize: 13, color: Tokens.gray500)),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right, color: Tokens.gray500),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],

            // ── Recent PRs preview ────────────────────────────────
            _SectionHeader(
              title: l10n.t('home.recent_title'),
              onTap: () => context.go('/pr'),
            ),
            const SizedBox(height: 10),
            _RecentPrList(l10n: l10n, prs: _recentPrs),
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

  String _greeting(L10n l10n) {
    final h = DateTime.now().hour;
    if (h >= 5 && h < 12) return l10n.t('home.greeting.morning');
    if (h >= 12 && h < 18) return l10n.t('home.greeting.afternoon');
    return l10n.t('home.greeting.evening');
  }
}

// ── Stat chip ────────────────────────────────────────────────────────────────
class _StatChip extends StatelessWidget {
  const _StatChip({required this.label, required this.value, required this.color, required this.icon, this.onTap});
  final String label, value;
  final Color color;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withAlpha(15),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withAlpha(40)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 6),
            Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, color: color.withAlpha(180)),
                textAlign: TextAlign.center, maxLines: 1, overflow: TextOverflow.ellipsis),
          ],
        ),
      ),
    );
  }
}

// ── Quick action circle ──────────────────────────────────────────────────────
class _QuickAction extends StatelessWidget {
  const _QuickAction({required this.icon, required this.color, required this.label, required this.onTap});
  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          width: 68,
          child: Column(
            children: [
              Container(
                width: 52, height: 52,
                decoration: BoxDecoration(
                  color: color.withAlpha(20),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(height: 6),
              Text(label, textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 11), maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Section header ───────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.badge, this.onTap});
  final String title;
  final String? badge;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        if (badge != null) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFDC2626),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(badge!, style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
        const Spacer(),
        if (onTap != null)
          TextButton(
            onPressed: onTap,
            child: Text(L10n.of(context).t('home.see_all'),
                style: const TextStyle(fontSize: 13)),
          ),
      ],
    );
  }
}

// ── Recent PRs mini list ─────────────────────────────────────────────────────
/// Stateless — data flows from parent's _load() so pull-to-refresh works.
class _RecentPrList extends StatelessWidget {
  const _RecentPrList({required this.l10n, required this.prs});
  final L10n l10n;
  final List<PrSummary>? prs; // null = still loading

  Color _statusColor(String status) => switch (status) {
    'approved' => const Color(0xFF16A34A),
    'rejected'  => const Color(0xFFDC2626),
    'pending'   => const Color(0xFFD97706),
    _           => const Color(0xFF6B7280),
  };

  @override
  Widget build(BuildContext context) {
    if (prs == null) {
      return const SizedBox(
        height: 60,
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    if (prs!.isEmpty) {
      return Text(l10n.t('pr.list.empty'),
          style: TextStyle(color: Tokens.gray500));
    }

    final show = prs!.take(5).toList();
    return Column(
      children: show.map((pr) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(color: Tokens.gray200),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => context.push('/pr/${pr.id}'),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(pr.title,
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                        const SizedBox(height: 2),
                        Text(pr.prNumber,
                            style: TextStyle(fontSize: 12, color: Tokens.gray500)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _statusColor(pr.status).withAlpha(20),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      l10n.t('status.${pr.status}'),
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _statusColor(pr.status)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      )).toList(),
    );
  }
}
