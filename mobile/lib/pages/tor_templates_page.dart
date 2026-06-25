import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class TorTemplatesPage extends StatefulWidget {
  const TorTemplatesPage({super.key});

  @override
  State<TorTemplatesPage> createState() => _TorTemplatesPageState();
}

class _TorTemplatesPageState extends State<TorTemplatesPage> {
  List<TorTemplate> _templates = [];
  bool _loading = true;
  String? _error;
  String? _deletingId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      _templates = await Api.listTorTemplates();
    } catch (e) {
      _error = '$e';
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _delete(TorTemplate tpl) async {
    final l10n = L10n.of(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.t('tor.templates.delete')),
        content: Text(l10n.t('tor.templates.confirm.delete')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(l10n.t('common.back'))),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Tokens.danger),
            child: Text(l10n.t('tor.templates.delete')),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    setState(() => _deletingId = tpl.id);
    try {
      await Api.deleteTorTemplate(tpl.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.t('tor.templates.toast.deleted'))),
      );
      await _load();
    } catch (err) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${l10n.t('common.error')}: $err'), backgroundColor: Tokens.danger),
      );
    } finally {
      if (mounted) setState(() => _deletingId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('tor.templates.heading')),
        actions: const [LangButton()],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/gov/tor/templates/new'),
        icon: const Icon(Icons.add),
        label: Text(l10n.t('tor.templates.create')),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _templates.isEmpty
                      ? ListView(
                          children: [
                            SizedBox(
                              height: MediaQuery.of(context).size.height * 0.4,
                              child: Center(
                                child: Text(
                                  l10n.t('tor.templates.empty'),
                                  style: const TextStyle(color: Tokens.gray500),
                                ),
                              ),
                            ),
                          ],
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _templates.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) => _TemplateCard(
                            tpl: _templates[i],
                            deleting: _deletingId == _templates[i].id,
                            onEdit: () => context.push('/gov/tor/templates/${_templates[i].id}/edit'),
                            onDelete: () => _delete(_templates[i]),
                          ),
                        ),
                ),
    );
  }
}

class _TemplateCard extends StatelessWidget {
  const _TemplateCard({
    required this.tpl,
    required this.deleting,
    required this.onEdit,
    required this.onDelete,
  });

  final TorTemplate tpl;
  final bool deleting;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final kindLabel = switch (tpl.procurementKind) {
      'services' => l10n.t('tor.kind.services'),
      'construction' => l10n.t('tor.kind.construction'),
      _ => l10n.t('tor.kind.goods'),
    };

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Tokens.gray200),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Tokens.brand50,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.description_outlined, color: Tokens.brand600, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(tpl.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _chip(kindLabel, Tokens.gray100, Tokens.gray700),
                    _chip(
                      tpl.isOfficial ? l10n.t('tor.template.official') : l10n.t('tor.templates.custom'),
                      tpl.isOfficial ? const Color(0xFFD1FAE5) : Tokens.gray100,
                      tpl.isOfficial ? const Color(0xFF047857) : Tokens.gray700,
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (tpl.isEditable) ...[
            IconButton(
              onPressed: deleting ? null : onEdit,
              icon: const Icon(Icons.edit_outlined, size: 20),
              tooltip: l10n.t('tor.templates.edit'),
            ),
            IconButton(
              onPressed: deleting ? null : onDelete,
              icon: deleting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.delete_outline, size: 20, color: Tokens.danger),
              tooltip: l10n.t('tor.templates.delete'),
            ),
          ],
        ],
      ),
    );
  }

  Widget _chip(String label, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
    );
  }
}
