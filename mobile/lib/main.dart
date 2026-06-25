import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:go_router/go_router.dart';
import 'api/api_client.dart';
import 'l10n/l10n.dart';
import 'pages/analytics_page.dart';
import 'pages/approvals_page.dart';
import 'pages/audit_page.dart';
import 'pages/budget_page.dart';
import 'pages/home_page.dart';
import 'pages/login_page.dart';
import 'pages/more_page.dart';
import 'pages/notifications_page.dart';
import 'pages/onboarding_page.dart';
import 'pages/pr_create_page.dart';
import 'pages/profile_page.dart';
import 'pages/receive_page.dart';
import 'pages/scanner_page.dart';
import 'pages/search_page.dart';
import 'pages/po_list_page.dart';
import 'pages/charts_page.dart';
import 'pages/biometric_page.dart';
import 'pages/po_detail_page.dart';
import 'pages/pr_detail_page.dart';
import 'pages/pr_list_page.dart';
import 'pages/settings_page.dart';
import 'pages/shell_page.dart';
import 'pages/stock_page.dart';
import 'pages/suppliers_page.dart';
import 'pages/tor_detail_page.dart';
import 'pages/tor_list_page.dart';
import 'theme/tokens.dart';

void main() => runApp(const NirvaProcureApp());

class NirvaProcureApp extends StatelessWidget {
  const NirvaProcureApp({super.key});

  @override
  Widget build(BuildContext context) {
    return L10nScope(
      child: (locale, isDark) => MaterialApp.router(
        title: 'NIRVAPROCURE',
        theme: buildTheme(dark: false),
        darkTheme: buildTheme(dark: true),
        themeMode: isDark ? ThemeMode.dark : ThemeMode.light,
        routerConfig: _router,
        locale: locale,
        supportedLocales: const [
          Locale('th'), Locale('en'), Locale('zh'), Locale('ja'),
          Locale('vi'), Locale('id'), Locale('my'), Locale('km'),
        ],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}

/// Routes: ShellRoute wraps the 4 bottom-nav tabs with a persistent nav bar.
/// Sub-pages (PR detail, create, etc.) live OUTSIDE the shell so the bottom
/// nav hides when drilling in — same pattern as LINE and Grab.
final _router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(path: '/login',      builder: (_, __) => const LoginPage()),
    GoRoute(path: '/onboarding', builder: (_, __) => const OnboardingPage()),

    // ── Bottom-nav shell (Home, Approvals, PRs, More) ────────────
    ShellRoute(
      builder: (_, __, child) => ShellPage(child: child),
      routes: [
        GoRoute(path: '/',          builder: (_, __) => const HomePage()),
        GoRoute(path: '/approvals', builder: (_, __) => const ApprovalsPage()),
        GoRoute(path: '/pr',        builder: (_, __) => const PrListPage()),
        GoRoute(path: '/more',      builder: (_, __) => const MorePage()),
      ],
    ),

    // ── Full-screen pages (no bottom nav) ────────────────────────
    GoRoute(
      path: '/pr/:id',
      builder: (_, state) {
        final id = state.pathParameters['id']!;
        if (id == 'new') return const PrCreatePage();
        return PrDetailPage(id: id);
      },
    ),
    GoRoute(path: '/analytics',     builder: (_, __) => const AnalyticsPage()),
    GoRoute(path: '/stock',         builder: (_, __) => const StockPage()),
    GoRoute(path: '/settings',      builder: (_, __) => const SettingsPage()),
    GoRoute(path: '/suppliers',     builder: (_, __) => const SuppliersPage()),
    GoRoute(path: '/notifications', builder: (_, __) => const NotificationsPage()),
    GoRoute(path: '/budget',        builder: (_, __) => const BudgetPage()),
    GoRoute(path: '/audit',         builder: (_, __) => const AuditPage()),
    GoRoute(path: '/profile',       builder: (_, __) => const ProfilePage()),
    GoRoute(path: '/search',        builder: (_, __) => const SearchPage()),
    GoRoute(path: '/receive',       builder: (_, __) => const ReceivePage()),
    GoRoute(path: '/po',            builder: (_, __) => const PoListPage()),
    GoRoute(
      path: '/po/:id',
      builder: (_, state) => PoDetailPage(id: state.pathParameters['id']!),
    ),
    GoRoute(path: '/charts',        builder: (_, __) => const ChartsPage()),
    GoRoute(path: '/scanner',       builder: (_, __) => const ScannerPage()),
    GoRoute(path: '/biometric',     builder: (_, __) => const BiometricPage()),
    GoRoute(path: '/gov/tor',       builder: (_, __) => const TorListPage()),
    GoRoute(
      path: '/gov/tor/:id',
      builder: (_, state) => TorDetailPage(id: state.pathParameters['id']!),
    ),
  ],
  redirect: (context, state) async {
    final token = await ApiClient.instance.getToken();
    final goingToLogin = state.matchedLocation == '/login';
    if (token == null && !goingToLogin) return '/login';
    if (token != null && goingToLogin)  return '/';
    return null;
  },
);
