import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class PrCreatePage extends StatefulWidget {
  const PrCreatePage({super.key});
  @override
  State<PrCreatePage> createState() => _PrCreatePageState();
}

class _PrCreatePageState extends State<PrCreatePage> {
  final _title  = TextEditingController();
  final _reason = TextEditingController();
  final _url    = TextEditingController();
  final List<_DraftItem> _items = [];
  bool _parsing = false;
  bool _submitting = false;

  static final _baht = NumberFormat.currency(locale: 'en_US', symbol: '฿ ', decimalDigits: 2);

  int get _totalMinor => _items.fold(0, (s, it) => s + (it.qty * it.priceMinor).toInt());

  @override
  void dispose() {
    _title.dispose();
    _reason.dispose();
    _url.dispose();
    super.dispose();
  }

  Future<void> _parseLink() async {
    final url = _url.text.trim();
    if (url.isEmpty) return;
    final l10n      = L10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _parsing = true);
    try {
      final parsed = await Api.importLink(url);
      setState(() {
        _items.add(_DraftItem(
          description:  (parsed['description'] as String?) ?? l10n.t('pr.new.item.default'),
          qty:          1,
          priceMinor:   (parsed['unit_price_minor'] as int?) ?? 0,
          source:       (parsed['source'] as String?) ?? 'shopee',
          supplierName: (parsed['supplier'] as Map?)?['name'] as String?,
        ));
        _url.clear();
      });
    } catch (_) {
      setState(() {
        _items.add(_DraftItem(
          description: l10n.t('pr.new.item.default'),
          qty: 1, priceMinor: 0, source: 'manual',
        ));
        _url.clear();
      });
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.t('pr.new.toast.offline'))),
      );
    } finally {
      if (mounted) setState(() => _parsing = false);
    }
  }

  Future<void> _submit() async {
    final l10n      = L10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    if (_title.text.trim().isEmpty || _items.isEmpty) {
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.t('pr.new.toast.required'))),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final pr = await Api.createPr(
        title: _title.text.trim(),
        justification: _reason.text.trim().isEmpty ? null : _reason.text.trim(),
        items: _items.map((it) => {
          'description':      it.description,
          'quantity':         it.qty,
          'unit':             'unit',
          'unit_price_minor': it.priceMinor,
          if (it.source != 'manual') 'source': it.source,
        }).toList(),
      );
      await Api.submitPr(pr.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(L10n.of(context).t('pr.new.toast.submitted'))),
      );
      context.go('/pr');
    } catch (err) {
      messenger.showSnackBar(
        SnackBar(
          content: Text('${l10n.t('err.submit')}: $err'),
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
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('pr.new.heading')),
        actions: const [LangButton()],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Hero paste-link card.
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Tokens.brand50,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Tokens.brand100, width: 2),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(Icons.link, color: Tokens.brand600),
                  const SizedBox(width: 8),
                  Text(l10n.t('pr.new.paste.label'),
                    style: const TextStyle(color: Tokens.brand600, fontWeight: FontWeight.bold)),
                ]),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: _url,
                      decoration: const InputDecoration(hintText: 'https://shopee.co.th/...'),
                      keyboardType: TextInputType.url,
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _parsing ? null : _parseLink,
                    child: _parsing
                      ? const SizedBox(width: 20, height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text(l10n.t('pr.new.paste.button')),
                  ),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 20),

          Text(l10n.t('pr.new.title.label'),
              style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(
            controller: _title,
            decoration: InputDecoration(hintText: l10n.t('pr.new.title.hint')),
          ),
          const SizedBox(height: 16),

          Text(l10n.t('pr.new.reason.label'),
              style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(
            controller: _reason,
            maxLines: 3,
            decoration: InputDecoration(hintText: l10n.t('pr.new.reason.hint')),
          ),
          const SizedBox(height: 20),

          Text(l10n.t('pr.new.items.label'),
              style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          if (_items.isEmpty)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Tokens.gray50,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Tokens.gray200, width: 2),
              ),
              child: Center(child: Text(l10n.t('pr.new.items.empty'),
                  style: const TextStyle(color: Tokens.gray500))),
            )
          else
            ..._items.asMap().entries.map((e) => _ItemRow(
              key: ValueKey(e.key),
              item: e.value,
              onChange: () => setState(() {}),
              onRemove: () => setState(() => _items.removeAt(e.key)),
              baht: _baht,
            )),
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => setState(() => _items.add(
              _DraftItem(description: '', qty: 1, priceMinor: 0, source: 'manual'))),
            icon: const Icon(Icons.add),
            label: Text(l10n.t('pr.new.items.add')),
          ),

          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(l10n.t('pr.new.total'),
                style: const TextStyle(fontSize: 16, color: Tokens.gray500)),
              Text(_baht.format(_totalMinor / 100),
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 24),

          ElevatedButton.icon(
            onPressed: _submitting ? null : _submit,
            icon: _submitting
              ? const SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Icon(Icons.send),
            label: Text(l10n.t(_submitting ? 'pr.new.submitting' : 'pr.new.submit')),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => context.go('/'),
            child: Text(l10n.t('pr.new.save_draft')),
          ),
        ],
      ),
    );
  }
}

class _DraftItem {
  _DraftItem({
    required this.description, required this.qty, required this.priceMinor,
    required this.source, this.supplierName,
  });
  String description;
  double qty;
  int    priceMinor;
  String source;
  String? supplierName;
}

class _ItemRow extends StatefulWidget {
  const _ItemRow({
    super.key, required this.item, required this.onChange,
    required this.onRemove, required this.baht,
  });
  final _DraftItem item;
  final VoidCallback onChange, onRemove;
  final NumberFormat baht;

  @override
  State<_ItemRow> createState() => _ItemRowState();
}

class _ItemRowState extends State<_ItemRow> {
  late final TextEditingController _desc;
  late final TextEditingController _qty;
  late final TextEditingController _price;

  @override
  void initState() {
    super.initState();
    _desc  = TextEditingController(text: widget.item.description);
    _qty   = TextEditingController(text: widget.item.qty.toString());
    _price = TextEditingController(text: (widget.item.priceMinor / 100).toString());
  }

  @override
  void dispose() {
    _desc.dispose();
    _qty.dispose();
    _price.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n     = L10n.of(context);
    final lineTotal = (widget.item.qty * widget.item.priceMinor).toInt();
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Tokens.gray50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Tokens.gray200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            _sourceBadge(widget.item.source, l10n),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _desc,
                decoration: InputDecoration(
                  hintText: l10n.t('pr.new.item.desc.hint'),
                  isDense: true,
                ),
                onChanged: (v) { widget.item.description = v; widget.onChange(); },
              ),
            ),
            IconButton(
              onPressed: widget.onRemove,
              icon: const Icon(Icons.delete_outline),
              color: Tokens.danger,
            ),
          ]),
          if (widget.item.supplierName != null) ...[
            const SizedBox(height: 4),
            Text(l10n.t('pr.new.item.supplier', {'name': widget.item.supplierName!}),
              style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
          ],
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: TextField(
              controller: _qty,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(labelText: l10n.t('pr.new.item.qty'), isDense: true),
              onChanged: (v) {
                widget.item.qty = double.tryParse(v) ?? 1;
                widget.onChange();
                setState(() {});
              },
            )),
            const SizedBox(width: 8),
            Expanded(child: TextField(
              controller: _price,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(labelText: l10n.t('pr.new.item.price'), isDense: true),
              onChanged: (v) {
                widget.item.priceMinor = ((double.tryParse(v) ?? 0) * 100).round();
                widget.onChange();
                setState(() {});
              },
            )),
            const SizedBox(width: 8),
            Expanded(child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.t('pr.new.item.total'),
                    style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Tokens.gray200),
                  ),
                  child: Text(widget.baht.format(lineTotal / 100),
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            )),
          ]),
        ],
      ),
    );
  }

  Widget _sourceBadge(String s, L10n l10n) {
    final (label, bg, fg) = switch (s) {
      'shopee'  => ('🛒 Shopee',  const Color(0xFFFFEDD5), const Color(0xFF9A3412)),
      'lazada'  => ('🛍️ Lazada',  const Color(0xFFDBEAFE), const Color(0xFF1E3A8A)),
      'makro'   => ('🛒 Makro',   const Color(0xFFFEF9C3), const Color(0xFF854D0E)),
      'alibaba' => ('📦 Alibaba', const Color(0xFFFFEDD5), const Color(0xFF9A3412)),
      _         => (l10n.t('pr.new.item.manual'), Tokens.gray100, Tokens.gray700),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }
}
