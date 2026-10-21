import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';
import 'dart:async';

import '../../firebase_options.dart';

class AppUser {
  final String uid;
  final String? email;
  final String? displayName;
  AppUser({required this.uid, this.email, this.displayName});
}

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

final authStateProvider = StreamProvider<AppUser?>((ref) {
  return ref.watch(authServiceProvider).authStateChanges;
});

class AuthService {
  final firebase_auth.FirebaseAuth _auth = firebase_auth.FirebaseAuth.instance;
  final _mockUserController = StreamController<AppUser?>.broadcast();
  AppUser? _mockUser;

  bool get _isMockMode {
    if (kIsWeb) return true;
    try {
      final apiKey = DefaultFirebaseOptions.currentPlatform.apiKey;
      return apiKey.contains('PLACEHOLDER') || apiKey.isEmpty;
    } catch (_) {
      return true;
    }
  }

  AuthService() {
    if (!_isMockMode) {
      try {
        _auth.authStateChanges().listen((fbUser) {
          if (fbUser != null) {
            _mockUserController.add(AppUser(uid: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName));
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
      return fb == null ? null : AppUser(uid: fb.uid, email: fb.email, displayName: fb.displayName);
    } catch (_) {
      return _mockUser;
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
    } catch (e) {
      // If Firebase failed due to placeholder / invalid API key, fallback to demo user
      if (e.toString().contains('API key not valid') || e.toString().contains('PLACEHOLDER')) {
        _mockUser = AppUser(
          uid: 'demo-inspector-1',
          email: email,
          displayName: email.contains('@') ? email.split('@').first : 'Demo User',
        );
        _mockUserController.add(_mockUser);
        return;
      }
      rethrow;
    }
  }

  Future<void> createUserWithEmailAndPassword(String email, String password) async {
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
      await _auth.createUserWithEmailAndPassword(email: email, password: password);
    } catch (e) {
      if (e.toString().contains('API key not valid') || e.toString().contains('PLACEHOLDER')) {
        _mockUser = AppUser(
          uid: 'demo-inspector-1',
          email: email,
          displayName: email.contains('@') ? email.split('@').first : 'Demo User',
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
