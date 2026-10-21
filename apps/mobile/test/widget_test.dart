import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:quill_grade/main.dart';
import 'package:quill_grade/core/services/preferences_service.dart';

void main() {
  testWidgets('QuillGradeApp builds and redirects correctly', (WidgetTester tester) async {
    // Setup mocked preferences
    SharedPreferences.setMockInitialValues({'hasCompletedOnboarding': true});
    final prefs = await SharedPreferences.getInstance();

    // Build our app and trigger a frame.
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
        ],
        child: const QuillGradeApp(),
      ),
    );

    // Initial pump and settle for router to kick in
    await tester.pumpAndSettle();

    // Since they completed onboarding but are not logged in, they should see SignInScreen
    expect(find.text('Sign In'), findsOneWidget);
  });
}
