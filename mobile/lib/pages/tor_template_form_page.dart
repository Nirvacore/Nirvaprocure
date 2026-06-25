import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

const _defaultBody = '''## ขอบเขตของงาน
{{scope}}

## งบประมาณ
{{budget_minor}} {{currency}}

## สิ่งที่ต้องส่งมอบ
{{deliverables}}''';

class TorTemplateFormPage extends StatefulWidget {
  const TorTemplateFormPage({super.key, this.templateId});
  final String? templateId;

  bool get isEdit => templateId != null;

  @override
  State<TorTemplateFormPage> createState() => _TorTemplateFormPageState();
}

class _TorTemplateFormPageState extends State<TorTemplateFormPage> {
  final _nameCtrl = TextEditingController();
  final _bodyCtrl = TextEditingController(text: _defaultBody);

  bool _loading = false;
  bool _submitting = false;
  String _kind = 'goods';

  static const _kinds = ['goods', 'services', 'construction'];

  @override
  void initState() {
    super.initState();
    if (widget.isEdit) _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _bodyCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final tpl = await Api.getTorTemplate(widget.templateId!);
      if (!mounted) return;
      if (!tpl.isEditable) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(L10n.of(context).t('common.error'))),
        );
        context.pop();
        return;
      }
      _nameCtrl.text = tpl.name;
      _bodyCtrl.text = tpl.bodyMarkdown;
      setState(() => _kind = tpl.procurementKind);
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${L10n.of(context).t('err.load')}: $err')),
        );
        context.pop();
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    final l10n = L10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    if (_nameCtrl.text.trim().isEmpty) {
      messenger.showSnackBar(SnackBar(content: Text(l10n.t('tor.err.required'))));
      return;
    }

    setState(() => _submitting = true);
    try {
      if (widget.isEdit) {
        await Api.updateTorTemplate(
          widget.templateId!,
          name: _nameCtrl.text.trim(),
          procurementKind: _kind,
          bodyMarkdown: _bodyCtrl.text,
        );
        messenger.showSnackBar(SnackBar(content: Text(l10n.t('tor.templates.toast.updated'))));
      } else {
        await Api.createTorTemplate(
          name: _nameCtrl.text.trim(),
          procurementKind: _kind,
          bodyMarkdown: _bodyCtrl.text,
        );
        messenger.showSnackBar(SnackBar(content: Text(l10n.t('tor.templates.toast.created'))));
      }
      if (!mounted) return;
      context.go('/gov/tor/templates');
    } catch (err) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('${l10n.t('common.error')}: $err'),
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

    if (_loading) {
      return Scaffold(
        appBar: AppBar(title: Text(l10n.t('tor.templates.heading'))),
        body: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.isEdit ? l10n.t('tor.templates.edit') : l10n.t('tor.templates.create')),
        actions: const [LangButton()],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(l10n.t('tor.templates.name'), style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(
            controller: _nameCtrl,
            enabled: !_submitting,
            decoration: InputDecoration(
              hintText: l10n.t('tor.templates.name.placeholder'),
              filled: true,
              fillColor: Tokens.gray50,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(l10n.t('tor.kind.label'), style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _kinds.map((k) {
              final selected = _kind == k;
              return ChoiceChip(
                label: Text(_kindLabel(k, l10n)),
                selected: selected,
                onSelected: _submitting ? null : (_) => setState(() => _kind = k),
                selectedColor: Tokens.brand50,
              );
            }).toList(),
          ),
          const SizedBox(height: 16),
          Text(l10n.t('tor.templates.body'), style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(l10n.t('tor.templates.body.hint'), style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
          const SizedBox(height: 8),
          TextField(
            controller: _bodyCtrl,
            enabled: !_submitting,
            maxLines: 12,
            style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
            decoration: InputDecoration(
              filled: true,
              fillColor: Tokens.gray50,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _submitting ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(l10n.t('tor.templates.save')),
            ),
          ),
        ],
      ),
    );
  }

  String _kindLabel(String kind, L10n l10n) => switch (kind) {
        'services' => l10n.t('tor.kind.services'),
        'construction' => l10n.t('tor.kind.construction'),
        _ => l10n.t('tor.kind.goods'),
      };
}
