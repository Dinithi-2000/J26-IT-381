import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quill_grade/core/services/auth_service.dart';

import 'auth_service_test.dart' show FakeFirebaseAuth, FakeUser;

void main() {
  late HttpServer server;
  late AuthService service;
  late FakeUser user;
  late String baseUrl;
  late List<String> logs;
  late DebugPrintCallback originalPrint;

  setUp(() async {
    user = FakeUser();
    service = AuthService(
      auth: FakeFirebaseAuth(mockUser: user),
      isMockMode: false,
    );
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    baseUrl = 'http://127.0.0.1:${server.port}';
    logs = [];
    originalPrint = debugPrint;
    debugPrint = (message, {wrapWidth}) => logs.add(message ?? '');
  });
  tearDown(() async {
    debugPrint = originalPrint;
    await server.close(force: true);
  });

  Future<BackendHandshakeResult> run() => service.verifyBackendHandshake(
    baseUrl: baseUrl,
    adbReverseConfigured: true, // Explicit loopback opt-in for test server.
    timeout: const Duration(seconds: 2),
  );

  void respond(Object body, {int status = 200}) {
    server.listen((request) async {
      expect(request.method, 'GET');
      expect(request.uri.path, '/api/grading/auth-check');
      expect(
        request.headers.value(HttpHeaders.authorizationHeader),
        'Bearer valid-firebase-jwt-token-xyz',
      );
      expect(await utf8.decoder.bind(request).join(), isEmpty);
      request.response.statusCode = status;
      request.response.write(jsonEncode(body));
      await request.response.close();
    });
  }

  test('fresh token and GET produce a sanitized PASS', () async {
    respond({
      'authenticated': true,
      'role': 'inspector',
      'organization': {'verified': true},
    });
    final result = await run();
    expect(result.isPass, isTrue);
    expect(result.statusCode, 200);
    expect(user.lastForceRefreshForGetIdToken, isTrue);
    for (final value in [
      user.uid,
      user.email!,
      'valid-firebase-jwt-token-xyz',
    ]) {
      expect('${logs.join()}$result', isNot(contains(value)));
    }
  });

  for (final status in [401, 403]) {
    test(
      'HTTP $status (invalid token or missing role) fails without echoing body',
      () async {
        respond({
          'error': {'code': 'private-server-content', 'message': user.email},
        }, status: status);
        final result = await run();
        expect(result.isPass, isFalse);
        expect(result.status, BackendHandshakeStatus.serverRejected);
        expect(result.statusCode, status);
        expect(
          '${logs.join()}$result',
          isNot(contains('private-server-content')),
        );
        expect('${logs.join()}$result', isNot(contains(user.email!)));
      },
    );
  }

  test('missing response role fails', () async {
    respond({
      'authenticated': true,
      'organization': {'verified': true},
    });
    expect((await run()).status, BackendHandshakeStatus.invalidRole);
  });
  test('organization must be explicitly verified', () async {
    respond({
      'authenticated': true,
      'role': 'inspector',
      'organization': {'id': 'matara-plant-01', 'verified': false},
    });
    expect((await run()).status, BackendHandshakeStatus.invalidOrganization);
  });
  test('authenticated must be true', () async {
    respond({
      'authenticated': false,
      'role': 'inspector',
      'organization': {'verified': true},
    });
    expect((await run()).isPass, isFalse);
  });
  test('refused connection is a network failure', () async {
    await server.close(force: true);
    expect((await run()).status, BackendHandshakeStatus.networkFailure);
  });
  test('stalled response times out', () async {
    server.listen((request) {});
    final result = await service.verifyBackendHandshake(
      baseUrl: baseUrl,
      adbReverseConfigured: true,
      timeout: const Duration(milliseconds: 100),
    );
    expect(result.status, BackendHandshakeStatus.networkFailure);
  });
  test('redirects are rejected without forwarding the token', () async {
    var requests = 0;
    server.listen((request) async {
      requests++;
      request.response.statusCode = 302;
      request.response.headers.set(
        HttpHeaders.locationHeader,
        '$baseUrl/redirected',
      );
      await request.response.close();
    });
    expect((await run()).status, BackendHandshakeStatus.serverRejected);
    expect(requests, 1);
  });
  for (final url in [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://[::1]:5000',
    'ftp://backend.test',
    'http://username:password@backend.test',
    'https://backend.test?secret=value',
    'https://backend.test/path',
    '',
  ]) {
    test('rejects unsafe or unconfigured origin: $url', () async {
      final result = await service.verifyBackendHandshake(baseUrl: url);
      expect(result.status, BackendHandshakeStatus.handshakeError);
    });
  }
  test('missing Firebase session cannot send a request', () async {
    service = AuthService(
      auth: FakeFirebaseAuth(mockUser: null),
      isMockMode: false,
    );
    expect((await run()).status, BackendHandshakeStatus.notAuthenticated);
  });
  test('demo users cannot send a request', () async {
    service = AuthService(
      auth: FakeFirebaseAuth(mockUser: user),
      isMockMode: true,
    );
    expect((await run()).status, BackendHandshakeStatus.demoUserNotAllowed);
  });
  test('token refresh failure cannot send a request', () async {
    user.throwOnGetToken = true;
    expect((await run()).status, BackendHandshakeStatus.tokenRetrievalFailed);
    expect(logs.join(), isNot(contains('FirebaseAuthException')));
  });
}
