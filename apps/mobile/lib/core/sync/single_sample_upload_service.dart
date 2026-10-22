import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/app_database.dart';
import '../database/repositories/sample_repository.dart';
import '../services/auth_service.dart';
import '../services/backend_connection.dart';
import 'grading_upload_mapper.dart';

final singleSampleUploadProvider = Provider<SingleSampleUploadService>(
  (ref) => SingleSampleUploadService(
    ref.watch(sampleRepositoryProvider),
    ref.watch(authServiceProvider),
  ),
);

class SingleUploadResult {
  final bool succeeded;
  final String message;
  const SingleUploadResult(this.succeeded, this.message);
}

/// One explicit request per confirmation. No queue, timer, automatic retry,
/// photo upload, Workmanager, Firestore, or legacy SyncManager interaction.
class SingleSampleUploadService {
  final SampleRepository _repository;
  final AuthService _auth;
  final Duration timeout;
  bool _inFlight = false;

  SingleSampleUploadService(
    this._repository,
    this._auth, {
    this.timeout = const Duration(seconds: 15),
  });

  bool _sameUser(String uid) =>
      _auth.isRealFirebaseUser && _auth.currentUser?.uid == uid;

  String _inspectorUid() {
    final uid = _auth.currentUser?.uid;
    if (!_auth.isRealFirebaseUser ||
        uid == null ||
        uid.isEmpty ||
        const ['demo-inspector-1', 'inspector-1'].contains(uid)) {
      throw const UploadValidationException(
        'Sign in with a real Firebase inspector account. Demo records cannot be uploaded.',
      );
    }
    return uid;
  }

  Future<List<Sample>> eligibleSamples() async {
    if (!kDebugMode) return [];
    final uid = _inspectorUid();
    final candidates = await _repository.getUnsyncedSamplesForOwner(uid);
    if (!_sameUser(uid)) return [];
    return candidates.where((sample) {
      try {
        mapGradingUpload(sample, uid);
        return true;
      } on UploadValidationException {
        return false;
      }
    }).toList();
  }

  Future<SingleUploadResult> upload(
    Sample selected, {
    required String baseUrl,
    bool confirmed = false,
    bool adbReverseConfigured = const bool.fromEnvironment(
      'BACKEND_ADB_REVERSE',
    ),
  }) async {
    if (!kDebugMode || !confirmed) {
      return const SingleUploadResult(
        false,
        'A debug build and explicit confirmation are required.',
      );
    }
    if (_inFlight) {
      return const SingleUploadResult(
        false,
        'An upload is already in progress. No second request was sent.',
      );
    }
    _inFlight = true;
    HttpClient? client;
    try {
      final uid = _inspectorUid();
      final payload = mapGradingUpload(selected, uid);
      final uri = backendEndpoint(
        baseUrl,
        '/api/grading/sync',
        adbReverseConfigured: adbReverseConfigured,
      );
      final token = await _auth.getIdToken(forceRefresh: true).timeout(timeout);
      if (token == null || token.isEmpty || !_sameUser(uid)) {
        return const SingleUploadResult(
          false,
          'Firebase session changed or token refresh failed. No record uploaded.',
        );
      }
      final current = await _repository.getSample(selected.id);
      if (current != selected || !_sameUser(uid)) {
        return const SingleUploadResult(
          false,
          'The record or account changed. Reload and confirm the record again.',
        );
      }
      client = HttpClient()..connectionTimeout = timeout;
      final request = await client.postUrl(uri).timeout(timeout);
      request.followRedirects = false;
      if (!_sameUser(uid)) {
        return const SingleUploadResult(
          false,
          'Account changed before sending. Record remains pending.',
        );
      }
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      request.headers.contentType = ContentType.json;
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      request.write(jsonEncode(payload));
      final response = await request.close().timeout(timeout);
      if (response.statusCode != 200 && response.statusCode != 201) {
        return SingleUploadResult(
          false,
          'Backend returned HTTP ${response.statusCode}. Record remains pending; no valid receipt was received.',
        );
      }
      final bytes = await response
          .fold<List<int>>([], (buffer, chunk) {
            if (buffer.length + chunk.length > 65536) {
              throw const UploadValidationException(
                'Backend receipt is too large. Record remains pending.',
              );
            }
            return buffer..addAll(chunk);
          })
          .timeout(timeout);
      final receiptTime = validateUploadReceipt(
        jsonDecode(utf8.decode(bytes)),
        selected,
      );
      if (!_sameUser(uid) ||
          !await _repository.acknowledgeUpload(
            selected,
            receiptTime,
            isCurrentUser: () => _sameUser(uid),
          )) {
        return const SingleUploadResult(
          false,
          'Backend acknowledged the upload, but the local record or account changed. Local record remains pending.',
        );
      }
      return const SingleUploadResult(
        true,
        'Backend acknowledged this record. Receipt validated and saved locally. Photos remain on this device.',
      );
    } on UploadValidationException catch (error) {
      return SingleUploadResult(false, error.message);
    } on SocketException {
      return const SingleUploadResult(
        false,
        'Network unavailable. Record remains pending. The server may have received it; retry this same record after reconnecting.',
      );
    } on TimeoutException {
      return const SingleUploadResult(
        false,
        'Upload timed out. Record remains pending. The server may have received it; retry this same record.',
      );
    } on FormatException {
      return const SingleUploadResult(
        false,
        'Invalid backend URL or receipt. Check the shared URL and ADB reverse configuration. Record remains pending.',
      );
    } catch (_) {
      return const SingleUploadResult(
        false,
        'Upload could not be acknowledged locally. Record remains pending; retry the same record after checking the connection.',
      );
    } finally {
      client?.close(force: true);
      _inFlight = false;
    }
  }
}
