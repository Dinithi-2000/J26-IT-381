import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/ml/hybrid_config.dart';
import '../../core/ml/diameter_config.dart';
import '../../theme.dart';
import 'capture_validation_controller.dart';

enum HybridDialogAction { saved, retake, cancel }

Future<HybridDialogAction> showHybridGradingDialog(
  BuildContext context,
) async =>
    await showDialog<HybridDialogAction>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _HybridGradingDialog(),
    ) ??
    HybridDialogAction.cancel;

class _HybridGradingDialog extends ConsumerStatefulWidget {
  const _HybridGradingDialog();
  @override
  ConsumerState<_HybridGradingDialog> createState() =>
      _HybridGradingDialogState();
}

class _HybridGradingDialogState extends ConsumerState<_HybridGradingDialog> {
  final _form = GlobalKey<FormState>();
  final _diameter = TextEditingController();
  bool _manualMode = false;
  @override
  void dispose() {
    _diameter.dispose();
    super.dispose();
  }

  double? _value() =>
      double.tryParse(_diameter.text.trim().replaceAll(',', '.'));

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(captureValidationControllerProvider);
    final controller = ref.read(captureValidationControllerProvider.notifier);
    final busy = state.isProcessing;
    final result = state.gradeResult;
    final estimate = state.diameterEstimate;
    return PopScope(
      canPop: state.status != CaptureStatus.committing,
      child: AlertDialog(
        backgroundColor: AppTheme.surfaceColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Experimental Prediction'),
        content: SingleChildScrollView(
          child: Form(
            key: _form,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Review the experimental AI diameter estimate to predict a grade. An actual caliper measurement is optional.',
                ),
                TextButton(
                  key: const Key('estimateDiameter'),
                  onPressed: busy
                      ? null
                      : () async {
                          setState(() => _manualMode = false);
                          await controller.estimateDiameter();
                        },
                  child: const Text('Retry Diameter Estimate'),
                ),
                if (estimate != null) ...[
                  Text(
                    'Experimental Estimate: ${estimate.diameterMm.toStringAsFixed(2)} mm',
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryGreen,
                    ),
                  ),
                ],
                const Text(
                  'AI estimates have no physical scale reference and are not calibrated measurements. Distance, angle, lighting and phone hardware may change the result. Reported test MAE: 2.159 mm on only 16 held-out samples.',
                  style: TextStyle(fontSize: 12, color: AppTheme.secondaryText),
                ),
                if (!_manualMode) ...[
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: busy
                        ? null
                        : () {
                            controller.changeDiameter();
                            setState(() => _manualMode = true);
                          },
                    child: const Text('Enter Caliper Measurement Instead'),
                  ),
                ] else ...[
                  TextButton(
                    onPressed: busy
                        ? null
                        : () {
                            controller.changeDiameter();
                            setState(() => _manualMode = false);
                          },
                    child: const Text('Return to AI Estimate'),
                  ),
                ],
                const SizedBox(height: 12),
                if (_manualMode)
                  TextFormField(
                    key: const Key('caliperDiameter'),
                    controller: _diameter,
                    enabled: !busy,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'Digital caliper diameter',
                      suffixText: 'mm',
                    ),
                    validator: (_) => HybridConfig.diameterError(_value()),
                    onChanged: (_) => controller.changeDiameter(),
                  ),
                const SizedBox(height: 12),
                const Text(
                  'Prototype trained on limited samples. Model probability is not a guarantee of correctness or certified grading.',
                  style: TextStyle(fontSize: 12, color: AppTheme.secondaryText),
                ),
                if (busy)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        const CircularProgressIndicator(),
                        if (state.status == CaptureStatus.estimatingDiameter)
                          const Text(
                            'Estimating diameter from the end-view photo...',
                          ),
                      ],
                    ),
                  ),
                if (state.errorMessage != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      state.errorMessage!,
                      style: const TextStyle(color: AppTheme.errorColor),
                    ),
                  ),
                if (result != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    result.predictedGrade,
                    style: const TextStyle(
                      color: AppTheme.primaryGreen,
                      fontWeight: FontWeight.bold,
                      fontSize: 28,
                    ),
                  ),
                  Text(
                    'Model probability: ${(result.modelProbability * 100).toStringAsFixed(2)}%',
                  ),
                  Text(
                    '${state.diameterSource == DiameterSource.aiEstimated ? 'Experimental estimated diameter' : 'Caliper diameter'}: ${result.diameterMm.toStringAsFixed(2)} mm',
                  ),
                  const Text(
                    'Confirm to save this experimental result for review.',
                  ),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: state.status == CaptureStatus.committing
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
                    controller.retakeEndPhoto();
                    Navigator.pop(context, HybridDialogAction.retake);
                  },
            child: const Text('Retake End Photo'),
          ),
          if (result == null)
            ElevatedButton(
              onPressed: busy || (!_manualMode && estimate == null)
                  ? null
                  : () async {
                      if (!_manualMode) {
                        // No caliper form validation on the default AI path.
                        // The service has already denormalized this value to mm.
                        if (estimate == null) return;
                        await controller.gradeWithDiameter(
                          estimate.diameterMm,
                          source: DiameterSource.aiEstimated,
                        );
                      } else if (_form.currentState!.validate()) {
                        await controller.gradeWithDiameter(_value()!);
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryGreen,
              ),
              child: Text(_manualMode ? 'Predict Grade' : 'Use AI Estimate'),
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
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryGreen,
              ),
              child: const Text('Confirm & Save'),
            ),
        ],
      ),
    );
  }
}
