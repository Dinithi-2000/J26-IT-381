import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/services/auth_service.dart';
import '../../theme.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authService = ref.read(authServiceProvider);
    final user = authService.currentUser;

    return Scaffold(
      backgroundColor: AppTheme.canvasColor,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── App Bar ──
            SliverToBoxAdapter(child: _buildAppBar(context)),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const SizedBox(height: 16),
                  _buildUserCard(user),
                  const SizedBox(height: 24),
                  _buildSection(
                    label: 'Hardware & Optics',
                    children: [
                      _buildSettingsItem(
                        icon: Icons.tune_rounded,
                        iconBg: AppTheme.primaryContainer,
                        iconColor: AppTheme.primaryGreen,
                        title: 'Optical Calibration',
                        statusWidget: _buildCalibrationStatus(),
                        onTap: () {},
                      ),
                      _buildDivider(),
                      _buildSettingsItem(
                        icon: Icons.camera_alt_rounded,
                        iconBg: AppTheme.primaryContainer,
                        iconColor: AppTheme.primaryGreen,
                        title: 'Camera Sensor & Exposure',
                        subtitle: 'Auto-calibrated for bark reflectance',
                        onTap: () {},
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _buildSection(
                    label: 'Standards & Compliance',
                    children: [
                      _buildSettingsItem(
                        icon: Icons.verified_rounded,
                        iconBg: AppTheme.cinnamonContainer,
                        iconColor: AppTheme.cinnamonAccent,
                        title: 'Grading Standard',
                        badgeWidget: _buildSlsBadge(),
                        onTap: () => context.go('/settings/grading-guide'),
                      ),
                      _buildDivider(),
                      _buildSettingsItem(
                        icon: Icons.precision_manufacturing_rounded,
                        iconBg: AppTheme.cinnamonContainer,
                        iconColor: AppTheme.cinnamonAccent,
                        title: 'Tolerance Threshold',
                        subtitle: '±0.1 mm precision',
                        onTap: () {},
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _buildSection(
                    label: 'System Preferences',
                    children: [
                      _buildSettingsItem(
                        icon: Icons.language_rounded,
                        iconBg: AppTheme.surfaceSubtle,
                        iconColor: AppTheme.secondaryText,
                        title: 'Language',
                        subtitle: 'English (US)',
                        trailingText: 'English (US)',
                        onTap: () {},
                      ),
                      _buildDivider(),
                      _buildSettingsItem(
                        icon: Icons.cloud_sync_rounded,
                        iconBg: AppTheme.surfaceSubtle,
                        iconColor: AppTheme.secondaryText,
                        title: 'Offline Storage & Cloud Sync',
                        subtitle: 'Auto-sync enabled (Wi-Fi/Cellular)',
                        onTap: () {},
                      ),
                    ],
                  ),
                  const SizedBox(height: 28),
                  _buildSignOutButton(context, authService),
                  const SizedBox(height: 16),
                  const Center(
                    child: Text(
                      'QuillGrade v2.4.1-sls • Build 2412',
                      style: TextStyle(
                        fontSize: 11,
                        color: AppTheme.tertiaryText,
                        letterSpacing: 0.02,
                      ),
                    ),
                  ),
                  const SizedBox(height: 100),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────
  //  App Bar
  // ──────────────────────────────────────────────
  Widget _buildAppBar(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        border: Border(
          bottom: BorderSide(
            color: AppTheme.borderColor.withValues(alpha: 0.5),
            width: 0.5,
          ),
        ),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            color: AppTheme.darkText,
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/');
              }
            },
          ),
          const Text(
            'Settings',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
              color: AppTheme.darkText,
            ),
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.green50,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.cloud_done_rounded,
                    size: 14, color: AppTheme.primaryGreen),
                const SizedBox(width: 4),
                const Text('Synced',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.green800)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────
  //  User Card
  // ──────────────────────────────────────────────
  Widget _buildUserCard(dynamic user) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        children: [
          // Top accent gradient
          Container(
            height: 4,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(2),
              gradient: const LinearGradient(
                colors: [AppTheme.green800, AppTheme.cinnamonAccent],
              ),
            ),
          ),
          Row(
            children: [
              // Avatar
              Stack(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      gradient: AppTheme.fabGradient,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.green900.withValues(alpha: 0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text(
                        'DI',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: 1,
                    right: 1,
                    child: Container(
                      width: 12,
                      height: 12,
                      decoration: BoxDecoration(
                        color: AppTheme.successColor,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: AppTheme.surfaceColor, width: 2.5),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user?.displayName ?? 'Demo Inspector',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.darkText,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      user?.email ?? 'demo@quillgrade.com',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppTheme.secondaryText,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryContainer,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: const [
                          Icon(Icons.verified_rounded,
                              size: 12, color: AppTheme.primaryGreen),
                          SizedBox(width: 4),
                          Flexible(
                            child: Text(
                              'Lead Field Assessor • Matara Hub',
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.green800,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────
  //  Grouped Settings Section
  // ──────────────────────────────────────────────
  Widget _buildSection(
      {required String label, required List<Widget> children}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: AppTheme.tertiaryText,
              letterSpacing: 0.6,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppTheme.surfaceColor,
            borderRadius: BorderRadius.circular(16),
            boxShadow: AppTheme.cardShadow,
          ),
          child: Column(children: children),
        ),
      ],
    );
  }

  Widget _buildSettingsItem({
    required IconData icon,
    required Color iconBg,
    required Color iconColor,
    required String title,
    String? subtitle,
    Widget? statusWidget,
    Widget? badgeWidget,
    String? trailingText,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              // Icon
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 20, color: iconColor),
              ),
              const SizedBox(width: 14),
              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.darkText,
                        letterSpacing: -0.1,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 1),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.secondaryText,
                        ),
                      ),
                    ],
                    if (statusWidget != null) ...[
                      const SizedBox(height: 3),
                      statusWidget,
                    ],
                    if (badgeWidget != null) ...[
                      const SizedBox(height: 4),
                      badgeWidget,
                    ],
                  ],
                ),
              ),
              // Trailing
              if (trailingText != null) ...[
                Text(
                  trailingText,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.secondaryText,
                  ),
                ),
                const SizedBox(width: 2),
              ],
              const Icon(Icons.chevron_right_rounded,
                  size: 18, color: AppTheme.tertiaryText),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Container(
      height: 1,
      margin: const EdgeInsets.only(left: 66),
      color: AppTheme.surfaceSubtle,
    );
  }

  // ──────────────────────────────────────────────
  //  Status Widgets
  // ──────────────────────────────────────────────
  Widget _buildCalibrationStatus() {
    return Row(
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: AppTheme.successColor,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: AppTheme.successColor.withValues(alpha: 0.4),
                blurRadius: 6,
              ),
            ],
          ),
        ),
        const SizedBox(width: 5),
        const Flexible(
          child: Text(
            'Calibrated (12mm reference marker • Valid for 5 days)',
            style: TextStyle(fontSize: 11, color: AppTheme.secondaryText),
          ),
        ),
      ],
    );
  }

  Widget _buildSlsBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: AppTheme.cinnamonContainer,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: const [
          Icon(Icons.shield_rounded, size: 11, color: AppTheme.amber700),
          SizedBox(width: 4),
          Text(
            'SLS 81:2022 Certified',
            style: TextStyle(
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
              color: AppTheme.amber700,
              letterSpacing: 0.02,
            ),
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────
  //  Sign Out
  // ──────────────────────────────────────────────
  Widget _buildSignOutButton(BuildContext context, dynamic authService) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.errorBg, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 2,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Sign out?'),
                content:
                    const Text('Are you sure you want to sign out?'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Cancel'),
                  ),
                  TextButton(
                    onPressed: () async {
                      Navigator.pop(ctx);
                      await authService.signOut();
                      if (context.mounted) {
                        context.go('/login');
                      }
                    },
                    child: const Text('Sign Out',
                        style: TextStyle(color: AppTheme.errorColor)),
                  ),
                ],
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                Icon(Icons.logout_rounded,
                    size: 18, color: AppTheme.errorColor),
                SizedBox(width: 8),
                Text(
                  'Sign Out',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.errorColor,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
