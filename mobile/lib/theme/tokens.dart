/// Design tokens — mirror frontend/design-system/principles.md so the mobile
/// app feels like the same product as the web. When you change a token here,
/// change it on the web side too (or vice versa).
library;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class Tokens {
  /// Brand indigo — matches `bg-brand-600` in Tailwind.
  static const brand600 = Color(0xFF4F46E5);
  static const brand100 = Color(0xFFE0E7FF);
  static const brand50  = Color(0xFFEEF2FF);

  static const success = Color(0xFF16A34A);
  static const warning = Color(0xFFD97706);
  static const danger  = Color(0xFFDC2626);

  static const gray900 = Color(0xFF111827);
  static const gray700 = Color(0xFF374151);
  static const gray500 = Color(0xFF6B7280);
  static const gray200 = Color(0xFFE5E7EB);
  static const gray100 = Color(0xFFF3F4F6);
  static const gray50  = Color(0xFFF9FAFB);

  /// Minimum tap target. The web rule is 56px primary / 44px secondary;
  /// mobile uses the same baselines.
  static const tapPrimary   = 56.0;
  static const tapSecondary = 44.0;

  /// Base text size — matches the 18px web baseline (vs Flutter's 14sp default).
  static const baseFontSize = 18.0;
}

ThemeData buildTheme({bool dark = false}) {
  final colorScheme = ColorScheme.fromSeed(
    seedColor: Tokens.brand600,
    primary: Tokens.brand600,
    brightness: dark ? Brightness.dark : Brightness.light,
    surface: dark ? const Color(0xFF1A1A2E) : Colors.white,
  );

  // Thai-first base font — falls back to Inter for Latin chars.
  final textTheme = GoogleFonts.notoSansThaiTextTheme(
    dark ? ThemeData.dark().textTheme : ThemeData.light().textTheme,
  ).apply(
    bodyColor: dark ? Colors.white : Tokens.gray900,
    displayColor: dark ? Colors.white : Tokens.gray900,
  );

  final scaffoldBg = dark ? const Color(0xFF0F0F23) : Tokens.gray50;
  final cardColor = dark ? const Color(0xFF1E1E3A) : Colors.white;
  final borderColor = dark ? const Color(0xFF2D2D50) : Tokens.gray200;

  return ThemeData(
    useMaterial3: true,
    brightness: dark ? Brightness.dark : Brightness.light,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: scaffoldBg,
    cardColor: cardColor,
    dividerColor: borderColor,
    textTheme: textTheme.copyWith(
      bodyLarge: textTheme.bodyLarge?.copyWith(fontSize: Tokens.baseFontSize, height: 1.6),
      bodyMedium: textTheme.bodyMedium?.copyWith(fontSize: Tokens.baseFontSize, height: 1.6),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? const Color(0xFF1A1A2E) : Colors.white,
      foregroundColor: dark ? Colors.white : Tokens.gray900,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    bottomAppBarTheme: BottomAppBarTheme(
      color: dark ? const Color(0xFF1A1A2E) : Colors.white,
      surfaceTintColor: dark ? const Color(0xFF1A1A2E) : Colors.white,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size.fromHeight(Tokens.tapPrimary),
        padding: const EdgeInsets.symmetric(horizontal: 20),
        backgroundColor: Tokens.brand600,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(Tokens.tapPrimary),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        side: BorderSide(color: borderColor, width: 2),
        foregroundColor: dark ? Colors.white70 : Tokens.gray700,
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? const Color(0xFF252545) : Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: borderColor, width: 2),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Tokens.brand600, width: 2),
      ),
    ),
  );
}
