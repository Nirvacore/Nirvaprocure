import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../api/api_client.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class PrDetailPage extends StatefulWidget {
  const PrDetailPage({super.key, required this.id});
  final String id;

  @override
  State<PrDetailPage> createState() => _PrDetailPageState();
}

class _PrDetailPageState extends State<PrDetailPage> {
  late Future<Map<String, dynamic>> _future;
  static final _baht = NumberFormat.currency(locale: 'en_US', symbol: '฿ ', decimalDigits: 2);

  @override
  void initState() {
    super.initState();
    _future = _fetch();
  }

  Future<Map<String, dynamic>> _fetch() async {
    final res = await ApiClient.instance.raw.get('/pr/${widget.id}');
    return res.data as Map<String, dynamic>;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('detail.heading')),
        actions: const [LangButton()],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
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
          final pr = snap.data!;
          final items    = (pr['items'] as List?) ?? const [];
          final approval = pr['approval'] as Map<String, dynamic>?;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _HeaderCard(pr: pr, baht: _baht),
              const SizedBox(height: 12),
              _SectionCard(
                title: l10n.t('detail.items'),
                child: Column(
                  children: items
                      .map<Widget>((it) =>
                          _ItemRow(item: it as Map<String, dynamic>, baht: _baht))
                      .toList(),
                ),
              ),
              const SizedBox(height: 12),
              if ((pr['justification'] as String?)?.isNotEmpty == true)
                _SectionCard(
                  title: l10n.t('detail.reason'),
                  child: Text(pr['justification'] as String,
                      style: const TextStyle(fontSize: 16, height: 1.5)),
                ),
              if (approval != null) ...[
                const SizedBox(height: 12),
                _SectionCard(
                  title: l10n.t('detail.steps'),
                  child: _ApprovalTrail(approval: approval),
                ),
              ],
              const SizedBox(height: 12),
              _AttachmentsSection(prId: widget.id),
              const SizedBox(height: 12),
              _LinkedPoCard(prId: widget.id),
              const SizedBox(height: 12),
              if (pr['status'] == 'approved')
                _CreatePoButton(prId: widget.id, prNumber: pr['pr_number'] as String),
              if (pr['status'] == 'approved')
                const SizedBox(height: 12),
              _CommentsSection(prId: widget.id),
            ],
          );
        },
      ),
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.pr, required this.baht});
  final Map<String, dynamic> pr;
  final NumberFormat baht;

  @override
  Widget build(BuildContext context) {
    final amount = ((pr['total'] as Map?)?['amount_minor'] ?? 0) as int;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Tokens.gray200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(pr['pr_number'] as String,
                style: const TextStyle(fontSize: 12, color: Tokens.gray500)),
            const SizedBox(height: 4),
            Text(pr['title'] as String,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _StatusChip(status: pr['status'] as String),
                Text(baht.format(amount / 100),
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              ],
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
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Tokens.gray200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.item, required this.baht});
  final Map<String, dynamic> item;
  final NumberFormat baht;

  @override
  Widget build(BuildContext context) {
    final qty       = item['quantity'] as num;
    final unitPrice = item['unit_price_minor'] as int;
    final lineTotal = item['line_total_minor'] as int;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item['description'] as String,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                const SizedBox(height: 2),
                Text('$qty × ${baht.format(unitPrice / 100)}',
                    style: const TextStyle(color: Tokens.gray500, fontSize: 13)),
              ],
            ),
          ),
          Text(baht.format(lineTotal / 100),
              style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _ApprovalTrail extends StatelessWidget {
  const _ApprovalTrail({required this.approval});
  final Map<String, dynamic> approval;

  @override
  Widget build(BuildContext context) {
    final l10n      = L10n.of(context);
    final decisions = (approval['decisions'] as List?) ?? const [];
    final status    = approval['status'] as String?;
    final children  = <Widget>[];

    for (final d in decisions) {
      final dec      = d as Map<String, dynamic>;
      final approved = dec['decision'] == 'approved';
      final by       = dec['approver_id'] as String? ?? '';
      children.add(_TrailStep(
        icon: approved ? Icons.check : Icons.close,
        iconColor: approved ? Tokens.success : Tokens.danger,
        iconBg:    approved ? const Color(0xFFDCFCE7) : const Color(0xFFFEE2E2),
        title: l10n.t(approved ? 'trail.approved' : 'trail.rejected', {'by': by}),
        subtitle: '$by · ${dec['decided_at']}',
      ));
    }
    if (status == 'pending') {
      children.add(_TrailStep(
        icon:      Icons.schedule,
        iconColor: const Color(0xFFB45309),
        iconBg:    const Color(0xFFFEF3C7),
        title:    l10n.t('trail.awaiting_next'),
        subtitle: l10n.t('trail.waiting'),
      ));
    }
    if (children.isEmpty) {
      children.add(Text(l10n.t('trail.none'),
          style: const TextStyle(color: Tokens.gray500)));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: children);
  }
}

class _TrailStep extends StatelessWidget {
  const _TrailStep({
    required this.icon, required this.iconColor, required this.iconBg,
    required this.title, required this.subtitle,
  });
  final IconData icon;
  final Color iconColor, iconBg;
  final String title, subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: iconBg, shape: BoxShape.circle),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                Text(subtitle, style: const TextStyle(color: Tokens.gray500, fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final l10n  = L10n.of(context);
    final label = l10n.t('status.$status');
    final (bg, fg) = switch (status) {
      'pending' || 'in_approval' => (const Color(0xFFFEF3C7), const Color(0xFF92400E)),
      'approved'                  => (const Color(0xFFDCFCE7), const Color(0xFF166534)),
      'rejected'                  => (const Color(0xFFFEE2E2), const Color(0xFF991B1B)),
      _                           => (Tokens.gray100,           Tokens.gray700),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 13)),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────────────────────────────────────

class _CommentsSection extends StatefulWidget {
  const _CommentsSection({required this.prId});
  final String prId;

  @override
  State<_CommentsSection> createState() => _CommentsSectionState();
}

class _CommentsSectionState extends State<_CommentsSection> {
  List<PrComment>? _items;   // null = loading
  String? _loadError;
  final _ctrl    = TextEditingController();
  bool  _sending = false;

  static final _timeFmt = DateFormat('d MMM, HH:mm');

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await Api.listComments(widget.prId);
      if (mounted) setState(() { _items = list; _loadError = null; });
    } catch (e) {
      if (mounted) setState(() { _items = []; _loadError = e.toString(); });
    }
  }

  Future<void> _send() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _sending) return;

    final l10n      = L10n.of(context);
    final messenger = ScaffoldMessenger.of(context);

    // Optimistic insert with a temp id.
    final tempId = 'temp-${DateTime.now().millisecondsSinceEpoch}';
    final temp = PrComment(
      id: tempId, body: text,
      createdAt: DateTime.now().toIso8601String(),
      authorId: '', authorName: '…',
    );
    setState(() { _items = [...?_items, temp]; });
    _ctrl.clear();
    setState(() => _sending = true);

    try {
      final saved = await Api.addComment(widget.prId, text);
      if (mounted) {
        setState(() {
          _items = (_items ?? []).map((c) => c.id == tempId ? saved : c).toList();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _items = (_items ?? []).where((c) => c.id != tempId).toList();
          _ctrl.text = text;
        });
        messenger.showSnackBar(SnackBar(
          content: Text(l10n.t('comments.failed')),
          backgroundColor: Tokens.danger,
        ));
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Tokens.gray200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.chat_bubble_outline, size: 20, color: Tokens.gray500),
              const SizedBox(width: 8),
              Text(
                '${l10n.t('comments.title')}'
                '${_items != null ? ' (${_items!.length})' : ''}',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ]),
            const SizedBox(height: 12),

            // Body: loading / error / empty / list
            if (_items == null)
              const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            else if (_items!.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(l10n.t('comments.empty'),
                    style: const TextStyle(color: Tokens.gray500, fontSize: 14)),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _items!.length,
                separatorBuilder: (_, __) => const Divider(height: 24),
                itemBuilder: (_, i) {
                  final c = _items![i];
                  final isTemp = c.id.startsWith('temp-');
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Avatar circle
                      Container(
                        width: 36, height: 36,
                        decoration: const BoxDecoration(
                          color: Tokens.brand100,
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            c.authorName.isNotEmpty ? c.authorName[0].toUpperCase() : '?',
                            style: const TextStyle(
                              color: Tokens.brand600,
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Opacity(
                          opacity: isTemp ? 0.55 : 1.0,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Text(c.authorName,
                                    style: const TextStyle(fontWeight: FontWeight.w600)),
                                const SizedBox(width: 8),
                                Text(
                                  isTemp ? '…'
                                    : _timeFmt.format(DateTime.parse(c.createdAt).toLocal()),
                                  style: const TextStyle(fontSize: 12, color: Tokens.gray500),
                                ),
                              ]),
                              const SizedBox(height: 4),
                              Text(c.body,
                                  style: const TextStyle(fontSize: 14, height: 1.5)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),

            if (_loadError != null)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text('(${l10n.t('comments.load_failed')})',
                    style: const TextStyle(fontSize: 11, color: Tokens.gray500)),
              ),

            const SizedBox(height: 16),
            const Divider(height: 1),
            const SizedBox(height: 12),

            // Compose row
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Expanded(
                child: TextField(
                  controller: _ctrl,
                  maxLines: null,
                  keyboardType: TextInputType.multiline,
                  textInputAction: TextInputAction.newline,
                  decoration: InputDecoration(
                    hintText: l10n.t('comments.placeholder'),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Tokens.gray200),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Tokens.gray200),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: _sending ? null : _send,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    backgroundColor: Tokens.brand600,
                  ),
                  child: _sending
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.send, size: 18, color: Colors.white),
                        const SizedBox(width: 6),
                        Text(l10n.t('common.send'),
                            style: const TextStyle(color: Colors.white)),
                      ]),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Attachments
// ─────────────────────────────────────────────────────────────────────────────

class _AttachmentsSection extends StatefulWidget {
  const _AttachmentsSection({required this.prId});
  final String prId;

  @override
  State<_AttachmentsSection> createState() => _AttachmentsSectionState();
}

class _AttachmentsSectionState extends State<_AttachmentsSection> {
  List<AttachmentInfo>? _items;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await Api.listAttachments(widget.prId);
      if (mounted) setState(() => _items = list);
    } catch (_) {
      if (mounted) setState(() => _items = []);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final cs = Theme.of(context).colorScheme;
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Tokens.gray200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.attach_file, size: 20, color: Tokens.gray500),
              const SizedBox(width: 8),
              Text(
                '${l10n.t('attach.title')}'
                '${_items != null ? ' (${_items!.length})' : ''}',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              IconButton(
                icon: Icon(Icons.add_circle_outline, color: cs.primary, size: 22),
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(l10n.t('attach.upload_todo'))),
                  );
                },
              ),
            ]),
            const SizedBox(height: 8),
            if (_items == null)
              const Center(child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2)))
            else if (_items!.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(l10n.t('attach.empty'),
                    style: const TextStyle(color: Tokens.gray500, fontSize: 14)),
              )
            else
              ...(_items!.map((a) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Icon(a.icon, size: 20, color: cs.primary),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(a.fileName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                              Text(a.sizeLabel, style: const TextStyle(fontSize: 11, color: Tokens.gray500)),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline, size: 18, color: Tokens.gray500),
                          onPressed: () async {
                            try {
                              await Api.deleteAttachment(widget.prId, a.id);
                              _load();
                            } catch (_) {}
                          },
                        ),
                      ],
                    ),
                  ))),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create PO from approved PR
// ─────────────────────────────────────────────────────────────────────────────

class _CreatePoButton extends StatefulWidget {
  const _CreatePoButton({required this.prId, required this.prNumber});
  final String prId;
  final String prNumber;

  @override
  State<_CreatePoButton> createState() => _CreatePoButtonState();
}

class _CreatePoButtonState extends State<_CreatePoButton> {
  bool _creating = false;

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final cs = Theme.of(context).colorScheme;

    return Card(
      elevation: 0,
      color: cs.primary.withAlpha(13),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: cs.primary.withAlpha(50)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(Icons.receipt_long, color: cs.primary, size: 28),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.t('po_create_heading'),
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: cs.onSurface)),
                  const SizedBox(height: 2),
                  Text(l10n.t('po_create_desc'),
                      style: TextStyle(fontSize: 12, color: cs.onSurface.withAlpha(153))),
                ],
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: _creating ? null : _createPo,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: _creating
                  ? const SizedBox(width: 18, height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(l10n.t('po_create_btn')),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _createPo() async {
    final l10n = L10n.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _creating = true);
    try {
      final po = await Api.createPoFromPr(widget.prId);
      messenger.showSnackBar(SnackBar(
        content: Text(l10n.t('po_create_success', {'po': po.poNumber})),
        backgroundColor: Tokens.success,
      ));
      if (mounted) context.push('/po');
    } catch (e) {
      messenger.showSnackBar(SnackBar(
        content: Text(l10n.t('po_create_fail')),
        backgroundColor: Tokens.danger,
      ));
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Linked PO — shows if a PO was already created from this PR
// ─────────────────────────────────────────────────────────────────────────────

class _LinkedPoCard extends StatefulWidget {
  const _LinkedPoCard({required this.prId});
  final String prId;

  @override
  State<_LinkedPoCard> createState() => _LinkedPoCardState();
}

class _LinkedPoCardState extends State<_LinkedPoCard> {
  PoSummary? _po;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _loadLinkedPo();
  }

  Future<void> _loadLinkedPo() async {
    try {
      final list = await Api.listPo();
      final match = list.where((p) => p.prId == widget.prId).toList();
      if (match.isNotEmpty && mounted) {
        setState(() { _po = match.first; _loaded = true; });
      } else {
        if (mounted) setState(() => _loaded = true);
      }
    } catch (_) {
      if (mounted) setState(() => _loaded = true);
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'draft':       return Tokens.gray500;
      case 'sent':        return Colors.blue;
      case 'acknowledged': return Colors.teal;
      case 'completed':   return Colors.green;
      case 'cancelled':   return Colors.red;
      default:            return Colors.orange;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || _po == null) return const SizedBox.shrink();

    final t = L10n.of(context);
    final cs = Theme.of(context).colorScheme;
    final po = _po!;

    return GestureDetector(
      onTap: () => context.push('/po/${po.id}'),
      child: Card(
        elevation: 0,
        color: const Color(0xFFF0F9FF),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFFBAE6FD)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFE0F2FE),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.receipt_long, color: Color(0xFF0284C7), size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(po.poNumber, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(
                      '${po.currency} ${(po.totalMinor / 100).toStringAsFixed(2)}',
                      style: TextStyle(fontSize: 13, color: cs.onSurface.withAlpha(153)),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: _statusColor(po.status).withAlpha(30),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  t('po_status_${po.status}'),
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _statusColor(po.status)),
                ),
              ),
              const SizedBox(width: 4),
              Icon(Icons.chevron_right, color: cs.onSurface.withAlpha(76)),
            ],
          ),
        ),
      ),
    );
  }
}
