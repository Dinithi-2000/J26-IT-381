import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'validation_dialog.dart';
import 'hybrid_grading_dialog.dart';
import '../../theme.dart';
import 'capture_validation_controller.dart';

class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});

  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  bool _cameraInitialized = false;

  bool _handlingCapture = false;

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      _cameras = await availableCameras();
      if (!mounted) return;
      if (_cameras.isNotEmpty) {
        _controller = CameraController(
          _cameras[0],
          ResolutionPreset.high,
          enableAudio: false,
        );
        await _controller!.initialize();
        if (!mounted) return;
        setState(() => _cameraInitialized = true);
      }
    } catch (e) {
      debugPrint("Camera initialization note: $e");
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _handleCapture() async {
    if (_handlingCapture) return;
    _handlingCapture = true;
    final notifier = ref.read(captureValidationControllerProvider.notifier);
    try {
      var retry = false;
      while (mounted) {
        final succeeded = retry
            ? await notifier.retryValidation()
            : await notifier.processCapture(_controller);
        if (!mounted) return;
        final state = ref.read(captureValidationControllerProvider);
        if (succeeded) {
          if (state.status == CaptureStatus.awaitingMeasurement ||
              state.status == CaptureStatus.estimatingDiameter) {
            final action = await showHybridGradingDialog(context);
            if (!mounted) return;
            if (action == HybridDialogAction.saved) {
              final sampleId = ref
                  .read(captureValidationControllerProvider)
                  .sampleId;
              if (sampleId != null) context.go('/result/$sampleId');
            } else if (action == HybridDialogAction.cancel) {
              notifier.resetAll();
              context.go('/');
            }
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: const Text(
                  'Side view verified! Now capture the end view cut.',
                ),
                backgroundColor: AppTheme.primaryGreen,
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            );
          }
          return;
        }
        if (state.status == CaptureStatus.invalid ||
            state.status == CaptureStatus.uncertain ||
            state.status == CaptureStatus.modelError) {
          final action = await showCaptureValidationDialog(
            context,
            state.validationResult!,
          );
          if (!mounted) return;
          switch (action) {
            case ValidationDialogAction.retry:
              retry = true;
              continue;
            case ValidationDialogAction.retake:
              notifier.resetToReady();
              return;
            case ValidationDialogAction.cancel:
              notifier.resetAll();
              context.go('/');
              return;
          }
        }
        if (state.status == CaptureStatus.error) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Capture error: ${state.errorMessage ?? "Unknown"}',
              ),
              backgroundColor: AppTheme.errorColor,
            ),
          );
          notifier.resetToReady();
        }
        return;
      }
    } finally {
      _handlingCapture = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final captureState = ref.watch(captureValidationControllerProvider);
    final isProcessing = captureState.isProcessing;
    final isStep2 = captureState.currentStep == ScanStep.endView;
    final isSimulator =
        !_cameraInitialized ||
        _controller == null ||
        !_controller!.value.isInitialized;

    return PopScope(
      canPop: captureState.status != CaptureStatus.committing,
      child: Scaffold(
        backgroundColor: const Color(0xFF18181B),
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.white,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back, color: Colors.white),
            onPressed: captureState.status == CaptureStatus.committing
                ? null
                : () {
                    if (isStep2 && !isProcessing) {
                      ref
                          .read(captureValidationControllerProvider.notifier)
                          .retakeSidePhoto();
                    } else {
                      ref
                          .read(captureValidationControllerProvider.notifier)
                          .resetAll();
                      context.go('/');
                    }
                  },
          ),
          title: Text(
            isStep2 ? 'Step 2 of 2: End View Cut' : 'Step 1 of 2: Side View',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
          centerTitle: true,
          actions: [
            if (isStep2)
              TextButton.icon(
                onPressed: isProcessing
                    ? null
                    : () {
                        ref
                            .read(captureValidationControllerProvider.notifier)
                            .retakeSidePhoto();
                      },
                icon: const Icon(
                  Icons.refresh,
                  color: Colors.white70,
                  size: 16,
                ),
                label: const Text(
                  'Retake Side',
                  style: TextStyle(color: Colors.white70, fontSize: 12),
                ),
              ),
          ],
        ),
        extendBodyBehindAppBar: true,
        body: Stack(
          children: [
            // Live Camera Preview or Clean Minimal Simulator Viewport
            Positioned.fill(
              child: !isSimulator
                  ? CameraPreview(_controller!)
                  : _buildCleanSimulator(isStep2),
            ),

            // Clean Guideline Overlay adapted to current step
            Positioned.fill(
              child: CustomPaint(
                painter: _GuidelinePainter(step: captureState.currentStep),
              ),
            ),

            // Step & Guidance Pill
            Positioned(
              top: 96,
              left: 20,
              right: 20,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.18),
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _StepBadge(
                          stepNumber: 1,
                          label: 'Side Photo',
                          isActive: !isStep2,
                          isCompleted: isStep2,
                        ),
                        Container(
                          width: 32,
                          height: 2,
                          color: isStep2
                              ? AppTheme.primaryGreen
                              : Colors.white24,
                          margin: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                        _StepBadge(
                          stepNumber: 2,
                          label: 'End Cut',
                          isActive: isStep2,
                          isCompleted: false,
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      isProcessing
                          ? 'Validating and processing cinnamon photo...'
                          : (isStep2
                                ? 'Align quill cut end inside the circular reticle'
                                : 'Align cinnamon quill horizontally inside the bounding frame'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Bottom Shutter Controls
            Positioned(
              bottom: 36,
              left: 0,
              right: 0,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  GestureDetector(
                    onTap:
                        isProcessing ||
                            isSimulator ||
                            captureState.status != CaptureStatus.idle
                        ? null
                        : _handleCapture,
                    child: Container(
                      width: 78,
                      height: 78,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                      ),
                      child: Center(
                        child: Container(
                          width: 64,
                          height: 64,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isProcessing
                                ? Colors.grey[700]
                                : AppTheme.primaryGreen,
                          ),
                          child: Center(
                            child: isProcessing
                                ? const SizedBox(
                                    width: 24,
                                    height: 24,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2.5,
                                    ),
                                  )
                                : Icon(
                                    isStep2 ? Icons.lens : Icons.camera_alt,
                                    color: Colors.white,
                                    size: 28,
                                  ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    isStep2
                        ? 'Tap to Capture End Cross-Section'
                        : 'Tap to Capture Side View',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCleanSimulator(bool isStep2) {
    return Container(
      color: const Color(0xFF18181B),
      child: Center(
        child: isStep2
            ? Container(
                width: 170,
                height: 170,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.05),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.2),
                  ),
                ),
                child: const Center(
                  child: Text(
                    'Camera unavailable\nPlease enable camera access.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              )
            : Container(
                width: 280,
                height: 100,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.05),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.2),
                  ),
                ),
                child: const Center(
                  child: Text(
                    'Camera unavailable\nPlease enable camera access.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}

class _StepBadge extends StatelessWidget {
  final int stepNumber;
  final String label;
  final bool isActive;
  final bool isCompleted;

  const _StepBadge({
    required this.stepNumber,
    required this.label,
    required this.isActive,
    required this.isCompleted,
  });

  @override
  Widget build(BuildContext context) {
    final bgColor = isCompleted
        ? AppTheme.primaryGreen
        : (isActive ? AppTheme.primaryGreen : Colors.white12);
    final textColor = isCompleted || isActive ? Colors.white : Colors.white60;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(color: bgColor, shape: BoxShape.circle),
          child: Center(
            child: isCompleted
                ? const Icon(Icons.check, size: 13, color: Colors.white)
                : Text(
                    '$stepNumber',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            color: textColor,
            fontSize: 12,
            fontWeight: isActive || isCompleted
                ? FontWeight.w600
                : FontWeight.w400,
          ),
        ),
      ],
    );
  }
}

class _GuidelinePainter extends CustomPainter {
  final ScanStep step;

  _GuidelinePainter({required this.step});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.6)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0;

    final center = Offset(size.width / 2, size.height / 2);

    if (step == ScanStep.sideView) {
      // Step 1: Horizontal rectangular frame
      final rect = Rect.fromCenter(
        center: center,
        width: size.width * 0.85,
        height: 115,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, const Radius.circular(14)),
        paint,
      );
    } else {
      // Step 2: Circular cross-section reticle
      final radius = size.width * 0.28;
      canvas.drawCircle(center, radius, paint);

      final innerPaint = Paint()
        ..color = Colors.white.withValues(alpha: 0.3)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.0;
      canvas.drawCircle(center, radius * 0.55, innerPaint);

      // Measurement crosshair marks
      final tickPaint = Paint()
        ..color = Colors.white.withValues(alpha: 0.6)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5;
      canvas.drawLine(
        Offset(center.dx - radius - 12, center.dy),
        Offset(center.dx - radius + 8, center.dy),
        tickPaint,
      );
      canvas.drawLine(
        Offset(center.dx + radius - 8, center.dy),
        Offset(center.dx + radius + 12, center.dy),
        tickPaint,
      );
      canvas.drawLine(
        Offset(center.dx, center.dy - radius - 12),
        Offset(center.dx, center.dy - radius + 8),
        tickPaint,
      );
      canvas.drawLine(
        Offset(center.dx, center.dy + radius - 8),
        Offset(center.dx, center.dy + radius + 12),
        tickPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _GuidelinePainter oldDelegate) =>
      oldDelegate.step != step;
}
