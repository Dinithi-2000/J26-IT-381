import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'dart:math' as math;

import '../../theme.dart';
import '../../core/services/auth_service.dart';
import '../../core/database/repositories/sample_repository.dart';
import '../../core/database/app_database.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen>
    with SingleTickerProviderStateMixin {
  int _selectedMode = 0; // 0=Bark, 1=Caliper
  late AnimationController _gaugeController;

  @override
  void initState() {
    super.initState();
    _gaugeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..forward();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = ref.read(authServiceProvider).currentUser;
      final userId = user?.uid ?? 'demo-user-1';
      ref.read(sampleRepositoryProvider).seedInitialDemoData(userId);
    });
  }

  @override
  void dispose() {
    _gaugeController.dispose();
    super.dispose();
  }

  Color _getGradePillBg(String? grade) {
    switch (grade?.toUpperCase()) {
      case 'ALBA':
        return AppTheme.albaBg;
      case 'C5 SPECIAL':
      case 'C5':
        return AppTheme.c5Bg;
      default:
        return AppTheme.commercialBg;
    }
  }

  Color _getGradePillText(String? grade) {
    switch (grade?.toUpperCase()) {
      case 'ALBA':
        return AppTheme.albaColor;
      case 'C5 SPECIAL':
      case 'C5':
        return AppTheme.c5Color;
      default:
        return AppTheme.commercialColor;
    }
  }

  @override
  Widget build(BuildContext context) {
    final sampleRepo = ref.watch(sampleRepositoryProvider);

    return Scaffold(
      backgroundColor: AppTheme.canvasColor,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── Top App Bar ──
            SliverToBoxAdapter(child: _buildAppBar()),
            // ── Body Content ──
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  const SizedBox(height: 12),
                  _buildHeroCard(),
                  const SizedBox(height: 16),
                  _buildMetricsGrid(),
                  const SizedBox(height: 16),
                  _buildQuickActions(),
                  const SizedBox(height: 20),
                  _buildSectionHeader(),
                  const SizedBox(height: 10),
                ]),
              ),
            ),
            // ── Recent Scans Feed ──
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: _buildScansFeed(sampleRepo),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────
  //  Top App Bar
  // ──────────────────────────────────────────────
  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 8, 16, 12),
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
          // Brand
          Icon(Icons.eco_rounded, color: AppTheme.green800, size: 24),
          const SizedBox(width: 8),
          const Text(
            'QuillGrade',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              color: AppTheme.green900,
            ),
          ),
          const Spacer(),
          // Sync Status Pill
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: AppTheme.green50,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.cloud_done_rounded,
                  size: 14,
                  color: AppTheme.primaryGreen,
                ),
                const SizedBox(width: 5),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Text(
                      'Synced',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.green800,
                      ),
                    ),
                    Text(
                      'Just Now',
                      style: TextStyle(
                        fontSize: 9,
                        color: AppTheme.primaryGreen,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          // Battery
          Icon(
            Icons.battery_std_rounded,
            size: 18,
            color: AppTheme.tertiaryText,
          ),
          const SizedBox(width: 4),
          // Alert Bell
          Stack(
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_none_rounded, size: 22),
                color: AppTheme.secondaryText,
                onPressed: () {},
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
              ),
              Positioned(
                top: 6,
                right: 7,
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: BoxDecoration(
                    color: AppTheme.errorColor,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppTheme.surfaceColor,
                      width: 1.5,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ──────────────────────────────────────────────
  //  Hero Card (Dark Forest Green Gradient)
  // ──────────────────────────────────────────────
  Widget _buildHeroCard() {
    return Container(
      decoration: BoxDecoration(
        gradient: AppTheme.heroGradient,
        borderRadius: BorderRadius.circular(20),
        boxShadow: AppTheme.elevatedShadow,
      ),
      child: Stack(
        children: [
          // Reticle overlay graphic
          Positioned(
            right: -20,
            top: -20,
            bottom: -20,
            child: Opacity(
              opacity: 0.12,
              child: SizedBox(
                width: 200,
                child: CustomPaint(painter: _ReticlePainter()),
              ),
            ),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    // Icon wrap
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.1),
                        ),
                      ),
                      child: const Icon(
                        Icons.center_focus_strong_rounded,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'New Inspection Scan',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                              letterSpacing: -0.3,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Bark view & cross-section analysis',
                            style: TextStyle(
                              fontSize: 12.5,
                              color: Colors.white60,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                // Mode Toggle: [Bark | Caliper]
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(30),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.06),
                    ),
                  ),
                  child: Row(
                    children: [
                      _modeButton('Bark', Icons.layers_rounded, 0),
                      _modeButton('Caliper', Icons.straighten_rounded, 1),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                // Start Scan Button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => context.go('/scan'),
                    icon: const Icon(Icons.camera_alt_rounded, size: 20),
                    label: const Text(
                      'Start Optical Scan',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppTheme.green900,
                      elevation: 2,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _modeButton(String label, IconData icon, int index) {
    final isActive = _selectedMode == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedMode = index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isActive ? Colors.white : Colors.transparent,
            borderRadius: BorderRadius.circular(30),
            boxShadow: isActive
                ? [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.15),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: isActive ? AppTheme.green900 : Colors.white54,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: isActive ? AppTheme.green900 : Colors.white54,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────
  //  Metrics Grid (2 columns)
  // ──────────────────────────────────────────────
  Widget _buildMetricsGrid() {
    return Row(
      children: [
        Expanded(child: _buildScansCard()),
        const SizedBox(width: 12),
        Expanded(child: _buildRatioCard()),
      ],
    );
  }

  Widget _buildScansCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Scans Today',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.secondaryText,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.primaryContainer,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(
                      Icons.trending_up_rounded,
                      size: 12,
                      color: AppTheme.green800,
                    ),
                    SizedBox(width: 2),
                    Text(
                      '+12%',
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.green800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Text(
                '28',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.darkText,
                  letterSpacing: -1,
                  height: 1,
                ),
              ),
              const Spacer(),
              // Mini sparkline
              SizedBox(
                width: 70,
                height: 28,
                child: CustomPaint(painter: _SparklinePainter()),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'vs yesterday',
            style: TextStyle(fontSize: 10, color: AppTheme.tertiaryText),
          ),
        ],
      ),
    );
  }

  Widget _buildRatioCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(16),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Column(
        children: [
          const Align(
            alignment: Alignment.centerLeft,
            child: Text(
              'Alba & C5 Ratio',
              style: TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
                color: AppTheme.secondaryText,
              ),
            ),
          ),
          const SizedBox(height: 8),
          // Circular Gauge
          AnimatedBuilder(
            animation: _gaugeController,
            builder: (context, _) {
              return SizedBox(
                width: 72,
                height: 72,
                child: CustomPaint(
                  painter: _GaugePainter(
                    progress: _gaugeController.value * 0.914,
                  ),
                  child: const Center(
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: '91.4',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.darkText,
                              letterSpacing: -0.5,
                            ),
                          ),
                          TextSpan(
                            text: '%',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.secondaryText,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 4,
            runSpacing: 4,
            alignment: WrapAlignment.center,
            children: [
              _gradeTag('Alba 68%', AppTheme.albaBg, AppTheme.amber700),
              _gradeTag('C5 23%', AppTheme.c5Bg, AppTheme.emerald700),
              _gradeTag(
                'Other 9%',
                AppTheme.commercialBg,
                AppTheme.secondaryText,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _gradeTag(String text, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: fg),
      ),
    );
  }

  // ──────────────────────────────────────────────
  //  Quick Actions
  // ──────────────────────────────────────────────
  Widget _buildQuickActions() {
    return Row(
      children: [
        Expanded(
          child: _pillButton(
            icon: Icons.menu_book_rounded,
            label: 'Grading Guide (SLS 81)',
            onTap: () => context.go('/settings/grading-guide'),
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _pillButton(
            icon: Icons.tune_rounded,
            label: 'Calibration Logs',
            onTap: () {},
          ),
        ),
      ],
    );
  }

  Widget _pillButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Material(
      color: AppTheme.surfaceColor,
      borderRadius: BorderRadius.circular(30),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(30),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(30),
            border: Border.all(color: AppTheme.borderColor, width: 1.5),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: AppTheme.primaryGreen),
              const SizedBox(width: 6),
              Flexible(
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.darkText,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ──────────────────────────────────────────────
  //  Section Header
  // ──────────────────────────────────────────────
  Widget _buildSectionHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          'Recent Scans',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppTheme.darkText,
            letterSpacing: -0.3,
          ),
        ),
        GestureDetector(
          onTap: () => context.go('/history'),
          child: const Text(
            'View All',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppTheme.primaryGreen,
            ),
          ),
        ),
      ],
    );
  }

  // ──────────────────────────────────────────────
  //  Recent Scans Feed
  // ──────────────────────────────────────────────
  SliverList _buildScansFeed(SampleRepository sampleRepo) {
    return SliverList(
      delegate: SliverChildListDelegate([
        StreamBuilder<List<Sample>>(
          stream: sampleRepo.watchAllSamples(),
          builder: (context, snapshot) {
            if (!snapshot.hasData || snapshot.data!.isEmpty) {
              return Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceColor,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: AppTheme.cardShadow,
                ),
                child: const Center(
                  child: Text(
                    'No scans yet. Tap "Start Scan" above.',
                    style: TextStyle(
                      color: AppTheme.secondaryText,
                      fontSize: 13,
                    ),
                  ),
                ),
              );
            }

            final samples = snapshot.data!.take(4).toList();
            return Column(
              children: samples.asMap().entries.map((entry) {
                final index = entry.key;
                final sample = entry.value;
                return _buildScanItem(sample, index);
              }).toList(),
            );
          },
        ),
      ]),
    );
  }

  Widget _buildScanItem(Sample sample, int index) {
    final grade = sample.predictedGrade ?? 'Graded';
    final pillBg = _getGradePillBg(grade);
    final pillFg = _getGradePillText(grade);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(12),
        boxShadow: AppTheme.cardShadow,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => context.go('/result/${sample.id}'),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                // Thumbnail placeholder
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceSubtle,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Center(
                    child: Icon(
                      Icons.circle_outlined,
                      size: 24,
                      color: AppTheme.cinnamonAccent.withValues(alpha: 0.4),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            sample.sampleId,
                            style: const TextStyle(
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.darkText,
                              letterSpacing: -0.2,
                            ),
                          ),
                          Text(
                            '${index * 12 + 2} min ago',
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppTheme.tertiaryText,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Text(
                            'Ø ${(sample.diameterMm ?? sample.crossSectionWidthMm)?.toStringAsFixed(2) ?? '?'} mm',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.secondaryText,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: pillBg,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              grade,
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                color: pillFg,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: AppTheme.tertiaryText,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────
//  Custom Painters
// ──────────────────────────────────────────────

class _ReticlePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    canvas.drawCircle(center, 60, paint..strokeWidth = 1.5);
    canvas.drawCircle(center, 40, paint..strokeWidth = 1);
    canvas.drawCircle(center, 20, paint..strokeWidth = 1);

    // Crosshair
    paint.strokeWidth = 0.75;
    canvas.drawLine(
      Offset(center.dx, center.dy - 70),
      Offset(center.dx, center.dy + 70),
      paint,
    );
    canvas.drawLine(
      Offset(center.dx - 70, center.dy),
      Offset(center.dx + 70, center.dy),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _SparklinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final points = [
      Offset(0, size.height * 0.87),
      Offset(size.width * 0.12, size.height * 0.69),
      Offset(size.width * 0.25, size.height * 0.75),
      Offset(size.width * 0.37, size.height * 0.56),
      Offset(size.width * 0.5, size.height * 0.62),
      Offset(size.width * 0.62, size.height * 0.44),
      Offset(size.width * 0.75, size.height * 0.31),
      Offset(size.width * 0.87, size.height * 0.19),
      Offset(size.width, size.height * 0.12),
    ];

    // Fill area
    final fillPath = Path()..moveTo(points.first.dx, points.first.dy);
    for (final p in points.skip(1)) {
      fillPath.lineTo(p.dx, p.dy);
    }
    fillPath.lineTo(size.width, size.height);
    fillPath.lineTo(0, size.height);
    fillPath.close();

    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          AppTheme.green800.withValues(alpha: 0.15),
          AppTheme.green800.withValues(alpha: 0.0),
        ],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));
    canvas.drawPath(fillPath, fillPaint);

    // Line
    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (final p in points.skip(1)) {
      linePath.lineTo(p.dx, p.dy);
    }

    final linePaint = Paint()
      ..color = AppTheme.green800
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(linePath, linePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _GaugePainter extends CustomPainter {
  final double progress;
  _GaugePainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 6;

    // Background track
    final bgPaint = Paint()
      ..color = const Color(0xFFE5E7EB)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6;
    canvas.drawCircle(center, radius, bgPaint);

    // Progress arc
    final fgPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 6
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        startAngle: -math.pi / 2,
        endAngle: 3 * math.pi / 2,
        colors: const [AppTheme.green800, AppTheme.cinnamonAccent],
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi * progress,
      false,
      fgPaint,
    );
  }

  @override
  bool shouldRepaint(_GaugePainter old) => old.progress != progress;
}
