import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/ml/image_only_config.dart';
import 'capture_validation_controller.dart';
import 'hybrid_grading_dialog.dart' show HybridDialogAction;

Future<HybridDialogAction> showImageOnlyGradingDialog(
  BuildContext context,
) async =>
    await showDialog<HybridDialogAction>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _ImageOnlyGradingDialog(),
    ) ??
    HybridDialogAction.cancel;

class _ImageOnlyGradingDialog extends ConsumerWidget {
  const _ImageOnlyGradingDialog();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(captureValidationControllerProvider);
    final controller = ref.read(captureValidationControllerProvider.notifier);
    final result = state.imageOnlyResult;
    final busy = state.isProcessing;
    final committing = state.status == CaptureStatus.committing;
    return PopScope(
      canPop: !committing,
      child: AlertDialog(
        title: const Text('4-Class Image-Only Prediction'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Grades both validated photos. No diameter measurement is required.',
              ),
              if (busy) ...[
                const SizedBox(height: 16),
                const Center(child: CircularProgressIndicator()),
                Text(
                  committing
                      ? 'Saving offline...'
                      : 'Running 4-Class prediction...',
                ),
              ],
              if (state.errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    state.errorMessage!,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              if (result != null) ...[
                const SizedBox(height: 16),
                Text(
                  result.predictedGrade,
                  key: const Key('imageOnlyGrade'),
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                Text(
                  'Confidence: ${(result.confidence * 100).toStringAsFixed(2)}%',
                ),
                const SizedBox(height: 12),
                const Text('Class probabilities'),
                for (final label in ImageOnlyConfig.classes)
                  Text(
                    '$label: ${(result.probabilities[label]! * 100).toStringAsFixed(2)}%',
                    key: Key('imageOnlyProbability$label'),
                  ),
                const SizedBox(height: 12),
                const Text(
                  'Model probabilities are not a guarantee of correctness. Confirm to save this prediction for review.',
                ),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: committing
                ? null
                : () {
                    controller.resetAll();
                    Navigator.pop(context, HybridDialogAction.cancel);
                  },
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: busy
                ? null
                : () {
                    controller.retakeSidePhoto();
                    Navigator.pop(context, HybridDialogAction.retake);
                  },
            child: const Text('Retake Both Photos'),
          ),
          TextButton(
            onPressed: busy
                ? null
                : () {
                    controller.retakeEndPhoto();
                    Navigator.pop(context, HybridDialogAction.retake);
                  },
            child: const Text('Retake End Photo'),
          ),
          if (result == null)
            ElevatedButton(
              onPressed: busy ? null : controller.gradeImageOnly,
              child: const Text('Retry 4-Class Prediction'),
            )
          else
            ElevatedButton(
              onPressed: busy
                  ? null
                  : () async {
                      final saved = await controller.confirmPrediction();
                      if (context.mounted && saved) {
                        Navigator.pop(context, HybridDialogAction.saved);
                      }
                    },
              child: const Text('Confirm & Save'),
            ),
        ],
      ),
    );
  }
}
