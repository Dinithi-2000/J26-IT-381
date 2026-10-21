import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../theme.dart';

class AppScaffold extends StatelessWidget {
  final Widget child;

  const AppScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _calculateSelectedIndex(location);
    final isDesktop = MediaQuery.of(context).size.width > 600;

    Widget body = Scaffold(
      backgroundColor: AppTheme.canvasColor,
      body: child,
      extendBody: true,
      bottomNavigationBar: currentIndex > -1
          ? _buildBottomNav(context, currentIndex)
          : null,
    );

    if (!isDesktop) {
      return body;
    }

    // Clean, centered responsive container for desktop web
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: Center(
        child: Container(
          width: 480,
          decoration: BoxDecoration(
            color: AppTheme.canvasColor,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 20,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: body,
        ),
      ),
    );
  }

  Widget _buildBottomNav(BuildContext context, int currentIndex) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        boxShadow: AppTheme.navShadow,
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _NavItem(
                icon: Icons.home_outlined,
                activeIcon: Icons.home_rounded,
                label: 'Home',
                isActive: currentIndex == 0,
                onTap: () => context.go('/'),
              ),
              _NavItem(
                icon: Icons.history_outlined,
                activeIcon: Icons.history_rounded,
                label: 'History',
                isActive: currentIndex == 1,
                onTap: () => context.go('/history'),
              ),
              // ── Center FAB (Scan) ──
              _ScanFab(
                onTap: () => context.go('/scan'),
              ),
              _NavItem(
                icon: Icons.analytics_outlined,
                activeIcon: Icons.analytics_rounded,
                label: 'Analytics',
                isActive: currentIndex == 2,
                onTap: () => context.go('/sync'),
              ),
              _NavItem(
                icon: Icons.settings_outlined,
                activeIcon: Icons.settings_rounded,
                label: 'Settings',
                isActive: currentIndex == 3,
                onTap: () => context.go('/settings'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  int _calculateSelectedIndex(String location) {
    if (location == '/') return 0;
    if (location.startsWith('/history')) return 1;
    // scan goes through FAB, no index
    if (location.startsWith('/sync')) return 2;
    if (location.startsWith('/settings')) return 3;
    return -1;
  }
}

// ──────────────────────────────────────────────
//  Bottom Nav Item
// ──────────────────────────────────────────────
class _NavItem extends StatelessWidget {
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        width: 56,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Active top indicator
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 3,
              width: isActive ? 20 : 0,
              margin: const EdgeInsets.only(bottom: 4),
              decoration: BoxDecoration(
                color: AppTheme.green800,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Icon(
              isActive ? activeIcon : icon,
              size: 24,
              color: isActive ? AppTheme.green800 : AppTheme.tertiaryText,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
                color: isActive ? AppTheme.green800 : AppTheme.tertiaryText,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────
//  Floating Action Button (Center Scan Trigger)
// ──────────────────────────────────────────────
class _ScanFab extends StatelessWidget {
  final VoidCallback onTap;

  const _ScanFab({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 56,
        height: 56,
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          gradient: AppTheme.fabGradient,
          shape: BoxShape.circle,
          boxShadow: AppTheme.fabShadow,
        ),
        child: const Icon(
          Icons.center_focus_strong_rounded,
          color: Colors.white,
          size: 28,
        ),
      ),
    );
  }
}
