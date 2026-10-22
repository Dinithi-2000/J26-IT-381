import 'dart:async';
import 'package:firebase_auth/firebase_auth.dart' as fb;
import 'package:flutter_test/flutter_test.dart';
import 'package:quill_grade/core/services/auth_service.dart';

class FakeIdTokenResult implements fb.IdTokenResult {
  final Map<String, dynamic> _claims;
  final String _token;

  FakeIdTokenResult({
    Map<String, dynamic>? claims,
    this._token = 'mock-real-jwt-token',
  }) : _claims = claims ?? {};

  @override
  Map<String, dynamic>? get claims => _claims;

  @override
  String? get token => _token;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeUser implements fb.User {
  final String _uid;
  final String? _email;
  final String? _displayName;
  final String _token;
  final Map<String, dynamic> _claims;

  bool? lastForceRefreshForGetIdToken;
  bool? lastForceRefreshForGetIdTokenResult;
  bool throwOnGetToken = false;
  bool throwOnGetClaims = false;

  FakeUser({
    this._uid = 'real-firebase-uid-123',
    this._email = 'real-inspector@quillgrade.com',
    this._displayName = 'Real Inspector',
    this._token = 'valid-firebase-jwt-token-xyz',
    Map<String, dynamic>? claims,
  }) : _claims = claims ?? const {'role': 'inspector', 'orgId': 'matara-plant-01'};

  @override
  String get uid => _uid;

  @override
  String? get email => _email;

  @override
  String? get displayName => _displayName;

  @override
  Future<String> getIdToken([bool forceRefresh = false]) async {
    lastForceRefreshForGetIdToken = forceRefresh;
    if (throwOnGetToken) {
      throw fb.FirebaseAuthException(
        code: 'network-request-failed',
        message: 'Network request failed',
      );
    }
    return _token;
  }

  @override
  Future<fb.IdTokenResult> getIdTokenResult([bool forceRefresh = false]) async {
    lastForceRefreshForGetIdTokenResult = forceRefresh;
    if (throwOnGetClaims) {
      throw fb.FirebaseAuthException(
        code: 'user-token-expired',
        message: 'Token expired',
      );
    }
    return FakeIdTokenResult(claims: _claims, token: _token);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeFirebaseAuth implements fb.FirebaseAuth {
  FakeUser? mockUser;
  final StreamController<fb.User?> _authStateStream = StreamController<fb.User?>.broadcast();
  bool signOutCalled = false;

  FakeFirebaseAuth({this.mockUser});

  @override
  fb.User? get currentUser => mockUser;

  @override
  Stream<fb.User?> authStateChanges() => _authStateStream.stream;

  @override
  Future<fb.UserCredential> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    final user = FakeUser(uid: 'signed-in-$email', email: email);
    mockUser = user;
    _authStateStream.add(user);
    return FakeUserCredential(user);
  }

  @override
  Future<fb.UserCredential> createUserWithEmailAndPassword({
    required String email,
    required String password,
  }) async {
    final user = FakeUser(uid: 'created-$email', email: email);
    mockUser = user;
    _authStateStream.add(user);
    return FakeUserCredential(user);
  }

  @override
  Future<void> signOut() async {
    signOutCalled = true;
    mockUser = null;
    _authStateStream.add(null);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class FakeUserCredential implements fb.UserCredential {
  final fb.User? _user;
  FakeUserCredential(this._user);

  @override
  fb.User? get user => _user;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  group('AuthService - Real Firebase User Token and Claims', () {
    late FakeUser fakeUser;
    late FakeFirebaseAuth fakeAuth;
    late AuthService authService;

    setUp(() {
      fakeUser = FakeUser(
        uid: 'inspector-uid-456',
        email: 'inspector@quillgrade.com',
        token: 'real-firebase-token-abc-123',
        claims: {'role': 'inspector', 'orgId': 'matara-plant-01'},
      );
      fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
      authService = AuthService(auth: fakeAuth, isMockMode: false);
    });

    test('isRealFirebaseUser returns true when genuine Firebase user is authenticated', () {
      expect(authService.isRealFirebaseUser, isTrue);
      expect(authService.currentUser?.uid, 'inspector-uid-456');
      expect(authService.currentUser?.email, 'inspector@quillgrade.com');
    });

    test('getIdToken() returns real Firebase ID token with forceRefresh = false by default', () async {
      final token = await authService.getIdToken();
      expect(token, 'real-firebase-token-abc-123');
      expect(fakeUser.lastForceRefreshForGetIdToken, isFalse);
    });

    test('getIdToken(forceRefresh: true) passes forceRefresh flag to Firebase User', () async {
      final token = await authService.getIdToken(forceRefresh: true);
      expect(token, 'real-firebase-token-abc-123');
      expect(fakeUser.lastForceRefreshForGetIdToken, isTrue);
    });

    test('getCustomClaims() returns verified custom claims with forceRefresh = false by default', () async {
      final claims = await authService.getCustomClaims();
      expect(claims, isNotNull);
      expect(claims?['role'], 'inspector');
      expect(claims?['orgId'], 'matara-plant-01');
      expect(fakeUser.lastForceRefreshForGetIdTokenResult, isFalse);
    });

    test('getCustomClaims(forceRefresh: true) passes forceRefresh flag to Firebase User', () async {
      final claims = await authService.getCustomClaims(forceRefresh: true);
      expect(claims, isNotNull);
      expect(claims?['role'], 'inspector');
      expect(claims?['orgId'], 'matara-plant-01');
      expect(fakeUser.lastForceRefreshForGetIdTokenResult, isTrue);
    });
  });

  group('AuthService - Missing Login (Unauthenticated State)', () {
    late FakeFirebaseAuth fakeAuth;
    late AuthService authService;

    setUp(() {
      fakeAuth = FakeFirebaseAuth(mockUser: null);
      authService = AuthService(auth: fakeAuth, isMockMode: false);
    });

    test('currentUser is null and isRealFirebaseUser is false', () {
      expect(authService.currentUser, isNull);
      expect(authService.isRealFirebaseUser, isFalse);
    });

    test('getIdToken returns null when unauthenticated', () async {
      final token = await authService.getIdToken();
      expect(token, isNull);
    });

    test('getCustomClaims returns null when unauthenticated', () async {
      final claims = await authService.getCustomClaims();
      expect(claims, isNull);
    });
  });

  group('AuthService - Demo Mode & Offline Isolation', () {
    test('demo login via demo@quillgrade.com never returns ID token or fabricated claims', () async {
      final fakeAuth = FakeFirebaseAuth(mockUser: null);
      final authService = AuthService(auth: fakeAuth, isMockMode: false);

      // Sign in with demo account
      await authService.signInWithEmailAndPassword('demo@quillgrade.com', 'demo-password');

      // Demo user is authenticated for offline UI
      expect(authService.currentUser, isNotNull);
      expect(authService.currentUser?.uid, 'demo-inspector-1');
      expect(authService.currentUser?.email, 'demo@quillgrade.com');

      // Demo user is NOT a real Firebase user
      expect(authService.isRealFirebaseUser, isFalse);

      // getIdToken must return null (NEVER 'demo-token')
      final token = await authService.getIdToken();
      expect(token, isNull);
      expect(token != 'demo-token', isTrue);

      // getCustomClaims must return null (NEVER fabricated claims)
      final claims = await authService.getCustomClaims();
      expect(claims, isNull);
    });

    test('mock mode override strictly returns null for tokens and claims', () async {
      final fakeUser = FakeUser(
        uid: 'some-user',
        token: 'should-not-be-returned',
        claims: {'role': 'inspector'},
      );
      final fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
      final authService = AuthService(auth: fakeAuth, isMockMode: true);

      expect(authService.isRealFirebaseUser, isFalse);

      final token = await authService.getIdToken();
      expect(token, isNull);

      final claims = await authService.getCustomClaims();
      expect(claims, isNull);
    });

    test('sign out cleans up state properly', () async {
      final fakeUser = FakeUser(uid: 'real-user-123');
      final fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
      final authService = AuthService(auth: fakeAuth, isMockMode: false);

      expect(authService.isRealFirebaseUser, isTrue);

      await authService.signOut();

      expect(fakeAuth.signOutCalled, isTrue);
      expect(authService.isRealFirebaseUser, isFalse);
      expect(await authService.getIdToken(), isNull);
      expect(await authService.getCustomClaims(), isNull);
    });
  });

  group('AuthService - Error Handling & Safe Degradation', () {
    test('getIdToken safely returns null if Firebase throws an exception', () async {
      final fakeUser = FakeUser(uid: 'err-user')..throwOnGetToken = true;
      final fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
      final authService = AuthService(auth: fakeAuth, isMockMode: false);

      final token = await authService.getIdToken();
      expect(token, isNull);
    });

    test('getCustomClaims safely returns null if Firebase throws an exception', () async {
      final fakeUser = FakeUser(uid: 'err-user')..throwOnGetClaims = true;
      final fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
      final authService = AuthService(auth: fakeAuth, isMockMode: false);

      final claims = await authService.getCustomClaims();
      expect(claims, isNull);
    });
  });

  group('AuthService - verifyInspectorClaims Diagnostic', () {
    test('passes when real user has role=inspector and orgId=matara-plant-01', () async {
      final fakeUser = FakeUser(
        uid: 'inspector-123',
        claims: const {'role': 'inspector', 'orgId': 'matara-plant-01'},
      );
      final fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
      final authService = AuthService(auth: fakeAuth, isMockMode: false);

      final result = await authService.verifyInspectorClaims(forceRefresh: true);

      expect(result.isPass, isTrue);
      expect(result.status, ClaimsVerificationStatus.passed);
      expect(result.sanitizedMessage.startsWith('PASS'), isTrue);
      expect(fakeUser.lastForceRefreshForGetIdTokenResult, isTrue);
    });

    test('fails when role is not inspector', () async {
      final fakeUser = FakeUser(
        uid: 'user-123',
        claims: const {'role': 'viewer', 'orgId': 'matara-plant-01'},
      );
      final fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
      final authService = AuthService(auth: fakeAuth, isMockMode: false);

      final result = await authService.verifyInspectorClaims();

      expect(result.isPass, isFalse);
      expect(result.status, ClaimsVerificationStatus.invalidRole);
      expect(result.sanitizedMessage.startsWith('FAIL'), isTrue);
    });

    test('fails when orgId is not matara-plant-01', () async {
      final fakeUser = FakeUser(
        uid: 'inspector-123',
        claims: const {'role': 'inspector', 'orgId': 'galle-facility-02'},
      );
      final fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
      final authService = AuthService(auth: fakeAuth, isMockMode: false);

      final result = await authService.verifyInspectorClaims();

      expect(result.isPass, isFalse);
      expect(result.status, ClaimsVerificationStatus.invalidOrganization);
      expect(result.sanitizedMessage.startsWith('FAIL'), isTrue);
    });

    test('fails when claims are missing or null', () async {
      final fakeUser = FakeUser(
        uid: 'inspector-123',
        claims: const {},
      );
      final fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
      final authService = AuthService(auth: fakeAuth, isMockMode: false);

      final result = await authService.verifyInspectorClaims();

      expect(result.isPass, isFalse);
      expect(result.status, ClaimsVerificationStatus.invalidRole);
      expect(result.sanitizedMessage.startsWith('FAIL'), isTrue);
    });

    test('fails when unauthenticated', () async {
      final fakeAuth = FakeFirebaseAuth(mockUser: null);
      final authService = AuthService(auth: fakeAuth, isMockMode: false);

      final result = await authService.verifyInspectorClaims();

      expect(result.isPass, isFalse);
      expect(result.status, ClaimsVerificationStatus.notAuthenticated);
      expect(result.sanitizedMessage.startsWith('FAIL'), isTrue);
    });

    test('fails when operating as demo user', () async {
      final fakeAuth = FakeFirebaseAuth(mockUser: null);
      final authService = AuthService(auth: fakeAuth, isMockMode: false);

      await authService.signInWithEmailAndPassword('demo@quillgrade.com', 'demo-pwd');

      final result = await authService.verifyInspectorClaims();

      expect(result.isPass, isFalse);
      expect(result.status, ClaimsVerificationStatus.demoUserNotAllowed);
      expect(result.sanitizedMessage.startsWith('FAIL'), isTrue);
    });

    test('fails when operating in mock mode', () async {
      final fakeUser = FakeUser(
        uid: 'inspector-123',
        claims: const {'role': 'inspector', 'orgId': 'matara-plant-01'},
      );
      final fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
      final authService = AuthService(auth: fakeAuth, isMockMode: true);

      final result = await authService.verifyInspectorClaims();

      expect(result.isPass, isFalse);
      expect(result.status, ClaimsVerificationStatus.demoUserNotAllowed);
    });

    test('fails gracefully when Firebase throws during verification', () async {
      final fakeUser = FakeUser(uid: 'inspector-123')..throwOnGetClaims = true;
      final fakeAuth = FakeFirebaseAuth(mockUser: fakeUser);
      final authService = AuthService(auth: fakeAuth, isMockMode: false);

      final result = await authService.verifyInspectorClaims();

      expect(result.isPass, isFalse);
      expect(result.status, ClaimsVerificationStatus.missingClaims);
    });
  });
}
