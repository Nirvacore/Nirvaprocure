import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../api/endpoints.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email    = TextEditingController(text: 'suda@nirva.co.th');
  final _password = TextEditingController(text: 'password123');
  bool _busy = false;
  bool _showPassword = false;
  String? _error;

  Future<void> _submit() async {
    final l10n = L10n.of(context);
    setState(() { _busy = true; _error = null; });
    try {
      await Api.login(_email.text.trim(), _password.text);
      if (!mounted) return;
      context.go('/');
    } catch (_) {
      setState(() => _error = l10n.t('login.bad'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: const [LangButton()],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Container(
                          width: 56, height: 56,
                          decoration: BoxDecoration(
                            color: Tokens.brand600,
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Icon(Icons.auto_awesome, color: Colors.white, size: 28),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Center(child: Text(l10n.t('login.heading'),
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold))),
                      const SizedBox(height: 4),
                      Center(child: Text(l10n.t('login.sub'),
                        style: const TextStyle(color: Tokens.gray500))),
                      const SizedBox(height: 24),
                      _Label(l10n.t('login.email')),
                      TextField(controller: _email, keyboardType: TextInputType.emailAddress),
                      const SizedBox(height: 16),
                      _Label(l10n.t('login.password')),
                      TextField(
                        controller: _password,
                        obscureText: !_showPassword,
                        decoration: InputDecoration(
                          suffixIcon: IconButton(
                            icon: Icon(
                              _showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                              size: 20,
                              color: Tokens.gray500,
                            ),
                            onPressed: () => setState(() => _showPassword = !_showPassword),
                          ),
                        ),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFEE2E2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(children: [
                            const Icon(Icons.error_outline, color: Tokens.danger),
                            const SizedBox(width: 8),
                            Expanded(child: Text(_error!, style: const TextStyle(color: Tokens.danger))),
                          ]),
                        ),
                      ],
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: _busy ? null : _submit,
                        child: _busy
                          ? const SizedBox(width: 20, height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(l10n.t('login.submit')),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(text, style: const TextStyle(fontWeight: FontWeight.w600)),
  );
}
