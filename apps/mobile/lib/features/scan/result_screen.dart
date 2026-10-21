import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/database/repositories/sample_repository.dart';
import '../../core/ml/image_only_config.dart';
import '../../theme.dart';

class ResultScreen extends ConsumerWidget {
  final String sampleId;

  const ResultScreen({super.key, required this.sampleId});

  Color _getGradeColor(String? grade) {
    switch (grade?.toUpperCase()) {
      case 'ALBA':
        return AppTheme.albaColor;
      case 'C5 SPECIAL':
      case 'C5':
        return AppTheme.c5Color;
      case 'C4':
        return AppTheme.c4Color;
      case 'M5':
      case 'M4':
        return AppTheme.m5Color;
      default:
        return AppTheme.primaryGreen;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sampleRepo = ref.watch(sampleRepositoryProvider);

    return Scaffold(
      backgroundColor: AppTheme.canvasColor,
      appBar: AppBar(
        title: const Text('Scan Result'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.go('/'),
        ),
      ),
      body: FutureBuilder(
        future: sampleRepo.getSample(sampleId),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError || !snapshot.hasData) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Sample not found'),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => context.go('/'),
                    child: const Text('Return Home'),
                  ),
                ],
              ),
            );
          }

          final sample = snapshot.data!;
          final grade = sample.predictedGrade ?? 'Unavailable';
          final isHybrid = sample.modelVersion == 'hybrid_v2';
          final isImageOnly =
              sample.modelVersion == ImageOnlyConfig.modelVersion;
          final gradeColor = _getGradeColor(grade);
          final widthMm = sample.diameterMm ?? sample.crossSectionWidthMm;
          final heightMm = sample.crossSectionHeightMm;

          return ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            children: [
              // Clean Result Summary Card
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceColor,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.borderColor),
                ),
                child: Column(
                  children: [
                    Text(
                      sample.sampleId,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppTheme.secondaryText,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (isHybrid || isImageOnly)
                      Text(
                        isImageOnly
                            ? '4-Class Image-Only Prediction'
                            : 'Experimental Prediction',
                        style: const TextStyle(
                          color: AppTheme.primaryGreen,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    Text(
                      isImageOnly ? grade : grade.toUpperCase(),
                      style: TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.w800,
                        color: gradeColor,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: gradeColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        sample.modelProbability == null
                            ? 'Model probability unavailable'
                            : 'Model probability: ${(sample.modelProbability! * 100).toStringAsFixed(2)}%',
                        style: TextStyle(
                          color: gradeColor,
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Text(
                      isHybrid || isImageOnly
                          ? 'Prototype prediction from limited training samples. Model probability is not guaranteed correctness or certified grading. Review before use.'
                          : _getGradeDescription(grade),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppTheme.secondaryText,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Measurements
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceColor,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.borderColor),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Measurements',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.darkText,
                      ),
                    ),
                    if (isHybrid)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          sample.diameterSource == 'ai_estimated'
                              ? 'Experimental Estimate from end-view photo. No physical scale reference; not a calibrated measurement.'
                              : 'Manually measured with a digital caliper',
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.secondaryText,
                          ),
                        ),
                      ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Diameter',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.secondaryText,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                widthMm == null
                                    ? 'Not measured'
                                    : '${widthMm.toStringAsFixed(2)} mm',
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.darkText,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Height',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppTheme.secondaryText,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                heightMm == null
                                    ? 'Not measured'
                                    : '${heightMm.toStringAsFixed(2)} mm',
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.darkText,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),

              // Captured Perspectives Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceColor,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.borderColor),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: const [
                        Text(
                          'Captured Perspectives',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.darkText,
                          ),
                        ),
                        Text(
                          '2 of 2 Photos',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.primaryGreen,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppTheme.canvasColor,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppTheme.borderColor),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: const [
                                    Icon(
                                      Icons.check_circle,
                                      size: 16,
                                      color: AppTheme.primaryGreen,
                                    ),
                                    SizedBox(width: 6),
                                    Text(
                                      'Side View',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: AppTheme.darkText,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                const Text(
                                  'Bark Quality & TFLite Validated',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: AppTheme.secondaryText,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppTheme.canvasColor,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppTheme.borderColor),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: const [
                                    Icon(
                                      Icons.check_circle,
                                      size: 16,
                                      color: AppTheme.primaryGreen,
                                    ),
                                    SizedBox(width: 6),
                                    Text(
                                      'End Cut',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: AppTheme.darkText,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                const Text(
                                  'End view captured',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: AppTheme.secondaryText,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Action Buttons
              ElevatedButton(
                onPressed: () => context.go('/scan'),
                child: const Text('Scan Another Sample'),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () => context.go('/history'),
                child: const Text('View in History'),
              ),
            ],
          );
        },
      ),
    );
  }

  String _getGradeDescription(String grade) {
    switch (grade.toUpperCase()) {
      case 'ALBA':
        return 'Pencil-thin, golden quills with sweet aroma and high oil content.';
      case 'C5 SPECIAL':
        return 'Slender quill with smooth golden appearance and refined aroma.';
      case 'C4':
        return 'Standard commercial export grade with classic cinnamon aroma.';
      case 'M5':
        return 'Thicker coarse-grain bark with rugged texture.';
      default:
        return 'Standard Ceylon cinnamon specification.';
    }
  }
}
