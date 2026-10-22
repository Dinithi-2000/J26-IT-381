import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quill_grade/core/database/app_database.dart';
import 'package:quill_grade/core/database/repositories/sample_repository.dart';
import 'package:quill_grade/core/services/auth_service.dart';
import 'package:quill_grade/core/services/backend_connection.dart';
import 'package:quill_grade/core/sync/single_sample_upload_service.dart';
import 'package:quill_grade/features/settings/single_sample_upload_dialog.dart';

import 'auth_service_test.dart' show FakeFirebaseAuth, FakeUser;
import 'single_sample_upload_test.dart' show fixtureSample, uploadFixtures;

class ControlledUpload extends SingleSampleUploadService {
  final Sample sample;
  final completion = Completer<SingleUploadResult>();
  int calls = 0;
  String? destination;
  ControlledUpload(super.repository, super.auth, this.sample);

  @override
  Future<List<Sample>> eligibleSamples() async => [sample];

  @override
  Future<SingleUploadResult> upload(
    Sample selected, {
    required String baseUrl,
    bool confirmed = false,
    bool adbReverseConfigured = false,
  }) {
    expect(selected, sample);
    expect(confirmed, isTrue);
    calls++;
    destination = baseUrl;
    return completion.future;
  }
}

void main() {
  testWidgets(
    'selection and separate confirmation required; cancel sends nothing; upload cannot repeat in flight',
    (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1;
      final db = AppDatabase.forTesting(NativeDatabase.memory());
      final sample = fixtureSample(uploadFixtures().first);
      final service = ControlledUpload(
        SampleRepository(db),
        AuthService(
          auth: FakeFirebaseAuth(mockUser: FakeUser(uid: sample.ownerId)),
          isMockMode: false,
        ),
        sample,
      );
      final container = ProviderContainer(
        overrides: [singleSampleUploadProvider.overrideWithValue(service)],
      );
      container
          .read(backendBaseUrlProvider.notifier)
          .setUrl('https://verified-backend.example');
      addTearDown(() async {
        container.dispose();
        await db.close();
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });
      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) => TextButton(
                  onPressed: () => showDialog<void>(
                    context: context,
                    builder: (_) => const SingleSampleUploadDialog(),
                  ),
                  child: const Text('Open upload'),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open upload'));
      await tester.pumpAndSettle();
      expect(service.calls, 0);
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Review one upload'),
            )
            .onPressed,
        isNull,
      );
      expect(find.text(sample.ownerId), findsNothing);
      await tester.tap(find.text(sample.sampleId));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Review one upload'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(service.calls, 0);
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(service.calls, 0);
      await tester.tap(find.text('Review one upload'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      await tester.tap(find.text('Confirm one upload'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));
      expect(service.calls, 1);
      expect(service.destination, 'https://verified-backend.example');
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Review one upload'),
            )
            .onPressed,
        isNull,
      );
      service.completion.complete(
        const SingleUploadResult(true, 'Receipt validated.'),
      );
      await tester.pumpAndSettle();
      expect(find.text('Receipt validated.'), findsOneWidget);
      expect(find.text(sample.sampleId), findsNothing);
      expect(service.calls, 1);
    },
  );
}
