import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class AnalyticsPage extends StatefulWidget {
  const AnalyticsPage({super.key});
  @override
  State<AnalyticsPage> createState() => _AnalyticsPageState();
}

class _AnalyticsPageState extends State<AnalyticsPage> {
  late Future<Map<String, dynamic>> _future;
  static final _baht = NumberFormat.currency(locale: 'en_US', symbol: '฿ ', decimalDigits: 2);

  @override
  void initState() {
    super.initState();
    _future = Api.analyticsSummary();
  }

  Future<void> _refresh() async {
    setState(() => _future = Api.analyticsSummary());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('analytics.heading')),
        actions: const [LangButton()],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<Map<String, dynamic>>(
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
            final d = snap.data!;
            final counts      = (d['pr_counts']     as Map?)?.cast<String, dynamic>() ?? {};
            final spendMinor  = (d['approved_spend_minor'] as num?)?.toInt() ?? 0;
            final slaHours    = d['avg_approval_hours'] as num?;
            final suppliers   = (d['top_suppliers']  as List?)?.cast<Map<String, dynamic>>() ?? [];
            final departments = (d['by_department']  as List?)?.cast<Map<String, dynamic>>() ?? [];

            // Max dept spend for bar chart scaling.
            final maxDept = departments.isEmpty
                ? 1
                : departments.map((x) => (x['spend_minor'] as num).toInt()).reduce((a, b) => a > b ? a : b);

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [

                // ── Stat cards 2×2 grid ──────────────────────────────────
                GridView.count(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  shrinkWrap: true,
                  childAspectRatio: 1.6,
                  physics: const NeverScrollableScrollPhysics(),
                  children: [
                    _StatCard(
                      label: l10n.t('analytics.stat.total'),
                      value: '${(counts['in_approval'] ?? 0) + (counts['approved'] ?? 0) + (counts['rejected'] ?? 0)}',
                      color: Tokens.brand600,
                      bg: Tokens.brand100,
                      icon: Icons.description_outlined,
                    ),
                    _StatCard(
                      label: l10n.t('status.approved'),
                      value: '${counts['approved'] ?? 0}',
                      color: Tokens.success,
                      bg: const Color(0xFFDCFCE7),
                      icon: Icons.check_circle_outline,
                    ),
                    _StatCard(
                      label: l10n.t('status.pending'),
                      value: '${counts['in_approval'] ?? 0}',
                      color: const Color(0xFFB45309),
                      bg: const Color(0xFFFEF3C7),
                      icon: Icons.schedule,
                    ),
                    _StatCard(
                      label: l10n.t('analytics.stat.spent'),
                      value: _baht.format(spendMinor / 100),
                      color: Tokens.brand600,
                      bg: Tokens.brand50,
                      icon: Icons.payments_outlined,
                      smallText: true,
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // ── SLA ─────────────────────────────────────────────────
                if (slaHours != null)
                  _SectionCard(
                    title: l10n.t('analytics.sla.label'),
                    child: Row(children: [
                      const Icon(Icons.timer_outlined, size: 28, color: Tokens.brand600),
                      const SizedBox(width: 12),
                      Text(
                        l10n.t('analytics.sla.value', {'hours': slaHours.toStringAsFixed(1)}),
                        style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                      ),
                    ]),
                  ),
                if (slaHours != null) const SizedBox(height: 12),

                // ── Department bar chart ─────────────────────────────────
                _SectionCard(
                  title: l10n.t('analytics.by_dept'),
                  child: departments.isEmpty
                      ? Text(l10n.t('analytics.empty.dept'),
                          style: const TextStyle(color: Tokens.gray500))
                      : Column(
                          children: departments.map<Widget>((dept) {
                            final name  = (dept['department'] as String?) ?? l10n.t('analytics.unspecified');
                            final spend = (dept['spend_minor'] as num).toInt();
                            final count = dept['pr_count'] as int? ?? 0;
                            final pct   = spend / maxDept;
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 6),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(name,
                                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                                            overflow: TextOverflow.ellipsis),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(_baht.format(spend / 100),
                                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: pct,
                                      minHeight: 8,
                                      backgroundColor: Tokens.gray100,
                                      color: Tokens.brand600,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(l10n.t('analytics.pr_count', {'count': '$count'}),
                                      style: const TextStyle(fontSize: 11, color: Tokens.gray500)),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                ),
                const SizedBox(height: 12),

                // ── Top suppliers ────────────────────────────────────────
                _SectionCard(
                  title: l10n.t('analytics.top_suppliers'),
                  child: suppliers.isEmpty
                      ? Text(l10n.t('analytics.empty.suppliers'),
                          style: const TextStyle(color: Tokens.gray500))
                      : Column(
                          children: suppliers.asMap().entries.map<Widget>((e) {
                            final i      = e.key;
                            final s      = e.value;
                            final name   = s['name'] as String? ?? '—';
                            final spend  = (s['spend_minor'] as num).toInt();
                            final count  = s['po_count'] as int? ?? 0;
                            return Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Row(children: [
                                Container(
                                  width: 32, height: 32,
                                  decoration: BoxDecoration(
                                    color: Tokens.gray100,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Center(
                                    child: Text('${i + 1}',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            color: Tokens.gray700)),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(name, style: const TextStyle(fontWeight: FontWeight.w600),
                                        overflow: TextOverflow.ellipsis),
                                    Text(l10n.t('analytics.po_count', {'count': '$count'}),
                                        style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
                                  ],
                                )),
                                Text(_baht.format(spend / 100),
                                    style: const TextStyle(fontWeight: FontWeight.bold)),
                              ]),
                            );
                          }).toList(),
                        ),
                ),
                const SizedBox(height: 24),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label, required this.value, required this.color,
    required this.bg, required this.icon, this.smallText = false,
  });
  final String label, value;
  final Color color, bg;
  final IconData icon;
  final bool smallText;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: color, size: 20),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(fontSize: 11, color: color.withAlpha(204))),
              Text(value,
                  style: TextStyle(
                    fontSize: smallText ? 14 : 22,
                    fontWeight: FontWeight.bold,
                    color: color,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});
  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Tokens.gray200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}
