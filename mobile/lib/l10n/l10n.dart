import 'package:flutter/widgets.dart';
import 'dictionary.dart';

/// Provides translated strings to the widget tree.
///
/// Wrap the app with [L10nScope] (holds locale state) which inserts [L10n]
/// into the tree. Widgets call [L10n.of(context).t('key')] to get a string,
/// or [L10n.of(context).t('key', {'var': value})] for interpolation.
///
/// Falls back to 'en' if a key is missing in the current locale, then falls
/// back to the raw key so nothing renders blank.
class L10n extends InheritedWidget {
  const L10n({
    super.key,
    required this.locale,
    required this.setLocale,
    required this.isDark,
    required this.toggleDark,
    required super.child,
  });

  final Locale locale;
  final ValueChanged<Locale> setLocale;
  final bool isDark;
  final VoidCallback toggleDark;

  static L10n of(BuildContext context) {
    final result = context.dependOnInheritedWidgetOfExactType<L10n>();
    assert(result != null, 'L10n not found — wrap app with L10nScope');
    return result!;
  }

  String t(String key, [Map<String, Object>? vars]) {
    final lang = locale.languageCode;
    var s = flutterDict[lang]?[key] ?? flutterDict['en']?[key] ?? key;
    if (vars != null) {
      vars.forEach((k, v) => s = s.replaceAll('{$k}', '$v'));
    }
    return s;
  }

  @override
  bool updateShouldNotify(L10n old) =>
      locale != old.locale || isDark != old.isDark;
}

/// Stateful root that holds the selected [Locale] and dark-mode state,
/// rebuilds the tree when either changes. Place this above [MaterialApp].
class L10nScope extends StatefulWidget {
  const L10nScope({super.key, required this.child});
  final Widget Function(Locale locale, bool isDark) child;

  @override
  State<L10nScope> createState() => _L10nScopeState();
}

class _L10nScopeState extends State<L10nScope> {
  Locale _locale = const Locale('th');
  bool _isDark = false;

  void _setLocale(Locale l) => setState(() => _locale = l);
  void _toggleDark() => setState(() => _isDark = !_isDark);

  @override
  Widget build(BuildContext context) {
    return L10n(
      locale: _locale,
      setLocale: _setLocale,
      isDark: _isDark,
      toggleDark: _toggleDark,
      child: widget.child(_locale, _isDark),
    );
  }
}
