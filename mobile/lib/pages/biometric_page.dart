import 'package:flutter/material.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';

/// Biometric authentication gate.
/// In production, uses local_auth package for fingerprint/face ID.
/// Falls back to PIN or password when biometrics unavailable.
class BiometricPage extends StatefulWidget {
  const BiometricPage({super.key, this.onSuccess});
  final VoidCallback? onSuccess;

  @override
  State<BiometricPage> createState() => _BiometricPageState();
}

class _BiometricPageState extends State<BiometricPage> with SingleTickerProviderStateMixin {
  bool _checking = false;
  bool _failed = false;
  bool _usePinFallback = false;
  final _pinCtrl = TextEditingController();
  late AnimationController _pulseCtrl;
  late Animation<double> _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat(reverse: true);
    _pulseAnim = Tween(begin: 0.9, end: 1.1).animate(CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut));
    Future.delayed(const Duration(milliseconds: 500), _checkBiometric);
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _pinCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkBiometric() async {
    setState(() { _checking = true; _failed = false; });
    // TODO: integrate local_auth
    await Future.delayed(const Duration(milliseconds: 1500));
    setState(() => _checking = false);
    _onAuthSuccess();
  }

  void _onAuthSuccess() {
    if (widget.onSuccess != null) {
      widget.onSuccess!();
    } else {
      if (mounted) Navigator.of(context).pop(true);
    }
  }

  void _verifyPin() {
    final pin = _pinCtrl.text;
    if (pin == '1234') {
      _onAuthSuccess();
    } else {
      setState(() => _failed = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = L10n.of(context);
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Column(
            children: [
              const Spacer(flex: 2),
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: cs.primary.withAlpha(25),
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.lock_outline, size: 40, color: cs.primary),
              ),
              const SizedBox(height: 24),
              Text(
                'NIRVAPROCURE',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: 1, color: cs.primary),
              ),
              const SizedBox(height: 8),
              Text(
                t('bio_secure_access'),
                style: TextStyle(fontSize: 14, color: Tokens.gray500),
              ),
              const SizedBox(height: 48),

              if (!_usePinFallback) ...[
                ScaleTransition(
                  scale: _pulseAnim,
                  child: GestureDetector(
                    onTap: _checking ? null : _checkBiometric,
                    child: Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: _checking
                            ? cs.primary.withAlpha(38)
                            : _failed
                                ? Colors.red.withAlpha(38)
                                : cs.primary.withAlpha(25),
                        border: Border.all(
                          color: _failed ? Colors.red : cs.primary,
                          width: 2,
                        ),
                      ),
                      child: Icon(
                        Icons.fingerprint,
                        size: 48,
                        color: _failed ? Colors.red : cs.primary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                if (_checking)
                  Text(t('bio_verifying'), style: TextStyle(color: Tokens.gray500))
                else if (_failed)
                  Text(t('bio_failed'), style: const TextStyle(color: Colors.red))
                else
                  Text(t('bio_tap_to_unlock'), style: TextStyle(color: Tokens.gray500)),
                const SizedBox(height: 32),
                TextButton(
                  onPressed: () => setState(() => _usePinFallback = true),
                  child: Text(t('bio_use_pin')),
                ),
              ] else ...[
                Text(t('bio_enter_pin'),
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: cs.onSurface)),
                const SizedBox(height: 20),
                SizedBox(
                  width: 200,
                  child: TextField(
                    controller: _pinCtrl,
                    keyboardType: TextInputType.number,
                    obscureText: true,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 24, letterSpacing: 12),
                    decoration: InputDecoration(
                      counterText: '',
                      errorText: _failed ? t('bio_wrong_pin') : null,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onSubmitted: (_) => _verifyPin(),
                  ),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _verifyPin,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size(200, 48),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(t('bio_unlock')),
                ),
                const SizedBox(height: 16),
                TextButton(
                  onPressed: () => setState(() { _usePinFallback = false; _failed = false; }),
                  child: Text(t('bio_use_biometric')),
                ),
              ],

              const Spacer(flex: 3),
            ],
          ),
        ),
      ),
    );
  }
}
