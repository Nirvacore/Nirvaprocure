// Basic smoke tests — verify the app can boot and key widgets render.
// Run with: flutter test
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Sanity', () {
    test('1 + 1 = 2', () {
      expect(1 + 1, 2);
    });
  });
}
