import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../l10n/l10n.dart';
import '../api/endpoints.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  List<Map<String, dynamic>>? _users;
  List<Map<String, dynamic>>? _departments;
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
        Api.listUsers(),
        Api.listDepartments(),
      ]);
      if (!mounted) return;
      setState(() {
        _users = results[0];
        _departments = results[1];
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() { _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.t('settings.heading'), style: const TextStyle(fontWeight: FontWeight.bold)),
        actions: const [LangButton()],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Language section ──
            _SectionHeader(title: l10n.t('lang.label'), icon: Icons.language),
            const SizedBox(height: 8),
            _LanguageCard(l10n: l10n),
            const SizedBox(height: 24),

            // ── Users section ──
            _SectionHeader(
              title: l10n.t('settings.tab.users'),
              icon: Icons.people_outline,
              count: _users?.length,
            ),
            const SizedBox(height: 8),
            if (_loading && _users == null)
              const Center(child: Padding(
                padding: EdgeInsets.all(20),
                child: CircularProgressIndicator(strokeWidth: 2),
              )),
            if (_users != null && _users!.isEmpty)
              _EmptyTile(label: l10n.t('settings.no_users')),
            if (_users != null)
              ..._users!.map((u) => _UserTile(user: u)),
            const SizedBox(height: 24),

            // ── Departments section ──
            _SectionHeader(
              title: l10n.t('settings.tab.depts'),
              icon: Icons.business_outlined,
              count: _departments?.length,
            ),
            const SizedBox(height: 8),
            if (_loading && _departments == null)
              const Center(child: Padding(
                padding: EdgeInsets.all(20),
                child: CircularProgressIndicator(strokeWidth: 2),
              )),
            if (_departments != null && _departments!.isEmpty)
              _EmptyTile(label: l10n.t('settings.no_depts')),
            if (_departments != null)
              ..._departments!.map((d) => _DeptTile(dept: d)),
            const SizedBox(height: 24),

            // ── App info ──
            _SectionHeader(title: l10n.t('settings.about'), icon: Icons.info_outline),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Tokens.gray200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('NIRVAPROCURE',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text('v1.0.0 · Flutter',
                      style: const TextStyle(fontSize: 13, color: Tokens.gray500)),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Logout ──
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  final l = L10n.of(context);
                  final nav = GoRouter.of(context);
                  await Api.logout();
                  if (!context.mounted) return;
                  nav.go('/login');
                },
                icon: const Icon(Icons.logout, size: 18),
                label: Text(l10n.t('nav.logout'),
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red.shade700,
                  side: BorderSide(color: Colors.red.shade200, width: 2),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

// ─── Subwidgets ──────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.icon, this.count});
  final String title;
  final IconData icon;
  final int? count;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Icon(icon, size: 20, color: Tokens.brand600),
      const SizedBox(width: 8),
      Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      if (count != null) ...[
        const SizedBox(width: 6),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: Tokens.brand100,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text('$count',
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Tokens.brand600)),
        ),
      ],
    ]);
  }
}

class _LanguageCard extends StatelessWidget {
  const _LanguageCard({required this.l10n});
  final L10n l10n;

  @override
  Widget build(BuildContext context) {
    final scope = L10nScope.of(context);
    final currentLocale = scope.locale.languageCode;
    final labels = {
      'th': 'ไทย', 'en': 'English', 'zh': '中文', 'ja': '日本語',
      'vi': 'Tiếng Việt', 'id': 'Bahasa Indonesia', 'my': 'မြန်မာ', 'km': 'ភាសាខ្មែរ',
    };

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Tokens.gray200),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: labels.entries.map((e) {
          final selected = e.key == currentLocale;
          return GestureDetector(
            onTap: () => scope.setLocale(Locale(e.key)),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: selected ? Tokens.brand600 : Tokens.gray100,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                e.value,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : Tokens.gray700,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _UserTile extends StatelessWidget {
  const _UserTile({required this.user});
  final Map<String, dynamic> user;

  @override
  Widget build(BuildContext context) {
    final name = (user['full_name'] as String?) ?? (user['email'] as String?) ?? '—';
    final email = (user['email'] as String?) ?? '';
    final role = (user['role'] as String?) ?? 'user';
    final initials = name.isNotEmpty ? name[0].toUpperCase() : '?';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Tokens.gray200),
      ),
      child: Row(children: [
        CircleAvatar(
          radius: 20,
          backgroundColor: Tokens.brand100,
          child: Text(initials,
              style: const TextStyle(fontWeight: FontWeight.bold, color: Tokens.brand600, fontSize: 16)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              if (email.isNotEmpty)
                Text(email, style: TextStyle(fontSize: 12, color: Tokens.gray500)),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: role == 'admin' ? const Color(0xFFFEF3C7) : Tokens.gray100,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            role,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: role == 'admin' ? const Color(0xFF92400E) : Tokens.gray500,
            ),
          ),
        ),
      ]),
    );
  }
}

class _DeptTile extends StatelessWidget {
  const _DeptTile({required this.dept});
  final Map<String, dynamic> dept;

  @override
  Widget build(BuildContext context) {
    final name = (dept['name'] as String?) ?? '—';
    final code = (dept['code'] as String?) ?? '';
    final headCount = dept['head_count'] as int?;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Tokens.gray200),
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: const Color(0xFFE0F2FE),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.business, color: Color(0xFF0369A1), size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              if (code.isNotEmpty)
                Text(code, style: TextStyle(fontSize: 12, color: Tokens.gray500, fontFamily: 'monospace')),
            ],
          ),
        ),
        if (headCount != null)
          Row(children: [
            Icon(Icons.person_outline, size: 14, color: Tokens.gray500),
            const SizedBox(width: 4),
            Text('$headCount', style: TextStyle(fontSize: 13, color: Tokens.gray500)),
          ]),
      ]),
    );
  }
}

class _EmptyTile extends StatelessWidget {
  const _EmptyTile({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Tokens.gray200),
      ),
      child: Center(child: Text(label, style: const TextStyle(color: Tokens.gray500))),
    );
  }
}
