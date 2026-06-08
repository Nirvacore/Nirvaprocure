import 'package:flutter/material.dart';
import '../l10n/l10n.dart';
import '../widgets/lang_button.dart';

/// Camera / QR scanner — barcode scan for item lookup, photo capture for quotations.
/// Uses platform camera via image_picker + mobile_scanner packages.
///
/// In dev: shows a simulated UI. In production, integrate:
///   - mobile_scanner (for barcode / QR)
///   - image_picker (for quotation photos)
class ScannerPage extends StatefulWidget {
  const ScannerPage({super.key});

  @override
  State<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<ScannerPage> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  String? _scannedCode;
  bool _flashOn = false;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = L10n.of(context);
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(t('scanner_title')),
        actions: [
          IconButton(
            icon: Icon(_flashOn ? Icons.flash_on : Icons.flash_off),
            onPressed: () => setState(() => _flashOn = !_flashOn),
          ),
          const LangButton(),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: [
            Tab(icon: const Icon(Icons.qr_code_scanner), text: t('scanner_barcode')),
            Tab(icon: const Icon(Icons.camera_alt), text: t('scanner_photo')),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: [
          // ── Barcode / QR Tab ───
          _buildBarcodeTab(t, cs),
          // ── Photo Capture Tab ───
          _buildPhotoTab(t, cs),
        ],
      ),
    );
  }

  Widget _buildBarcodeTab(String Function(String) t, ColorScheme cs) {
    return Column(
      children: [
        // Camera viewfinder area
        Expanded(
          flex: 3,
          child: Container(
            margin: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.black87,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Scan area guide
                Container(
                  width: 220,
                  height: 220,
                  decoration: BoxDecoration(
                    border: Border.all(color: cs.primary, width: 2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                // Corner marks
                ..._cornerMarks(cs.primary),
                // Scan line animation
                Positioned(
                  top: 80,
                  child: Container(
                    width: 200,
                    height: 2,
                    color: cs.primary.withAlpha(153),
                  ),
                ),
                // Guide text
                Positioned(
                  bottom: 24,
                  child: Text(
                    t('scanner_aim_barcode'),
                    style: const TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ),
        // Result area
        Expanded(
          flex: 2,
          child: Container(
            padding: const EdgeInsets.all(24),
            width: double.infinity,
            child: _scannedCode != null
                ? Column(
                    children: [
                      const Icon(Icons.check_circle, color: Colors.green, size: 40),
                      const SizedBox(height: 12),
                      Text(t('scanner_found'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        decoration: BoxDecoration(
                          color: cs.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: SelectableText(_scannedCode!, style: const TextStyle(fontFamily: 'monospace', fontSize: 18)),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          OutlinedButton.icon(
                            onPressed: () => setState(() => _scannedCode = null),
                            icon: const Icon(Icons.refresh, size: 18),
                            label: Text(t('scanner_scan_again')),
                          ),
                          const SizedBox(width: 12),
                          FilledButton.icon(
                            onPressed: () {
                              Navigator.pop(context, _scannedCode);
                            },
                            icon: const Icon(Icons.check, size: 18),
                            label: Text(t('scanner_use_code')),
                          ),
                        ],
                      ),
                    ],
                  )
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.qr_code_2, size: 48, color: cs.onSurface.withAlpha(77)),
                      const SizedBox(height: 12),
                      Text(t('scanner_instructions'), style: TextStyle(color: cs.onSurface.withAlpha(128))),
                      const SizedBox(height: 20),
                      // Dev: simulate scan
                      OutlinedButton.icon(
                        onPressed: () => setState(() => _scannedCode = 'SKU-2024-00142'),
                        icon: const Icon(Icons.bug_report, size: 16),
                        label: Text(t('scanner_simulate')),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhotoTab(String Function(String) t, ColorScheme cs) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          // Photo capture area
          Expanded(
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: cs.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: cs.outline.withAlpha(77), width: 1),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.add_a_photo, size: 64, color: cs.primary.withAlpha(102)),
                  const SizedBox(height: 16),
                  Text(t('scanner_capture_quotation'), style: TextStyle(color: cs.onSurface.withAlpha(153), fontSize: 15)),
                  const SizedBox(height: 8),
                  Text(t('scanner_capture_hint'), style: TextStyle(color: cs.onSurface.withAlpha(102), fontSize: 12)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    // TODO: image_picker gallery
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(t('scanner_gallery_todo'))),
                    );
                  },
                  icon: const Icon(Icons.photo_library),
                  label: Text(t('scanner_gallery')),
                  style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () {
                    // TODO: image_picker camera
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(t('scanner_camera_todo'))),
                    );
                  },
                  icon: const Icon(Icons.camera_alt),
                  label: Text(t('scanner_take_photo')),
                  style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  List<Widget> _cornerMarks(Color c) {
    const len = 24.0;
    const w = 3.0;
    return [
      // Top-left
      Positioned(top: 0, left: 0, child: Container(width: len, height: w, color: c)),
      Positioned(top: 0, left: 0, child: Container(width: w, height: len, color: c)),
      // Top-right
      Positioned(top: 0, right: 0, child: Container(width: len, height: w, color: c)),
      Positioned(top: 0, right: 0, child: Container(width: w, height: len, color: c)),
      // Bottom-left
      Positioned(bottom: 0, left: 0, child: Container(width: len, height: w, color: c)),
      Positioned(bottom: 0, left: 0, child: Container(width: w, height: len, color: c)),
      // Bottom-right
      Positioned(bottom: 0, right: 0, child: Container(width: len, height: w, color: c)),
      Positioned(bottom: 0, right: 0, child: Container(width: w, height: len, color: c)),
    ];
  }
}
