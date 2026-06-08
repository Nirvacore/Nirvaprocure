import 'package:flutter/material.dart';
import '../l10n/l10n.dart';
import '../api/endpoints.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class AuditPage extends StatefulWidget {
  const AuditPage({super.key});
  @override
  State<AuditPage> createState() => _AuditPageState();
}

class _AuditPageState extends State<AuditPage> {
  final List<AuditEntry> _entries = [];
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  String? _cursor;
  bool _hasMore = true;
  final _scroll = ScrollController();
  final Set<String> _expanded = {};
  String _actionFilter = 'all'; // all | pr | po | stock | auth

  @override
  void initState() {
    super.initState();
    _load();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 200 && _hasMore && !_loadingMore) {
      _loadMore();
    }
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final result = await Api.auditLog();
      _entries.clear();
      _entries.addAll(result.entries);
      _cursor = result.nextCursor;
      _hasMore = result.nextCursor != null;
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (_cursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final result = await Api.auditLog(cursor: _cursor);
      _entries.addAll(result.entries);
      _cursor = result.nextCursor;
      _hasMore = result.nextCursor != null;
    } catch (_) {}
    finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _toggle(String id) {
    setState(() {
      if (_expanded.contains(id)) {
        _expanded.remove(id);
      } else {
        _expanded.add(id);
      }
    });
  }

  List<AuditEntry> get _filtered {
    if (_actionFilter == 'all') return _entries;
    return _entries.where((e) {
      switch (_actionFilter) {
        case 'pr':    return e.action.startsWith('pr.');
        case 'po':    return e.action.startsWith('po.');
        case 'stock': return e.action.startsWith('stock.') || e.action.startsWith('budget.');
        case 'auth':  return e.action.startsWith('user.');
        default:      return true;
      }
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final filtered = _filtered;

    final filters = [
      ('all',   l10n.t('audit.filter.all'),   Icons.list_alt),
      ('pr',    l10n.t('audit.filter.pr'),    Icons.description_outlined),
      ('po',    l10n.t('audit.filter.po'),    Icons.receipt_long_outlined),
      ('stock', l10n.t('audit.filter.stock'), Icons.inventory_2_outlined),
      ('auth',  l10n.t('audit.filter.auth'),  Icons.login),
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('audit.heading')),
        actions: const [LangButton()],
      ),
      body: Column(
        children: [
          // ── Filter chips ──────────────────────────────────
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              itemCount: filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final (key, label, icon) = filters[i];
                final active = key == _actionFilter;
                return GestureDetector(
                  onTap: () => setState(() => _actionFilter = key),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: active ? const Color(0xFF2563EB) : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: active ? const Color(0xFF2563EB) : const Color(0xFFD1D5DB),
                        width: active ? 1.5 : 1,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(icon, size: 14,
                            color: active ? Colors.white : Tokens.gray500),
                        const SizedBox(width: 5),
                        Text(label,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: active ? Colors.white : Tokens.gray700,
                            )),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          // ── Body ──────────────────────────────────────────
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                : _error != null
                    ? Center(child: Text(l10n.t('err.load')))
                    : filtered.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.manage_search, size: 56, color: const Color(0xFFD1D5DB)),
                                const SizedBox(height: 12),
                                Text(l10n.t('audit.empty'),
                                    style: TextStyle(color: Tokens.gray500)),
                              ],
                            ),
                          )
                        : RefreshIndicator(
                            onRefresh: _load,
                            child: ListView.builder(
                              controller: _scroll,
                              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                              itemCount: filtered.length + (_loadingMore ? 1 : 0),
                              itemBuilder: (_, i) {
                                if (i == filtered.length) {
                                  return const Padding(
                                    padding: EdgeInsets.all(16),
                                    child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                                  );
                                }
                                final entry = filtered[i];
                                final isExpanded = _expanded.contains(entry.id);
                                return _AuditTile(
                                  entry: entry,
                                  l10n: l10n,
                                  expanded: isExpanded,
                                  onTap: () => _toggle(entry.id),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}

class _AuditTile extends StatelessWidget {
  const _AuditTile({required this.entry, required this.l10n, required this.expanded, required this.onTap});
  final AuditEntry entry;
  final L10n l10n;
  final bool expanded;
  final VoidCallback onTap;

  IconData get _icon {
    switch (entry.action) {
      case 'pr.create':    return Icons.add_circle_outline;
      case 'pr.submit':    return Icons.send;
      case 'pr.decide':    return Icons.gavel;
      case 'pr.receive':   return Icons.check_circle_outline;
      case 'user.login':   return Icons.login;
      case 'user.logout':  return Icons.logout;
      case 'stock.adjust': return Icons.inventory;
      case 'budget.set':   return Icons.account_balance_wallet;
      case 'po.create':    return Icons.receipt_long;
      case 'po.status':    return Icons.swap_horiz;
      default:             return Icons.history;
    }
  }

  Color get _color {
    if (entry.action.startsWith('po.')) return const Color(0xFF0284C7);
    if (entry.action.contains('create') || entry.action.contains('submit')) {
      return const Color(0xFF2563EB);
    }
    if (entry.action.contains('decide') || entry.action.contains('approve')) {
      return const Color(0xFF16A34A);
    }
    if (entry.action.contains('reject') || entry.action.contains('delete')) {
      return const Color(0xFFDC2626);
    }
    if (entry.action.contains('login') || entry.action.contains('logout')) {
      return const Color(0xFF7C3AED);
    }
    return const Color(0xFF6B7280);
  }

  String _actionLabel() {
    switch (entry.action) {
      case 'pr.create':    return l10n.t('audit.action.pr_create');
      case 'pr.submit':    return l10n.t('audit.action.pr_submit');
      case 'pr.decide':    return l10n.t('audit.action.pr_decide');
      case 'pr.receive':   return l10n.t('audit.action.pr_receive');
      case 'user.login':   return l10n.t('audit.action.login');
      case 'user.logout':  return l10n.t('audit.action.logout');
      case 'stock.adjust': return l10n.t('audit.action.stock_adjust');
      case 'budget.set':   return l10n.t('audit.action.budget_set');
      case 'po.create':    return l10n.t('audit.action.po_create');
      case 'po.status':    return l10n.t('audit.action.po_status');
      default:             return entry.action;
    }
  }

  String _timeLabel() {
    final t = DateTime.tryParse(entry.createdAt);
    if (t == null) return '';
    final now = DateTime.now();
    final diff = now.difference(t);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    return '${t.day}/${t.month}';
  }

  String _fullTime() {
    final t = DateTime.tryParse(entry.createdAt);
    if (t == null) return '';
    return '${t.year}-${t.month.toString().padLeft(2, '0')}-${t.day.toString().padLeft(2, '0')} '
        '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}:${t.second.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Timeline icon + line
          Column(
            children: [
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(
                  color: _color.withAlpha(25),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(_icon, size: 16, color: _color),
              ),
              Container(width: 2, height: expanded ? 80 : 32, color: Tokens.gray200),
            ],
          ),
          const SizedBox(width: 12),

          // Content
          Expanded(
            child: GestureDetector(
              onTap: onTap,
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(_actionLabel(),
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                        ),
                        Text(_timeLabel(),
                            style: TextStyle(fontSize: 12, color: Tokens.gray500)),
                        const SizedBox(width: 4),
                        AnimatedRotation(
                          turns: expanded ? 0.25 : 0,
                          duration: const Duration(milliseconds: 200),
                          child: Icon(Icons.chevron_right, size: 16, color: Tokens.gray500),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      entry.actorName ?? entry.actorId,
                      style: TextStyle(fontSize: 13, color: Tokens.gray500),
                    ),

                    // Expanded detail
                    AnimatedCrossFade(
                      duration: const Duration(milliseconds: 200),
                      crossFadeState: expanded ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                      firstChild: const SizedBox.shrink(),
                      secondChild: Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF9FAFB),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Tokens.gray200),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _DetailRow(label: l10n.t('audit.detail.time'), value: _fullTime()),
                              if (entry.entityType != null)
                                _DetailRow(
                                  label: l10n.t('audit.detail.entity'),
                                  value: '${entry.entityType} ${entry.entityId ?? ''}',
                                ),
                              _DetailRow(label: l10n.t('audit.detail.actor_id'), value: entry.actorId),
                              _DetailRow(label: l10n.t('audit.detail.action_raw'), value: entry.action),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});
  final String label, value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(label,
                style: TextStyle(fontSize: 11, color: Tokens.gray500, fontWeight: FontWeight.w600)),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 12, fontFamily: 'monospace')),
          ),
        ],
      ),
    );
  }
}
