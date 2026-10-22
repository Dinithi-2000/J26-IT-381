import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quill_grade/core/services/auth_service.dart';
import 'package:quill_grade/features/settings/settings_screen.dart';

import 'auth_service_test.dart';

void main() {
  testWidgets('SettingsScreen shows Inspector Claims Verification and displays PASS for real inspector', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final fakeUser = FakeUser(
      uid: 'inspector-verified-01',
      displayName: 'Verified Inspector',
      claims: const {'role': 'inspector', 'orgId': 'matara-plant-01'},
    );
    final fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
    final authService = AuthService(auth: fakeAuth, isMockMode: false);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authServiceProvider.overrideWithValue(authService),
        ],
        child: const MaterialApp(
          home: SettingsScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    final tileFinder = find.text('Inspector Role Verification');
    expect(tileFinder, findsOneWidget);
    expect(find.text('DEV'), findsNWidgets(2));

    // Tap the tile to open the diagnostic dialog
    await tester.tap(tileFinder);
    await tester.pumpAndSettle();

    // Verify dialog opened
    expect(find.text('Inspector Diagnostic'), findsOneWidget);
    expect(find.text('Verify Claims'), findsOneWidget);

    // Run verification
    await tester.tap(find.text('Verify Claims'));
    await tester.pump(); // Start async call
    await tester.pumpAndSettle(); // Settle async result

    // Verify sanitized PASS result displayed
    expect(find.text('STATUS: PASS'), findsOneWidget);
    expect(
        find.text(
            'PASS: Verified inspector credentials for organization matara-plant-01.'),
        findsOneWidget);
    expect(find.text('Category: passed'), findsOneWidget);

    // Close dialog
    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();
    expect(find.text('Inspector Diagnostic'), findsNothing);
  });

  testWidgets('SettingsScreen displays sanitized FAIL when user is in demo mode', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final fakeAuth = FakeFirebaseAuth(mockUser: null);
    final authService = AuthService(auth: fakeAuth, isMockMode: false);

    // Sign in as demo user
    await authService.signInWithEmailAndPassword('demo@quillgrade.com', 'pwd');

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authServiceProvider.overrideWithValue(authService),
        ],
        child: const MaterialApp(
          home: SettingsScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    final tileFinder = find.text('Inspector Role Verification');
    expect(tileFinder, findsOneWidget);

    // Tap diagnostic tile
    await tester.tap(tileFinder);
    await tester.pumpAndSettle();

    // Tap verify
    await tester.tap(find.text('Verify Claims'));
    await tester.pump();
    await tester.pumpAndSettle();

    // Verify sanitized FAIL result displayed
    expect(find.text('STATUS: FAIL'), findsOneWidget);
    expect(find.textContaining('Demo/mock users cannot be verified'), findsOneWidget);
    expect(find.text('Category: demoUserNotAllowed'), findsOneWidget);
  });
}
