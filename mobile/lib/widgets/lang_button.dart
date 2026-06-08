import 'package:flutter/material.dart';
import '../l10n/dictionary.dart';
import '../l10n/l10n.dart';

/// Language picker — shows compact locale label (e.g. "ไทย", "EN", "中文")
/// in the AppBar and opens an 8-locale popup menu when tapped.
class LangButton extends StatelessWidget {
  const LangButton({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = L10n.of(context);
    final compact = localeCompact[l10n.locale.languageCode] ?? l10n.locale.languageCode.toUpperCase();
    return PopupMenuButton<Locale>(
      initialValue: l10n.locale,
      tooltip: l10n.t('lang.label'),
      onSelected: l10n.setLocale,
      itemBuilder: (_) => localeLabels.entries.map((e) {
        final selected = e.key == l10n.locale.languageCode;
        return PopupMenuItem<Locale>(
          value: Locale(e.key),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  e.value,
                  style: TextStyle(
                    fontWeight: selected ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
              ),
              Text(
                e.key.toUpperCase(),
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
            ],
          ),
        );
      }).toList(),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.language, size: 18),
            const SizedBox(width: 4),
            Text(compact, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}
