import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../l10n/l10n.dart';
import '../theme/tokens.dart';
import '../widgets/lang_button.dart';

/// Onboarding walkthrough — Grab/Shopee-style 3-step intro.
/// Shows on first launch, skippable, explains the core flow:
/// 1. สร้างใบขอ (Create PR)
/// 2. ส่งอนุมัติ (Submit for approval)
/// 3. ติดตามสถานะ (Track status)
class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});
  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final _controller = PageController();
  int _current = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _next() {
    if (_current < 2) {
      _controller.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    } else {
      context.go('/login');
    }
  }

  void _skip() => context.go('/login');

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);

    final steps = [
      _StepData(
        icon: Icons.add_circle_outline,
        color: Tokens.brand600,
        title: l10n.t('onboard.step1.title'),
        desc: l10n.t('onboard.step1.desc'),
      ),
      _StepData(
        icon: Icons.how_to_vote_outlined,
        color: const Color(0xFFD97706),
        title: l10n.t('onboard.step2.title'),
        desc: l10n.t('onboard.step2.desc'),
      ),
      _StepData(
        icon: Icons.insights,
        color: const Color(0xFF16A34A),
        title: l10n.t('onboard.step3.title'),
        desc: l10n.t('onboard.step3.desc'),
      ),
    ];

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Top bar: LangButton + Skip
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 4, right: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const LangButton(),
                  TextButton(
                    onPressed: _skip,
                    child: Text(l10n.t('onboard.skip'),
                        style: const TextStyle(fontSize: 14, color: Tokens.gray500)),
                  ),
                ],
              ),
            ),

            // PageView
            Expanded(
              child: PageView.builder(
                controller: _controller,
                onPageChanged: (i) => setState(() => _current = i),
                itemCount: 3,
                itemBuilder: (_, i) => _StepView(step: steps[i]),
              ),
            ),

            // Dots + button
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 40),
              child: Column(
                children: [
                  // Dots
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(3, (i) => AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      margin: const EdgeInsets.symmetric(horizontal: 4),
                      width: _current == i ? 28 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: _current == i ? Tokens.brand600 : const Color(0xFFD1D5DB),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    )),
                  ),
                  const SizedBox(height: 32),

                  // Next / Start button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _next,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Tokens.brand600,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: Text(
                        _current < 2 ? l10n.t('onboard.next') : l10n.t('onboard.start'),
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StepData {
  const _StepData({required this.icon, required this.color, required this.title, required this.desc});
  final IconData icon;
  final Color color;
  final String title, desc;
}

class _StepView extends StatelessWidget {
  const _StepView({required this.step});
  final _StepData step;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              color: step.color.withAlpha(20),
              shape: BoxShape.circle,
            ),
            child: Icon(step.icon, size: 56, color: step.color),
          ),
          const SizedBox(height: 40),
          Text(step.title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Text(step.desc,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 16, height: 1.6, color: Tokens.gray500)),
        ],
      ),
    );
  }
}
