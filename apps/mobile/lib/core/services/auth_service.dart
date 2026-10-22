import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';

import 'dart:async';
import 'dart:io';
import 'dart:convert';

import '../../firebase_options.dart';
import 'backend_connection.dart';

class AppUser {
  final String uid;
  final String? email;
  final String? displayName;
  AppUser({required this.uid, this.email, this.displayName});
}

enum ClaimsVerificationStatus {
  passed,
  notAuthenticated,
  demoUserNotAllowed,
  missingClaims,
  invalidRole,
  invalidOrganization,
  verificationError,
}

class InspectorClaimsVerificationResult {
  final bool isPass;
  final ClaimsVerificationStatus status;
  final String sanitizedMessage;

  const InspectorClaimsVerificationResult({
    required this.isPass,
    required this.status,
    required this.sanitizedMessage,
  });

  static const String expectedRole = 'inspector';
  static const String expectedOrgId = 'matara-plant-01';

  @override
  String toString() =>
      'InspectorClaimsVerificationResult(isPass: $isPass, status: ${status.name}, message: $sanitizedMessage)';
}

enum BackendHandshakeStatus {
  disabled,
  passed,
  notAuthenticated,
  demoUserNotAllowed,
  tokenRetrievalFailed,
  networkFailure,
  serverRejected,
  invalidRole,
  invalidOrganization,
  handshakeError,
}

class BackendHandshakeResult {
  final bool isPass;
  final BackendHandshakeStatus status;
  final int? statusCode;
  final String sanitizedMessage;

  const BackendHandshakeResult({
    required this.isPass,
    required this.status,
    this.statusCode,
    required this.sanitizedMessage,
  });

  @override
  String toString() =>
      'BackendHandshakeResult(isPass: $isPass, status: ${status.name}, statusCode: $statusCode, message: $sanitizedMessage)';
}

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

final authStateProvider = StreamProvider<AppUser?>((ref) {
  return ref.watch(authServiceProvider).authStateChanges;
});

class AuthService {
  final firebase_auth.FirebaseAuth _auth;
  final _mockUserController = StreamController<AppUser?>.broadcast();
  AppUser? _mockUser;
  final bool? _mockModeOverride;

  bool get _isMockMode {
    if (_mockModeOverride != null) return _mockModeOverride;
    if (kIsWeb) return true;
    try {
      final apiKey = DefaultFirebaseOptions.currentPlatform.apiKey;
      return apiKey.contains('PLACEHOLDER') || apiKey.isEmpty;
    } catch (_) {
      return true;
    }
  }

  AuthService({firebase_auth.FirebaseAuth? auth, bool? isMockMode})
    : _auth = auth ?? firebase_auth.FirebaseAuth.instance,
      _mockModeOverride = isMockMode {
    if (!_isMockMode) {
      try {
        _auth.authStateChanges().listen((fbUser) {
          if (fbUser != null) {
            _mockUserController.add(
              AppUser(
                uid: fbUser.uid,
                email: fbUser.email,
                displayName: fbUser.displayName,
              ),
            );
          } else {
            _mockUserController.add(_mockUser);
          }
        });
      } catch (e) {
        debugPrint('AuthService Firebase listener note: $e');
        Future.microtask(() => _mockUserController.add(null));
      }
    } else {
      // Start logged out in mock mode
      Future.microtask(() => _mockUserController.add(null));
    }
  }

  Stream<AppUser?> get authStateChanges async* {
    yield currentUser;
    yield* _mockUserController.stream;
  }

  AppUser? get currentUser {
    if (_isMockMode || _mockUser != null) return _mockUser;
    try {
      final fb = _auth.currentUser;
      return fb == null
          ? null
          : AppUser(uid: fb.uid, email: fb.email, displayName: fb.displayName);
    } catch (_) {
      return _mockUser;
    }
  }

  /// Returns true only if a genuine Firebase user is currently authenticated (not demo mode).
  bool get isRealFirebaseUser =>
      !_isMockMode && _mockUser == null && _auth.currentUser != null;

  /// Retrieves the verified Firebase ID token for the current authenticated user.
  /// Returns null if no real Firebase user is authenticated or if operating as a demo user.
  /// Never returns fake tokens such as 'demo-token'.
  Future<String?> getIdToken({bool forceRefresh = false}) async {
    // Demo users must never be able to authenticate cloud API requests
    if (_isMockMode || _mockUser != null) {
      return null;
    }

    try {
      final user = _auth.currentUser;
      if (user == null) return null;
      return await user.getIdToken(forceRefresh);
    } catch (_) {
      debugPrint('AuthService: Firebase token retrieval failed.');
      return null;
    }
  }

  /// Retrieves the custom claims (e.g. role, orgId) from the current user's ID token.
  /// Returns null if no real Firebase user is authenticated or if operating as a demo user.
  /// Never fabricates inspector or organization claims for demo users.
  Future<Map<String, dynamic>?> getCustomClaims({
    bool forceRefresh = false,
  }) async {
    // Demo users must never have fabricated inspector or organization claims
    if (_isMockMode || _mockUser != null) {
      return null;
    }

    try {
      final user = _auth.currentUser;
      if (user == null) return null;
      final idTokenResult = await user.getIdTokenResult(forceRefresh);
      return idTokenResult.claims;
    } catch (e) {
      debugPrint('AuthService getCustomClaims error: $e');
      return null;
    }
  }

  /// Minimal development/diagnostic verification helper to verify Firebase custom claims.
  /// Enforces:
  /// - Real Firebase session required (demo/mock mode explicitly rejected).
  /// - Force-refreshes token via getCustomClaims(forceRefresh: true).
  /// - Confirms role == 'inspector' and orgId == 'matara-plant-01'.
  /// - Returns sanitized PASS/FAIL and non-sensitive status category.
  /// - Never prints or leaks raw tokens, complete claims maps, passwords, emails, or UIDs.
  /// - Cannot be used as an authentication bypass.
  Future<InspectorClaimsVerificationResult> verifyInspectorClaims({
    bool forceRefresh = true,
  }) async {
    if (_isMockMode || _mockUser != null) {
      const res = InspectorClaimsVerificationResult(
        isPass: false,
        status: ClaimsVerificationStatus.demoUserNotAllowed,
        sanitizedMessage: 'FAIL: Demo/mock users cannot be verified as production inspectors.',
      );
      debugPrint('[ClaimsDiagnostic] ${res.sanitizedMessage}');
      return res;
    }

    if (_auth.currentUser == null) {
      const res = InspectorClaimsVerificationResult(
        isPass: false,
        status: ClaimsVerificationStatus.notAuthenticated,
        sanitizedMessage:
            'FAIL: No active Firebase authentication session found.',
      );
      debugPrint('[ClaimsDiagnostic] ${res.sanitizedMessage}');
      return res;
    }

    try {
      final claims = await getCustomClaims(forceRefresh: forceRefresh);
      if (claims == null) {
        const res = InspectorClaimsVerificationResult(
          isPass: false,
          status: ClaimsVerificationStatus.missingClaims,
          sanitizedMessage:
              'FAIL: No custom claims returned by Firebase ID token.',
        );
        debugPrint('[ClaimsDiagnostic] ${res.sanitizedMessage}');
        return res;
      }

      final role = claims['role'];
      final orgId = claims['orgId'];

      if (role != InspectorClaimsVerificationResult.expectedRole) {
        const res = InspectorClaimsVerificationResult(
          isPass: false,
          status: ClaimsVerificationStatus.invalidRole,
          sanitizedMessage:
              'FAIL: User does not hold the authorized inspector role.',
        );
        debugPrint('[ClaimsDiagnostic] ${res.sanitizedMessage}');
        return res;
      }

      if (orgId != InspectorClaimsVerificationResult.expectedOrgId) {
        const res = InspectorClaimsVerificationResult(
          isPass: false,
          status: ClaimsVerificationStatus.invalidOrganization,
          sanitizedMessage:
              'FAIL: User does not belong to the authorized organization.',
        );
        debugPrint('[ClaimsDiagnostic] ${res.sanitizedMessage}');
        return res;
      }

      const res = InspectorClaimsVerificationResult(
        isPass: true,
        status: ClaimsVerificationStatus.passed,
        sanitizedMessage: 'PASS: Verified inspector credentials for organization matara-plant-01.',
      );
      debugPrint('[ClaimsDiagnostic] ${res.sanitizedMessage}');
      return res;
    } catch (_) {
      const res = InspectorClaimsVerificationResult(
        isPass: false,
        status: ClaimsVerificationStatus.verificationError,
        sanitizedMessage:
            'FAIL: Verification encountered an error during token refresh.',
      );
      debugPrint('[ClaimsDiagnostic] ${res.sanitizedMessage}');
      return res;
    }
  }

  /// Minimal development-only diagnostic: Verifies real Android-to-Express authentication handshake.
  /// Enforces:
  /// - Real Firebase user session required (demo/mock mode explicitly rejected).
  /// - Obtains fresh Firebase ID token via getIdToken(forceRefresh: true).
  /// - Calls GET /api/grading/auth-check with `Authorization: Bearer <token>`.
  /// - Validates response: authenticated == true, role == 'inspector', organization verified.
  /// - Returns sanitized PASS/FAIL and non-sensitive status category.
  /// - Never logs or displays raw tokens, credentials, UID, or user email.
  /// - Configurable baseUrl accessible from physical Android phone or ADB reverse.
  Future<BackendHandshakeResult> verifyBackendHandshake({
    required String baseUrl,
    bool adbReverseConfigured = const bool.fromEnvironment(
      'BACKEND_ADB_REVERSE',
    ),
    HttpClient? customHttpClient,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    if (!kDebugMode) {
      return const BackendHandshakeResult(
        isPass: false,
        status: BackendHandshakeStatus.disabled,
        sanitizedMessage: 'FAIL: Diagnostic is available only in debug builds.',
      );
    }
    if (_isMockMode || _mockUser != null) {
      const res = BackendHandshakeResult(
        isPass: false,
        status: BackendHandshakeStatus.demoUserNotAllowed,
        sanitizedMessage:
            'FAIL: Demo/mock users cannot be used for backend authentication.',
      );
      debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
      return res;
    }

    if (_auth.currentUser == null) {
      const res = BackendHandshakeResult(
        isPass: false,
        status: BackendHandshakeStatus.notAuthenticated,
        sanitizedMessage: 'FAIL: No active Firebase session found.',
      );
      debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
      return res;
    }

    final token = await getIdToken(forceRefresh: true)
        .timeout(timeout, onTimeout: () => null);
    if (token == null || token.isEmpty) {
      const res = BackendHandshakeResult(
        isPass: false,
        status: BackendHandshakeStatus.tokenRetrievalFailed,
        sanitizedMessage: 'FAIL: Could not retrieve a valid Firebase ID token.',
      );
      debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
      return res;
    }

    final Uri targetUri;
    try {
      targetUri = backendEndpoint(
        baseUrl,
        '/api/grading/auth-check',
        adbReverseConfigured: adbReverseConfigured,
      );
    } catch (_) {
      const res = BackendHandshakeResult(
        isPass: false,
        status: BackendHandshakeStatus.handshakeError,
        sanitizedMessage: 'FAIL: Use a backend origin URL; loopback requires explicitly configured ADB reverse.',
      );
      debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
      return res;
    }

    final client = customHttpClient ?? HttpClient();
    client.connectionTimeout = timeout;

    try {
      final request = await client.getUrl(targetUri).timeout(timeout);
      request.followRedirects = false;
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      request.headers.set(HttpHeaders.acceptHeader, 'application/json');
      final response = await request.close().timeout(timeout);

      if (response.statusCode != 200) {
        final res = BackendHandshakeResult(
          isPass: false,
          status: BackendHandshakeStatus.serverRejected,
          statusCode: response.statusCode,
          sanitizedMessage:
              'FAIL: Backend rejected authentication with HTTP ${response.statusCode}.',
        );
        debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
        return res;
      }

      final responseBody = await response
          .transform(utf8.decoder)
          .join()
          .timeout(timeout);
      final json = jsonDecode(responseBody) as Map<String, dynamic>;
      final bool authenticated = json['authenticated'] == true;
      final String? role = json['role']?.toString();
      final org = json['organization'];
      final organizationVerified = org is Map && org['verified'] == true;

      if (!authenticated) {
        const res = BackendHandshakeResult(
          isPass: false,
          status: BackendHandshakeStatus.serverRejected,
          statusCode: 200,
          sanitizedMessage:
              'FAIL: Backend did not confirm authenticated state.',
        );
        debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
        return res;
      }

      if (role != 'inspector') {
        final res = BackendHandshakeResult(
          isPass: false,
          status: BackendHandshakeStatus.invalidRole,
          statusCode: 200,
          sanitizedMessage: 'FAIL: Backend did not confirm the inspector role.',
        );
        debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
        return res;
      }

      if (!organizationVerified) {
        final res = BackendHandshakeResult(
          isPass: false,
          status: BackendHandshakeStatus.invalidOrganization,
          statusCode: 200,
          sanitizedMessage:
              'FAIL: Backend did not verify the expected organization.',
        );
        debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
        return res;
      }

      const res = BackendHandshakeResult(
        isPass: true,
        status: BackendHandshakeStatus.passed,
        statusCode: 200,
        sanitizedMessage: 'PASS: Express backend confirmed inspector credentials for matara-plant-01.',
      );
      debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
      return res;
    } on SocketException catch (_) {
      const res = BackendHandshakeResult(
        isPass: false,
        status: BackendHandshakeStatus.networkFailure,
        sanitizedMessage: 'FAIL: Network connection to Express backend failed. Ensure server is running and check URL/ADB reverse.',
      );
      debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
      return res;
    } on TimeoutException catch (_) {
      const res = BackendHandshakeResult(
        isPass: false,
        status: BackendHandshakeStatus.networkFailure,
        sanitizedMessage: 'FAIL: Connection to Express backend timed out.',
      );
      debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
      return res;
    } catch (_) {
      const res = BackendHandshakeResult(
        isPass: false,
        status: BackendHandshakeStatus.handshakeError,
        sanitizedMessage: 'FAIL: Handshake encountered an unexpected error.',
      );
      debugPrint('[HandshakeDiagnostic] ${res.sanitizedMessage}');
      return res;
    } finally {
      if (customHttpClient == null) {
        client.close(force: true);
      }
    }
  }

  Future<void> signInWithEmailAndPassword(String email, String password) async {
    if (_isMockMode || email.toLowerCase() == 'demo@quillgrade.com') {
      _mockUser = AppUser(
        uid: 'demo-inspector-1',
        email: email,
        displayName: email.contains('@') ? email.split('@').first : 'Demo User',
      );
      _mockUserController.add(_mockUser);
      return;
    }
    try {
      await _auth.signInWithEmailAndPassword(email: email, password: password);
      _mockUser = null;
    } catch (e) {
      // If Firebase failed due to placeholder / invalid API key, fallback to demo user
      if (e.toString().contains('API key not valid') ||
          e.toString().contains('PLACEHOLDER')) {
        _mockUser = AppUser(
          uid: 'demo-inspector-1',
          email: email,
          displayName: email.contains('@')
              ? email.split('@').first
              : 'Demo User',
        );
        _mockUserController.add(_mockUser);
        return;
      }
      rethrow;
    }
  }

  Future<void> createUserWithEmailAndPassword(
    String email,
    String password,
  ) async {
    if (_isMockMode) {
      _mockUser = AppUser(
        uid: 'demo-inspector-1',
        email: email,
        displayName: email.contains('@') ? email.split('@').first : 'Demo User',
      );
      _mockUserController.add(_mockUser);
      return;
    }
    try {
      await _auth.createUserWithEmailAndPassword(
        email: email,
        password: password,
      );
      _mockUser = null;
    } catch (e) {
      if (e.toString().contains('API key not valid') ||
          e.toString().contains('PLACEHOLDER')) {
        _mockUser = AppUser(
          uid: 'demo-inspector-1',
          email: email,
          displayName: email.contains('@')
              ? email.split('@').first
              : 'Demo User',
        );
        _mockUserController.add(_mockUser);
        return;
      }
      rethrow;
    }
  }

  Future<void> signOut() async {
    _mockUser = null;
    _mockUserController.add(null);
    if (!_isMockMode) {
      try {
        await _auth.signOut();
      } catch (_) {}
    }
  }
}
