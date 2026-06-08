import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../l10n/l10n.dart';
import '../api/endpoints.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class StockPage extends StatefulWidget {
  const StockPage({super.key});

  @override
  State<StockPage> createState() => _StockPageState();
}

class _StockPageState extends State<StockPage> {
  List<StockWarehouse>? _warehouses;
  List<StockOnHand>? _items;
  String? _selectedWarehouse; // null = all
  bool _loading = true;
  String? _error;
  final _searchCtrl = TextEditingController();
  String _query = '';
  Timer? _debounce;

  List<StockOnHand> get _filtered {
    if (_items == null) return [];
    if (_query.isEmpty) return _items!;
    final q = _query.toLowerCase();
    return _items!.where((s) =>
      s.name.toLowerCase().contains(q) ||
      s.sku.toLowerCase().contains(q)
    ).toList();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 250), () {
      if (mounted) setState(() => _query = value.toLowerCase().trim());
    });
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        Api.listWarehouses(),
        Api.stockOnHand(warehouseId: _selectedWarehouse),
      ]);
      if (!mounted) return;
      setState(() {
        _warehouses = results[0] as List<StockWarehouse>;
        _items = results[1] as List<StockOnHand>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _filterByWarehouse(String? warehouseId) async {
    _selectedWarehouse = warehouseId;
    setState(() { _loading = true; });
    try {
      final items = await Api.stockOnHand(warehouseId: warehouseId);
      if (!mounted) return;
      setState(() { _items = items; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _openAdjustSheet(StockOnHand item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _AdjustSheet(
        item: item,
        onSuccess: _load,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final lowCount = _items?.where((r) => r.belowReorder).length ?? 0;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('stock.heading'), style: const TextStyle(fontWeight: FontWeight.bold)),
        actions: const [LangButton()],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading && _items == null
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
            : _error != null && _items == null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(l10n.t('err.load'), style: TextStyle(color: Colors.red.shade700)),
                        const SizedBox(height: 8),
                        TextButton(onPressed: _load, child: Text(l10n.t('common.back'))),
                      ],
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      // ── Search bar ─────────────────────────────────
                      TextField(
                        controller: _searchCtrl,
                        onChanged: _onSearchChanged,
                        decoration: InputDecoration(
                          hintText: l10n.t('stock.search_hint'),
                          prefixIcon: const Icon(Icons.search, size: 20),
                          suffixIcon: _query.isNotEmpty
                              ? IconButton(
                                  icon: const Icon(Icons.close, size: 18),
                                  onPressed: () {
                                    _searchCtrl.clear();
                                    setState(() => _query = '');
                                  },
                                )
                              : null,
                          isDense: true,
                          filled: true,
                          fillColor: Tokens.gray100,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: BorderSide.none,
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Subtitle
                      Text(l10n.t('stock.sub'),
                          style: TextStyle(fontSize: 14, color: Tokens.gray500)),
                      const SizedBox(height: 12),

                      // Low stock alert
                      if (lowCount > 0) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEF3C7),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(children: [
                            const Icon(Icons.warning_amber_rounded, color: Color(0xFFB45309), size: 20),
                            const SizedBox(width: 8),
                            Text(
                              l10n.t('stock.alert.low', args: {'count': '$lowCount'}),
                              style: const TextStyle(
                                  color: Color(0xFF92400E), fontWeight: FontWeight.w600, fontSize: 14),
                            ),
                          ]),
                        ),
                        const SizedBox(height: 12),
                      ],

                      // Warehouse filter chips
                      if (_warehouses != null && _warehouses!.isNotEmpty)
                        SizedBox(
                          height: 40,
                          child: ListView(
                            scrollDirection: Axis.horizontal,
                            children: [
                              _FilterChip(
                                label: l10n.t('stock.filter.all'),
                                selected: _selectedWarehouse == null,
                                onTap: () => _filterByWarehouse(null),
                              ),
                              const SizedBox(width: 8),
                              ..._warehouses!.map((w) => Padding(
                                    padding: const EdgeInsets.only(right: 8),
                                    child: _FilterChip(
                                      label: '${w.code} · ${w.name}',
                                      selected: _selectedWarehouse == w.id,
                                      onTap: () => _filterByWarehouse(w.id),
                                    ),
                                  )),
                            ],
                          ),
                        ),
                      const SizedBox(height: 16),

                      // Result count when searching
                      if (_query.isNotEmpty && _items != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          l10n.t('stock.search_results')
                              .replaceAll('{count}', '${_filtered.length}'),
                          style: TextStyle(fontSize: 12, color: Tokens.gray500),
                        ),
                        const SizedBox(height: 8),
                      ],

                      // Items
                      if (_items != null && _filtered.isEmpty)
                        _EmptyState(
                          label: _query.isNotEmpty
                              ? l10n.t('stock.search_no_results')
                              : l10n.t('stock.empty'),
                        ),

                      if (_items != null)
                        ..._filtered.map((row) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: _StockCard(
                                row: row,
                                l10n: l10n,
                                onAdjust: () => _openAdjustSheet(row),
                              ),
                            )),
                    ],
                  ),
      ),
    );
  }
}

// ─── Subwidgets ──────────────────────────────────────────────────────────────

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? Tokens.brand600 : Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? Tokens.brand600 : const Color(0xFFD1D5DB)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : Tokens.gray700,
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Tokens.gray200),
      ),
      child: Column(children: [
        const Icon(Icons.inventory_2_outlined, size: 48, color: Color(0xFFD1D5DB)),
        const SizedBox(height: 12),
        Text(label,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Tokens.gray500)),
      ]),
    );
  }
}

class _StockCard extends StatelessWidget {
  const _StockCard({required this.row, required this.l10n, required this.onAdjust});
  final StockOnHand row;
  final L10n l10n;
  final VoidCallback onAdjust;

  @override
  Widget build(BuildContext context) {
    final low = row.belowReorder;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: low ? const Color(0xFFFCD34D) : Tokens.gray200, width: low ? 2 : 1),
        boxShadow: [
          BoxShadow(color: Colors.black.withAlpha(8), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: icon + sku + name + warehouse
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: low ? const Color(0xFFFEF3C7) : Tokens.gray100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  low ? Icons.warning_amber_rounded : Icons.inventory_2_outlined,
                  color: low ? const Color(0xFFB45309) : Tokens.gray500,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(row.sku, style: TextStyle(fontSize: 11, color: Tokens.gray500, fontFamily: 'monospace')),
                    const SizedBox(height: 2),
                    Text(row.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 2),
                    Text('${row.warehouseCode} · ${row.warehouseName}',
                        style: TextStyle(fontSize: 12, color: Tokens.gray500)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 12),
          // Qty row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(l10n.t('stock.card.qty'), style: TextStyle(fontSize: 13, color: Tokens.gray500)),
              Text.rich(TextSpan(children: [
                TextSpan(
                  text: '${row.qty} ',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: low ? const Color(0xFF92400E) : const Color(0xFF111827),
                  ),
                ),
                TextSpan(
                  text: row.unit,
                  style: TextStyle(fontSize: 14, color: Tokens.gray500),
                ),
              ])),
            ],
          ),
          // Reorder point row
          if (row.reorderPoint != null) ...[
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(l10n.t('stock.card.reorder'), style: TextStyle(fontSize: 13, color: Tokens.gray500)),
                Text('${row.reorderPoint}',
                    style: TextStyle(fontSize: 14, color: Tokens.gray700, fontFamily: 'monospace')),
              ],
            ),
          ],
          const SizedBox(height: 12),
          // Action buttons
          Row(children: [
            Expanded(
              child: OutlinedButton(
                onPressed: onAdjust,
                style: OutlinedButton.styleFrom(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
                child: Text(l10n.t('stock.card.adjust'),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
              ),
            ),
            if (low) ...[
              const SizedBox(width: 8),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => context.push('/pr/new'),
                  icon: const Icon(Icons.refresh, size: 16),
                  label: Text(l10n.t('stock.card.reorder_btn'),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  style: FilledButton.styleFrom(
                    backgroundColor: Tokens.brand600,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ]),
        ],
      ),
    );
  }
}

// ─── Stock Adjustment Bottom Sheet ──────────────────────────────────────────
class _AdjustSheet extends StatefulWidget {
  const _AdjustSheet({required this.item, required this.onSuccess});
  final StockOnHand item;
  final VoidCallback onSuccess;

  @override
  State<_AdjustSheet> createState() => _AdjustSheetState();
}

class _AdjustSheetState extends State<_AdjustSheet> {
  int _qty = 1;
  bool _isIncrease = true; // true = adjust_in, false = adjust_out
  final _noteCtrl = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _noteCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = L10n.of(context);
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);

    setState(() => _saving = true);
    try {
      await Api.recordStockMovement(
        itemId: widget.item.itemId,
        warehouseId: widget.item.warehouseId,
        type: _isIncrease ? 'adjust_in' : 'adjust_out',
        qty: _qty,
        note: _noteCtrl.text,
      );
      nav.pop();
      messenger.showSnackBar(SnackBar(
        content: Text(l10n.t('stock.adjust_success')),
        backgroundColor: const Color(0xFF16A34A),
      ));
      widget.onSuccess();
    } catch (e) {
      messenger.showSnackBar(SnackBar(
        content: Text(l10n.t('stock.adjust_fail')),
        backgroundColor: const Color(0xFFDC2626),
      ));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Handle bar
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(color: const Color(0xFFD1D5DB), borderRadius: BorderRadius.circular(2)),
            ),
          ),
          const SizedBox(height: 16),

          // Title
          Text(l10n.t('stock.card.adjust'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text('${widget.item.name} · ${widget.item.sku}',
              style: TextStyle(fontSize: 14, color: Tokens.gray500)),
          Text('${l10n.t('stock.card.qty')}: ${widget.item.qty} ${widget.item.unit}',
              style: TextStyle(fontSize: 13, color: Tokens.gray500)),
          const SizedBox(height: 20),

          // Direction toggle
          Text(l10n.t('stock.adjust_direction'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _isIncrease = true),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: _isIncrease ? const Color(0xFFDCFCE7) : Tokens.gray100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: _isIncrease ? const Color(0xFF16A34A) : const Color(0xFFD1D5DB),
                        width: _isIncrease ? 2 : 1,
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_circle_outline,
                            size: 20, color: _isIncrease ? const Color(0xFF16A34A) : Tokens.gray500),
                        const SizedBox(width: 6),
                        Text(l10n.t('stock.adjust_in'),
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: _isIncrease ? const Color(0xFF16A34A) : Tokens.gray500,
                            )),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _isIncrease = false),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    decoration: BoxDecoration(
                      color: !_isIncrease ? const Color(0xFFFEF2F2) : Tokens.gray100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: !_isIncrease ? const Color(0xFFDC2626) : const Color(0xFFD1D5DB),
                        width: !_isIncrease ? 2 : 1,
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.remove_circle_outline,
                            size: 20, color: !_isIncrease ? const Color(0xFFDC2626) : Tokens.gray500),
                        const SizedBox(width: 6),
                        Text(l10n.t('stock.adjust_out'),
                            style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: !_isIncrease ? const Color(0xFFDC2626) : Tokens.gray500,
                            )),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Qty stepper
          Text(l10n.t('stock.adjust_qty'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _StepperButton(
                icon: Icons.remove,
                onTap: _qty > 1 ? () => setState(() => _qty--) : null,
              ),
              const SizedBox(width: 16),
              Container(
                width: 80,
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  color: Tokens.gray100,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  '$_qty',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 16),
              _StepperButton(
                icon: Icons.add,
                onTap: () => setState(() => _qty++),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Note field
          Text(l10n.t('stock.adjust_note'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          TextField(
            controller: _noteCtrl,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: l10n.t('stock.adjust_note_hint'),
              filled: true,
              fillColor: Tokens.gray100,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Submit button
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: _isIncrease ? const Color(0xFF16A34A) : const Color(0xFFDC2626),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _saving
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(
                      '${_isIncrease ? '+' : '-'}$_qty ${widget.item.unit}  ·  ${l10n.t('stock.adjust_confirm')}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({required this.icon, this.onTap});
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 48, height: 48,
        decoration: BoxDecoration(
          color: onTap != null ? Tokens.brand600.withAlpha(20) : Tokens.gray100,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: onTap != null ? Tokens.brand600 : const Color(0xFFD1D5DB)),
        ),
        child: Icon(icon, color: onTap != null ? Tokens.brand600 : Tokens.gray500),
      ),
    );
  }
}
