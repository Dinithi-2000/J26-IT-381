import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/sign_in_screen.dart';
import 'features/auth/sign_up_screen.dart';
import 'features/home/home_screen.dart';
import 'features/scan/scan_screen.dart';
import 'features/scan/result_screen.dart';
import 'features/history/history_screen.dart';
import 'features/sync_dashboard/sync_screen.dart';
import 'features/settings/settings_screen.dart';
import 'features/settings/grading_guide_screen.dart';
import 'shared/widgets/app_scaffold.dart';
import 'core/services/auth_service.dart';

import 'features/onboarding/onboarding_screen.dart';
import 'core/services/preferences_service.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);
  final hasCompletedOnboarding = ref.watch(onboardingCompleteProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      if (!hasCompletedOnboarding && state.matchedLocation != '/onboarding') {
        return '/onboarding';
      }

      final isLoggedIn = authState.value != null;
      final isLoggingIn = state.matchedLocation == '/login' || state.matchedLocation == '/signup' || state.matchedLocation == '/onboarding';

      if (!isLoggedIn && !isLoggingIn) return '/login';
      if (isLoggedIn && (state.matchedLocation == '/login' || state.matchedLocation == '/signup')) return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const SignInScreen(),
      ),
      GoRoute(
        path: '/signup',
        builder: (context, state) => const SignUpScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) {
          return AppScaffold(child: child);
        },
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const HomeScreen(),
          ),
          GoRoute(
            path: '/scan',
            builder: (context, state) => const ScanScreen(),
          ),
          GoRoute(
            path: '/result/:id',
            builder: (context, state) => ResultScreen(sampleId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/history',
            builder: (context, state) => const HistoryScreen(),
          ),
          GoRoute(
            path: '/sync',
            builder: (context, state) => const SyncScreen(),
          ),
          GoRoute(
            path: '/settings',
            builder: (context, state) => const SettingsScreen(),
          ),
          GoRoute(
            path: '/settings/grading-guide',
            builder: (context, state) => const GradingGuideScreen(),
          ),
        ],
      ),
    ],
  );
});
