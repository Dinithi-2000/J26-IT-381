import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';

import 'firebase_options.dart';
import 'router.dart';
import 'theme.dart';
import 'core/sync/sync_manager.dart';

import 'package:shared_preferences/shared_preferences.dart';
import 'core/services/preferences_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (e) {
    debugPrint('Firebase initialization note: $e');
  }

  try {
    final prefs = await SharedPreferences.getInstance();

    final container = ProviderContainer(
      overrides: [
        sharedPreferencesProvider.overrideWithValue(prefs),
      ],
    );
    // Initialize Background Sync
    try {
      await container.read(syncManagerProvider).initialize();
    } catch (e) {
      debugPrint('SyncManager initialization note: $e');
    }
    
    runApp(
      UncontrolledProviderScope(
        container: container,
        child: const QuillGradeApp(),
      ),
    );
  } catch (e, stack) {
    debugPrint('Fatal initialization error: $e');
    debugPrint('$stack');
    runApp(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Text(
                'Initialization Error:\n$e\n\nPlease restart the app.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.red, fontSize: 16),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class QuillGradeApp extends ConsumerWidget {
  const QuillGradeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    
    return MaterialApp.router(
      title: 'QuillGrade Enterprise',
      theme: AppTheme.lightTheme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
