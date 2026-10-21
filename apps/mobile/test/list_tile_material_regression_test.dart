import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:quill_grade/core/database/app_database.dart';
import 'package:quill_grade/core/database/repositories/sample_repository.dart';
import 'package:quill_grade/core/sync/sync_manager.dart';
import 'package:quill_grade/features/history/history_screen.dart';
import 'package:quill_grade/features/sync_dashboard/sync_screen.dart';
import 'package:quill_grade/theme.dart';

class _HistoryRepository implements SampleRepository {
  final List<Sample> samples = [
    for (final grade in ['Special', 'C5 Special'])
      Sample(
        id: grade == 'Special' ? 'image-only' : 'legacy',
        ownerId: 'test-owner',
        sampleId: grade == 'Special' ? 'SMP-IMAGE' : 'SMP-LEGACY',
        captureTimestamp: DateTime(2026, 10, 21, 12),
        predictedGrade: grade,
        modelVersion: grade == 'Special' ? 'image_only_4class_v1' : null,
        needsReview: true,
        isSynced: false,
        revision: 1,
      ),
  ];

  @override
  Stream<List<Sample>> watchAllSamples() => Stream.value(samples);

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  testWidgets('history cards render and navigate without hidden ListTile ink', (
    tester,
  ) async {
    final repository = _HistoryRepository();
    final router = GoRouter(
      initialLocation: '/history',
      routes: [
        GoRoute(path: '/history', builder: (_, _) => const HistoryScreen()),
        GoRoute(
          path: '/result/:id',
          builder: (_, state) =>
              Scaffold(body: Text('Result ${state.pathParameters['id']}')),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [sampleRepositoryProvider.overrideWithValue(repository)],
        child: MaterialApp.router(
          theme: AppTheme.lightTheme,
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(ListTile), findsNWidgets(2));
    expect(find.text('Special'), findsOneWidget);
    expect(find.text('SMP-LEGACY'), findsOneWidget);

    // Rebuild the StreamBuilder through search, as happens during history use.
    await tester.enterText(find.byType(TextField), 'SMP-IMAGE');
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(ListTile), findsOneWidget);
    final gesture = await tester.startGesture(
      tester.getCenter(find.byType(ListTile)),
    );
    await tester.pump(const Duration(milliseconds: 100));
    expect(tester.takeException(), isNull);
    await gesture.up();
    await tester.pumpAndSettle();
    expect(find.text('Result image-only'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('sync preference tile paints and toggles without hidden ink', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          syncManagerProvider.overrideWith(
            (ref) => throw StateError(
              'Preference rendering must not invoke synchronization.',
            ),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          home: const SyncScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(
      tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
      isTrue,
    );
    await tester.ensureVisible(find.byType(SwitchListTile));
    for (final expected in [false, true]) {
      await tester.tap(find.text('Wi-Fi only auto-sync'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
        expected,
      );
      expect(tester.takeException(), isNull);
    }
  });
}
