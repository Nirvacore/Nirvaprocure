import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class TorCreatePage extends StatefulWidget {
  const TorCreatePage({super.key});

  @override
  State<TorCreatePage> createState() => _TorCreatePageState();
}

class _TorCreatePageState extends State<TorCreatePage> {
  final _titleCtrl = TextEditingController();
  final _budgetCtrl = TextEditingController();
  final _scopeCtrl = TextEditingController();
  final List<TextEditingController> _deliverableCtrls = [TextEditingController()];

  List<TorTemplate> _templates = [];
  bool _loadingTemplates = true;
  bool _submitting = false;
  String? _templateId;
  String _kind = 'goods';
  String _evalMethod = 'lowest_price';
  DateTime? _start;
  DateTime? _end;

  static const _kinds = ['goods', 'services', 'construction'];

  @override
  void initState() {
    super.initState();
    _loadTemplates();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _budgetCtrl.dispose();
    _scopeCtrl.dispose();
    for (final c in _deliverableCtrls) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadTemplates() async {
    try {
      _templates = await Api.listTorTemplates();
    } catch (_) {
      _templates = [];
    }
    if (mounted) setState(() => _loadingTemplates = false);
  }

  void _selectTemplate(String? id) {
    setState(() {
      _templateId = id;
      if (id == null) return;
      final tpl = _templates.where((t) => t.id == id).firstOrNull;
      if (tpl != null) _kind = tpl.procurementKind;
    });
  }

  Future<void> _pickDate({required bool start}) async {
    final initial = start ? (_start ?? DateTime.now()) : (_end ?? DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked == null || !mounted) return;
    setState(() {
      if (start) {
        _start = picked;
      } else {
        _end = picked;
      }
    });
  }

  Map<String, dynamic> _buildBrief() {
    final budgetBaht = double.tryParse(_budgetCtrl.text.trim()) ?? 0;
    final deliverables = _deliverableCtrls
        .map((c) => c.text.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    return {
      'procurement_kind': _kind,
      'budget_minor': (budgetBaht * 100).round(),
      'currency': 'THB',
      'scope': _scopeCtrl.text.trim(),
      'deliverables': deliverables,
      'evaluation_method': _evalMethod,
      if (_start != null || _end != null)
        'timeline': {
          if (_start != null) 'start': DateFormat('yyyy-MM-dd').format(_start!),
          if (_end != null) 'end': DateFormat('yyyy-MM-dd').format(_end!),
        },
    };
  }

  Future<void> _submit() async {
    final l10n = L10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    if (_titleCtrl.text.trim().isEmpty || _scopeCtrl.text.trim().isEmpty) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.t('tor.err.required'))));
      return;
    }
    setState(() => _submitting = true);
    try {
      final draft = await Api.createTorDraft(
        title: _titleCtrl.text.trim(),
        templateId: _templateId,
        brief: _buildBrief(),
      );
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(l10n.t('tor.toast.created'))));
      context.go('/gov/tor/${draft.id}');
    } catch (err) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('${l10n.t('tor.err.create')}: $err'),
          backgroundColor: Tokens.danger,
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final dateFmt = DateFormat.yMMMd(l10n.locale.languageCode);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('tor.heading')),
        actions: const [LangButton()],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            l10n.t('tor.sub'),
            style: const TextStyle(color: Tokens.gray600, height: 1.4),
          ),
          const SizedBox(height: 20),

          Text(l10n.t('tor.template.label'), style: _labelStyle),
          const SizedBox(height: 6),
          _loadingTemplates
              ? const LinearProgressIndicator(minHeight: 2)
              : DropdownButtonFormField<String?>(
                  value: _templateId,
                  decoration: _inputDecoration,
                  items: [
                    DropdownMenuItem(value: null, child: Text(l10n.t('tor.template.none'))),
                    ..._templates.map((tpl) => DropdownMenuItem(
                          value: tpl.id,
                          child: Text(
                            tpl.isOfficial
                                ? '${tpl.name} (${l10n.t('tor.template.official')})'
                                : tpl.name,
                          ),
                        )),
                  ],
                  onChanged: _submitting ? null : _selectTemplate,
                ),
          const SizedBox(height: 4),
          Text(l10n.t('tor.template.hint'), style: _hintStyle),
          const SizedBox(height: 16),

          Text(l10n.t('tor.kind.label'), style: _labelStyle),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _kinds.map((k) {
              final selected = _kind == k;
              return ChoiceChip(
                label: Text(l10n.t(_kindKey(k))),
                selected: selected,
                onSelected: _submitting ? null : (_) => setState(() => _kind = k),
                selectedColor: Tokens.brand50,
                labelStyle: TextStyle(
                  color: selected ? Tokens.brand700 : Tokens.gray700,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 16),

          Text(l10n.t('tor.title.label'), style: _labelStyle),
          const SizedBox(height: 6),
          TextField(
            controller: _titleCtrl,
            enabled: !_submitting,
            decoration: _inputDecoration.copyWith(hintText: l10n.t('tor.title.placeholder')),
          ),
          const SizedBox(height: 16),

          Text(l10n.t('tor.budget.label'), style: _labelStyle),
          const SizedBox(height: 6),
          TextField(
            controller: _budgetCtrl,
            enabled: !_submitting,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: _inputDecoration.copyWith(hintText: '500000'),
          ),
          const SizedBox(height: 16),

          Text(l10n.t('tor.eval.label'), style: _labelStyle),
          const SizedBox(height: 6),
          DropdownButtonFormField<String>(
            value: _evalMethod,
            decoration: _inputDecoration,
            items: [
              DropdownMenuItem(value: 'lowest_price', child: Text(l10n.t('tor.eval.lowest'))),
              DropdownMenuItem(
                value: 'most_advantageous',
                child: Text(l10n.t('tor.eval.advantageous')),
              ),
            ],
            onChanged: _submitting ? null : (v) => setState(() => _evalMethod = v ?? 'lowest_price'),
          ),
          const SizedBox(height: 16),

          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.t('tor.start.label'), style: _labelStyle),
                    const SizedBox(height: 6),
                    _DateTile(
                      label: _start != null ? dateFmt.format(_start!) : '—',
                      onTap: _submitting ? null : () => _pickDate(start: true),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.t('tor.end.label'), style: _labelStyle),
                    const SizedBox(height: 6),
                    _DateTile(
                      label: _end != null ? dateFmt.format(_end!) : '—',
                      onTap: _submitting ? null : () => _pickDate(start: false),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          Text(l10n.t('tor.scope.label'), style: _labelStyle),
          const SizedBox(height: 6),
          TextField(
            controller: _scopeCtrl,
            enabled: !_submitting,
            maxLines: 5,
            decoration: _inputDecoration.copyWith(hintText: l10n.t('tor.scope.placeholder')),
          ),
          const SizedBox(height: 16),

          Text(l10n.t('tor.deliverables.label'), style: _labelStyle),
          const SizedBox(height: 8),
          ..._deliverableCtrls.asMap().entries.map((e) {
            final i = e.key;
            final ctrl = e.value;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: ctrl,
                      enabled: !_submitting,
                      decoration: _inputDecoration.copyWith(
                        hintText: l10n.t('tor.deliverables.placeholder', {'n': '${i + 1}'}),
                      ),
                    ),
                  ),
                  if (_deliverableCtrls.length > 1)
                    IconButton(
                      onPressed: _submitting
                          ? null
                          : () => setState(() {
                                ctrl.dispose();
                                _deliverableCtrls.removeAt(i);
                              }),
                      icon: const Icon(Icons.remove_circle_outline, color: Tokens.danger),
                    ),
                ],
              ),
            );
          }),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: _submitting
                  ? null
                  : () => setState(() => _deliverableCtrls.add(TextEditingController())),
              icon: const Icon(Icons.add, size: 18),
              label: Text(l10n.t('pr.new.items.add')),
            ),
          ),
          const SizedBox(height: 12),

          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Tokens.gray50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Tokens.gray200),
            ),
            child: Text(
              l10n.t('tor.checklist.hint'),
              style: const TextStyle(fontSize: 13, color: Tokens.gray600, height: 1.4),
            ),
          ),
          const SizedBox(height: 20),

          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _submitting ? null : _submit,
              icon: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.auto_awesome),
              label: Text(_submitting ? l10n.t('tor.busy') : l10n.t('tor.cta')),
            ),
          ),
        ],
      ),
    );
  }

  String _kindKey(String kind) => switch (kind) {
        'services' => 'tor.kind.services',
        'construction' => 'tor.kind.construction',
        _ => 'tor.kind.goods',
      };

  static const _labelStyle = TextStyle(fontWeight: FontWeight.w600);
  static const _hintStyle = TextStyle(fontSize: 12, color: Tokens.gray500);

  static final _inputDecoration = InputDecoration(
    filled: true,
    fillColor: Tokens.gray50,
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide.none,
    ),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
  );
}

class _DateTile extends StatelessWidget {
  const _DateTile({required this.label, this.onTap});
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: Tokens.gray50,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today_outlined, size: 18, color: Tokens.gray500),
            const SizedBox(width: 8),
            Expanded(child: Text(label, style: const TextStyle(color: Tokens.gray700))),
          ],
        ),
      ),
    );
  }
}
