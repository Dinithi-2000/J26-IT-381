import 'package:flutter/material.dart';

import '../../core/services/cinnamon_validator_service.dart';
import '../../theme.dart';

enum ValidationDialogAction { retry, retake, cancel }

Future<ValidationDialogAction> showCaptureValidationDialog(
  BuildContext context,
  CinnamonValidationResult result,
) async {
  final modelError = result.status == CinnamonValidationStatus.modelError;
  return await showDialog<ValidationDialogAction>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          backgroundColor: AppTheme.surfaceColor,
          title: Row(
            children: [
              Icon(
                modelError ? Icons.error_outline : Icons.block_outlined,
                color: AppTheme.errorColor,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  modelError
                      ? 'Validation Unavailable'
                      : result.status == CinnamonValidationStatus.uncertain
                      ? 'Unable to Confirm Cinnamon'
                      : 'Invalid Item Detected',
                  style: const TextStyle(
                    color: AppTheme.darkText,
                    fontWeight: FontWeight.w700,
                    fontSize: 17,
                  ),
                ),
              ),
            ],
          ),
          content: Text(
            result.rejectionReason ?? '',
            style: const TextStyle(color: AppTheme.secondaryText, height: 1.45),
          ),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          actions: [
            TextButton(
              onPressed: () =>
                  Navigator.of(dialogContext)
                      .pop(ValidationDialogAction.cancel),
              style: TextButton.styleFrom(
                foregroundColor: AppTheme.secondaryText,
              ),
              child: const Text('Cancel'),
            ),
            if (modelError)
              TextButton(
                onPressed: () =>
                    Navigator.of(dialogContext)
                        .pop(ValidationDialogAction.retake),
                child: const Text('Retake Photo'),
              ),
            ElevatedButton(
              onPressed: () => Navigator.of(dialogContext).pop(
                modelError
                    ? ValidationDialogAction.retry
                    : ValidationDialogAction.retake,
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primaryGreen,
              ),
              child: Text(modelError ? 'Retry Validation' : 'Try Again'),
            ),
          ],
        ),
      ) ??
      ValidationDialogAction.cancel;
}
