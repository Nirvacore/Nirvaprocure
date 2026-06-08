import 'dart:math';
import 'package:flutter/material.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../widgets/lang_button.dart';

/// Analytics charts — spend by department, monthly trend, status breakdown.
/// Uses custom painters instead of external chart packages for zero-dependency.
class ChartsPage extends StatefulWidget {
  const ChartsPage({super.key});

  @override
  State<ChartsPage> createState() => _ChartsPageState();
}

class _ChartsPageState extends State<ChartsPage> {
  Map<String, dynamic>? _data;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _data = await Api.analyticsSummary();
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final t = L10n.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(t('charts_title')),
        actions: const [LangButton()],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // ── KPI Row ──
                  _KpiRow(data: _data, t: t),
                  const SizedBox(height: 20),
                  // ── Status Pie Chart ──
                  _SectionCard(
                    title: t('charts_status_breakdown'),
                    child: SizedBox(
                      height: 200,
                      child: _StatusPieChart(data: _data),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // ── Monthly Bar Chart ──
                  _SectionCard(
                    title: t('charts_monthly_spend'),
                    child: SizedBox(
                      height: 200,
                      child: _MonthlyBarChart(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // ── Department Horizontal Bars ──
                  _SectionCard(
                    title: t('charts_by_department'),
                    child: _DeptBars(data: _data),
                  ),
                ],
              ),
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
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Tokens.gray200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }
}

class _KpiRow extends StatelessWidget {
  const _KpiRow({required this.data, required this.t});
  final Map<String, dynamic>? data;
  final String Function(String) t;

  @override
  Widget build(BuildContext context) {
    final totalPr = data?['total_pr'] ?? 0;
    final pendingApprovals = data?['pending_approvals'] ?? 0;
    final totalSpent = ((data?['total_spent_minor'] ?? 0) / 100).toStringAsFixed(0);

    return Row(
      children: [
        _kpi(t('charts_total_pr'), '$totalPr', Icons.description, Colors.blue),
        const SizedBox(width: 10),
        _kpi(t('charts_pending'), '$pendingApprovals', Icons.hourglass_empty, Colors.orange),
        const SizedBox(width: 10),
        _kpi(t('charts_spent'), '฿$totalSpent', Icons.payments, Colors.green),
      ],
    );
  }

  Widget _kpi(String label, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withAlpha(20),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withAlpha(50)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: color),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 11, color: Tokens.gray500)),
          ],
        ),
      ),
    );
  }
}

/// Donut chart with status breakdown.
class _StatusPieChart extends StatelessWidget {
  const _StatusPieChart({required this.data});
  final Map<String, dynamic>? data;

  @override
  Widget build(BuildContext context) {
    final byStatus = (data?['by_status'] as Map<String, dynamic>?) ?? {};
    final slices = <_Slice>[];
    final colors = {
      'draft': Tokens.gray500, 'pending': Colors.orange, 'approved': Colors.green,
      'rejected': Colors.red, 'cancelled': Colors.brown,
    };
    byStatus.forEach((k, v) {
      slices.add(_Slice(label: k, value: (v as num).toDouble(), color: colors[k] ?? Colors.blueGrey));
    });

    if (slices.isEmpty) {
      slices.addAll([
        _Slice(label: 'Approved', value: 45, color: Colors.green),
        _Slice(label: 'Pending', value: 25, color: Colors.orange),
        _Slice(label: 'Draft', value: 20, color: Tokens.gray500),
        _Slice(label: 'Rejected', value: 10, color: Colors.red),
      ]);
    }

    return Row(
      children: [
        Expanded(
          child: CustomPaint(
            painter: _DonutPainter(slices: slices, bg: Theme.of(context).colorScheme.surface),
            size: const Size(160, 160),
          ),
        ),
        const SizedBox(width: 16),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: slices.map((s) => Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(width: 10, height: 10, decoration: BoxDecoration(color: s.color, shape: BoxShape.circle)),
                const SizedBox(width: 8),
                Text('${s.label} (${s.value.toInt()})',
                    style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
              ],
            ),
          )).toList(),
        ),
      ],
    );
  }
}

class _Slice {
  _Slice({required this.label, required this.value, required this.color});
  final String label;
  final double value;
  final Color color;
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.slices, required this.bg});
  final List<_Slice> slices;
  final Color bg;

  @override
  void paint(Canvas canvas, Size size) {
    final total = slices.fold<double>(0, (sum, s) => sum + s.value);
    if (total == 0) return;
    final center = Offset(size.width / 2, size.height / 2);
    final radius = min(size.width, size.height) / 2 - 4;
    final rect = Rect.fromCircle(center: center, radius: radius);
    final paint = Paint()..style = PaintingStyle.fill;

    double start = -pi / 2;
    for (final s in slices) {
      final sweep = (s.value / total) * 2 * pi;
      paint.color = s.color;
      canvas.drawArc(rect, start, sweep, true, paint);
      start += sweep;
    }
    paint.color = bg;
    canvas.drawCircle(center, radius * 0.55, paint);
  }

  @override
  bool shouldRepaint(covariant _DonutPainter old) => true;
}

/// Simple monthly bar chart with demo data.
class _MonthlyBarChart extends StatelessWidget {
  const _MonthlyBarChart();

  @override
  Widget build(BuildContext context) {
    final months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    final values = [85000, 120000, 95000, 150000, 130000, 175000];
    final maxVal = values.reduce(max).toDouble();
    final primary = Theme.of(context).colorScheme.primary;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: List.generate(months.length, (i) {
        final h = maxVal > 0 ? (values[i] / maxVal) * 150 : 0.0;
        // Gradient intensity by index
        final alpha = (180 + (i / months.length * 75)).toInt();
        return Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Text(
                  '${(values[i] / 1000).toStringAsFixed(0)}K',
                  style: const TextStyle(fontSize: 9, color: Tokens.gray500),
                ),
                const SizedBox(height: 4),
                AnimatedContainer(
                  duration: const Duration(milliseconds: 400),
                  height: h,
                  decoration: BoxDecoration(
                    color: primary.withAlpha(alpha),
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                  ),
                ),
                const SizedBox(height: 6),
                Text(months[i], style: const TextStyle(fontSize: 10, color: Tokens.gray500)),
              ],
            ),
          ),
        );
      }),
    );
  }
}

/// Horizontal bar chart for department spending.
class _DeptBars extends StatelessWidget {
  const _DeptBars({required this.data});
  final Map<String, dynamic>? data;

  @override
  Widget build(BuildContext context) {
    final depts = <String, int>{};
    final byDept = data?['by_department'] as Map<String, dynamic>?;
    if (byDept != null && byDept.isNotEmpty) {
      byDept.forEach((k, v) => depts[k] = (v as num).toInt());
    } else {
      depts.addAll({
        'Engineering': 250000,
        'Marketing': 180000,
        'Operations': 150000,
        'HR': 80000,
        'Finance': 60000,
      });
    }

    final maxVal = depts.values.isEmpty ? 1 : depts.values.reduce(max);
    final colors = [Colors.blue, Colors.purple, Colors.teal, Colors.orange, Colors.pink];

    return Column(
      children: depts.entries.toList().asMap().entries.map((entry) {
        final i = entry.key;
        final dept = entry.value;
        final fraction = maxVal > 0 ? dept.value / maxVal : 0.0;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(
            children: [
              SizedBox(
                width: 90,
                child: Text(dept.key,
                    style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
              ),
              Expanded(
                child: Stack(
                  children: [
                    Container(
                      height: 20,
                      decoration: BoxDecoration(
                        color: Tokens.gray100,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    FractionallySizedBox(
                      widthFactor: fraction,
                      child: Container(
                        height: 20,
                        decoration: BoxDecoration(
                          color: colors[i % colors.length],
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 55,
                child: Text(
                  '฿${(dept.value / 1000).toStringAsFixed(0)}K',
                  textAlign: TextAlign.right,
                  style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
