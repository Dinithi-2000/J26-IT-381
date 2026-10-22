import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart' show Value;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quill_grade/core/database/app_database.dart';
import 'package:quill_grade/core/database/repositories/sample_repository.dart';
import 'package:quill_grade/core/services/auth_service.dart';
import 'package:quill_grade/core/sync/grading_upload_mapper.dart';
import 'package:quill_grade/core/sync/single_sample_upload_service.dart';

import 'auth_service_test.dart' show FakeUser, FakeFirebaseAuth;

List<Map<String, dynamic>> uploadFixtures() => (jsonDecode(
  File('test/fixtures/grading_upload.json').readAsStringSync(),
) as List).cast<Map<String, dynamic>>();

Sample fixtureSample(Map<String, dynamic> data) => Sample(
  id: data['mobileSampleUuid'],
  ownerId: data['ownerId'],
  sampleId: data['sampleId'],
  captureTimestamp: DateTime.parse(data['captureTimestamp']).toLocal(),
  predictedGrade: data['predictedGrade'],
  modelVersion: data['modelVersion'],
  modelProbability: data['modelProbability'],
  diameterMm: data['diameterMm'],
  diameterSource: data['diameterSource'],
  measurementMethod: data['measurementMethod'],
  needsReview: true,
  isSynced: false,
  revision: data['revision'],
  sidePhotoLocalPath: 'original-side.jpg',
  endPhotoLocalPath: 'original-end.jpg',
);

Map<String, dynamic> uploadReceipt(
  Sample sample, {
  String action = 'created',
}) => {
  'status': 'acknowledged',
  'action': action,
  'receipt': {
    'mobileSampleUuid': sample.id,
    'sampleId': sample.sampleId,
    'ownerId': sample.ownerId,
    'revision': sample.revision,
    'serverReceiptTimestamp': '2026-10-21T08:00:00.000Z',
  },
};

void main() {
  final fixtures = uploadFixtures();
  group('SQLite to Express mapper', () {
    for (final fixture in fixtures) {
      test('exact metadata contract: ${fixture['modelVersion']}', () {
        final sample = fixtureSample(fixture);
        expect(mapGradingUpload(sample, sample.ownerId), fixture);
      });
    }
    for (final owner in [
      'demo-inspector-1',
      'inspector-1',
      'another-account',
    ]) {
      test('rejects ownership: $owner', () {
        final sample = fixtureSample(fixtures.first).copyWith(ownerId: owner);
        expect(
          () => mapGradingUpload(sample, 'firebase-fixture-inspector'),
          throwsA(isA<UploadValidationException>()),
        );
        if (owner != 'another-account') {
          expect(
            () => mapGradingUpload(sample, owner),
            throwsA(isA<UploadValidationException>()),
          );
        }
      });
    }
    test('hybrid without diameter is ineligible, image-only accepts null', () {
      final hybrid = fixtureSample(fixtures.last)
          .copyWith(diameterMm: const Value(null));
      expect(
        () => mapGradingUpload(hybrid, hybrid.ownerId),
        throwsA(isA<UploadValidationException>()),
      );
      final imageOnly = fixtureSample(fixtures.first);
      expect(
        mapGradingUpload(imageOnly, imageOnly.ownerId)['diameterMm'],
        isNull,
      );
    });
    test(
      'missing or percentage-scaled probability is never fabricated or guessed',
      () {
        for (final probability in [null, 94.5, double.nan]) {
          final sample = fixtureSample(fixtures.first)
              .copyWith(modelProbability: Value(probability));
          expect(
            () => mapGradingUpload(sample, sample.ownerId),
            throwsA(isA<UploadValidationException>()),
          );
        }
      },
    );
    test('AI diameter source and original probability retained', () {
      final sample = fixtureSample(fixtures.last)
          .copyWith(diameterSource: const Value('ai_estimated'));
      expect(
        mapGradingUpload(sample, sample.ownerId)['diameterSource'],
        'ai_estimated',
      );
      expect(
        mapGradingUpload(sample, sample.ownerId)['modelProbability'],
        .945,
      );
    });
  });

  group('single-record HTTP upload with in-memory SQLite', () {
    late AppDatabase db;
    late SampleRepository repository;
    late FakeUser user;
    late FakeFirebaseAuth firebase;
    late SingleSampleUploadService service;
    late HttpServer server;
    late String baseUrl;
    late Sample selected;
    late List<Map<String, dynamic>> sent;

    setUp(() async {
      db = AppDatabase.forTesting(NativeDatabase.memory());
      repository = SampleRepository(db);
      selected = fixtureSample(fixtures.first);
      await db.into(db.samples).insert(selected);
      user = FakeUser(uid: selected.ownerId);
      firebase = FakeFirebaseAuth(mockUser: user);
      service = SingleSampleUploadService(
        repository,
        AuthService(auth: firebase, isMockMode: false),
        timeout: const Duration(seconds: 2),
      );
      server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      baseUrl = 'http://127.0.0.1:${server.port}';
      sent = [];
    });
    tearDown(() async {
      await server.close(force: true);
      await db.close();
    });

    Future<SingleUploadResult> upload({bool confirmed = true}) =>
        service.upload(
          selected,
          baseUrl: baseUrl,
          confirmed: confirmed,
          adbReverseConfigured: true,
        );

    void respond({
      int status = 201,
      Object? body,
      Future<void> Function()? beforeReply,
    }) {
      server.listen((request) async {
        expect(request.method, 'POST');
        expect(request.uri.path, '/api/grading/sync');
        expect(
          request.headers.value(HttpHeaders.authorizationHeader),
          'Bearer valid-firebase-jwt-token-xyz',
        );
        sent.add(
          jsonDecode(await utf8.decoder.bind(request).join())
              as Map<String, dynamic>,
        );
        await beforeReply?.call();
        request.response.statusCode = status;
        request.response.write(jsonEncode(body ?? uploadReceipt(selected)));
        await request.response.close();
      });
    }

    test('successful receipt updates only acknowledgment fields on exactly one row', () async {
      final other = fixtureSample(fixtures.last);
      await db.into(db.samples).insert(other);
      respond();
      expect((await upload()).succeeded, isTrue);
      expect(user.lastForceRefreshForGetIdToken, isTrue);
      expect(sent.single, fixtures.first);
      final saved = await repository.getSample(selected.id);
      expect(
        saved,
        selected.copyWith(
          isSynced: true,
          serverReceiptTime: Value(
            DateTime.parse('2026-10-21T08:00:00.000Z').toLocal(),
          ),
        ),
      );
      expect(await repository.getSample(other.id), other);
      expect((await upload()).succeeded, isFalse);
      expect(sent.length, 1);
    });
    test('hybrid uploads and acknowledges original revision', () async {
      selected = fixtureSample(fixtures.last);
      await db.into(db.samples).insert(selected);
      respond();
      expect((await upload()).succeeded, isTrue);
      expect(sent.single, fixtures.last);
      expect((await repository.getSample(selected.id)).revision, 3);
    });
    test('server receipt time uses existing SQLite second precision', () async {
      final body = uploadReceipt(selected);
      (body['receipt'] as Map)['serverReceiptTimestamp'] =
          '2026-10-21T08:00:00.123Z';
      respond(body: body);
      expect((await upload()).succeeded, isTrue);
      final saved = await repository.getSample(selected.id);
      expect(
        saved.serverReceiptTime!.toUtc(),
        DateTime.parse('2026-10-21T08:00:00.000Z'),
      );
      expect(saved.captureTimestamp, selected.captureTimestamp);
      expect(saved.sidePhotoLocalPath, selected.sidePhotoLocalPath);
      expect(saved.endPhotoLocalPath, selected.endPhotoLocalPath);
    });
    test('no explicit confirmation sends nothing', () async {
      respond();
      expect((await upload(confirmed: false)).succeeded, isFalse);
      expect(sent, isEmpty);
    });
    test('eligibility excludes legacy, foreign, synced and invalid rows without changes', () async {
      var suffix = 90;
      for (final owner in [
        'demo-inspector-1',
        'inspector-1',
        'another-account',
      ]) {
        await db
            .into(db.samples)
            .insert(
              selected.copyWith(
                id: '550e8400-e29b-41d4-a716-4466554400${suffix++}',
                ownerId: owner,
              ),
            );
      }
      await db
          .into(db.samples)
          .insert(fixtureSample(fixtures.last).copyWith(isSynced: true));
      expect(await service.eligibleSamples(), [selected]);
      final before = await repository.getAllSamples();
      firebase.mockUser = FakeUser(uid: 'another-account');
      respond();
      expect((await upload()).succeeded, isFalse);
      expect(sent, isEmpty);
      expect(await repository.getAllSamples(), before);
    });
    for (final status in [400, 401, 403, 409, 500, 503]) {
      test(
        'HTTP $status leaves SQLite unchanged and hides raw server error',
        () async {
          respond(status: status, body: {'secret': 'sensitive-server-content'});
          final result = await upload();
          expect(result.succeeded, isFalse);
          expect(result.message, contains('HTTP $status'));
          expect(result.message, isNot(contains('sensitive-server-content')));
          expect(await repository.getSample(selected.id), selected);
        },
      );
    }
    for (final entry in {
      'mobileSampleUuid': 'wrong-uuid',
      'ownerId': 'another-owner',
      'revision': 99,
      'sampleId': 'wrong-display-id',
      'serverReceiptTimestamp': '2026-02-31T00:00:00.000Z',
    }.entries) {
      test(
        'mismatched or invalid receipt ${entry.key} leaves SQLite unchanged',
        () async {
          final body = uploadReceipt(selected);
          (body['receipt'] as Map)[entry.key] = entry.value;
          respond(body: body);
          expect((await upload()).succeeded, isFalse);
          expect(await repository.getSample(selected.id), selected);
        },
      );
    }
    test('missing receipt leaves SQLite unchanged', () async {
      respond(body: {'status': 'acknowledged'});
      expect((await upload()).succeeded, isFalse);
      expect(await repository.getSample(selected.id), selected);
    });
    test('offline failure leaves SQLite unchanged', () async {
      await server.close(force: true);
      final result = await upload();
      expect(result.succeeded, isFalse);
      expect(
        result.message,
        anyOf(contains('Network unavailable'), contains('timed out')),
      );
      expect(await repository.getSample(selected.id), selected);
    });
    test('timeout leaves SQLite unchanged', () async {
      service = SingleSampleUploadService(
        repository,
        AuthService(auth: firebase, isMockMode: false),
        timeout: const Duration(milliseconds: 100),
      );
      server.listen((request) {});
      final result = await upload();
      expect(result.succeeded, isFalse);
      expect(result.message, contains('timed out'));
      expect(await repository.getSample(selected.id), selected);
    });
    test('duplicate in-flight requests blocked; same UUID retry can receive original receipt', () async {
      final received = Completer<void>();
      final release = Completer<void>();
      var count = 0;
      server.listen((request) async {
        sent.add(
          jsonDecode(await utf8.decoder.bind(request).join())
              as Map<String, dynamic>,
        );
        count++;
        if (count == 1) {
          received.complete();
          await release.future;
          // Simulate persistence followed by loss of a usable acknowledgment.
          request.response.statusCode = 503;
        } else {
          request.response.statusCode = 200;
          request.response.write(
            jsonEncode(uploadReceipt(selected, action: 'idempotent_duplicate')),
          );
        }
        await request.response.close();
      });
      final first = upload();
      await received.future;
      expect((await upload()).message, contains('already in progress'));
      release.complete();
      expect((await first).succeeded, isFalse);
      expect(await repository.getSample(selected.id), selected);
      expect((await upload()).succeeded, isTrue);
      expect(sent, [fixtures.first, fixtures.first]);
    });
    test('account switch in flight prevents acknowledgment', () async {
      respond(
        beforeReply: () async {
          firebase.mockUser = FakeUser(uid: 'other');
        },
      );
      expect((await upload()).succeeded, isFalse);
      expect(await repository.getSample(selected.id), selected);
    });
    test('local edit in flight is preserved and never marked synced', () async {
      final edited = selected.copyWith(predictedGrade: const Value('ALBA'));
      respond(beforeReply: () => repository.updateSample(edited));
      expect((await upload()).succeeded, isFalse);
      expect(await repository.getSample(selected.id), edited);
    });
    test('token refresh failure sends nothing', () async {
      user.throwOnGetToken = true;
      respond();
      expect((await upload()).succeeded, isFalse);
      expect(sent, isEmpty);
      expect(await repository.getSample(selected.id), selected);
    });
    test(
      'redirect cannot forward credentials or mark a record synced',
      () async {
        var count = 0;
        server.listen((request) async {
          count++;
          request.response.statusCode = 307;
          request.response.headers.set(
            HttpHeaders.locationHeader,
            '$baseUrl/elsewhere',
          );
          await request.response.close();
        });
        expect((await upload()).succeeded, isFalse);
        expect(count, 1);
        expect(await repository.getSample(selected.id), selected);
      },
    );
  });
}
