import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/database/app_database.dart';
import '../../core/services/backend_connection.dart';
import '../../core/sync/grading_upload_mapper.dart';
import '../../core/sync/single_sample_upload_service.dart';

class SingleSampleUploadDialog extends ConsumerStatefulWidget {
  const SingleSampleUploadDialog({super.key});
  @override
  ConsumerState<SingleSampleUploadDialog> createState() =>
      _SingleSampleUploadDialogState();
}

class _SingleSampleUploadDialogState
    extends ConsumerState<SingleSampleUploadDialog> {
  List<Sample> _samples = [];
  Sample? _selected;
  bool _busy = true;
  String? _message;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _selected = null;
      _samples = [];
      _message = null;
    });
    try {
      final samples = await ref
          .read(singleSampleUploadProvider)
          .eligibleSamples();
      if (mounted) setState(() => _samples = samples);
    } on UploadValidationException catch (error) {
      if (mounted) setState(() => _message = error.message);
    } catch (_) {
      if (mounted) {
        setState(
          () => _message =
              'Could not read eligible local records. Nothing was uploaded.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _confirmUpload() async {
    final selected = _selected;
    if (_busy || selected == null) return;
    final baseUrl = ref.read(backendBaseUrlProvider);
    setState(() => _busy = true);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Upload exactly one record?'),
        content: Text(
          'Upload ${selected.sampleId}, revision ${selected.revision}, to the configured backend?\n\nOnly grading metadata will be sent. Photos stay on this device.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm one upload'),
          ),
        ],
      ),
    );
    if (!mounted) return;
    if (confirmed != true) {
      setState(() => _busy = false);
      return;
    }
    final result = await ref
        .read(singleSampleUploadProvider)
        .upload(selected, baseUrl: baseUrl, confirmed: true);
    if (!mounted) return;
    setState(() {
      _busy = false;
      _message = result.message;
      if (result.succeeded) {
        _samples.removeWhere((sample) => sample.id == selected.id);
        _selected = null;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!kDebugMode) return const SizedBox.shrink();
    return PopScope(
      canPop: !_busy,
      child: AlertDialog(
        title: const Text('Upload one sample (DEV)'),
        content: SizedBox(
          width: 440,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Only eligible, unsynced records owned by your current Firebase account appear. No background or bulk upload.',
                ),
                const SizedBox(height: 12),
                TextFormField(
                  initialValue: ref.read(backendBaseUrlProvider),
                  enabled: !_busy,
                  decoration: const InputDecoration(
                    labelText: 'Backend Base URL',
                    hintText: 'Same URL as auth-check',
                  ),
                  onChanged: ref.read(backendBaseUrlProvider.notifier).setUrl,
                ),
                const SizedBox(height: 12),
                if (_busy) const LinearProgressIndicator(),
                if (!_busy && _samples.isEmpty)
                  const Text(
                    'No eligible samples. Demo and other-account records are never reassigned.',
                  ),
                for (final sample in _samples)
                  ListTile(
                    selected: _selected?.id == sample.id,
                    leading: Icon(
                      _selected?.id == sample.id
                          ? Icons.radio_button_checked
                          : Icons.radio_button_unchecked,
                    ),
                    title: Text(sample.sampleId),
                    subtitle: Text(
                      '${sample.predictedGrade} • ${sample.modelVersion}\nRevision ${sample.revision} • ${sample.captureTimestamp.toLocal()}',
                    ),
                    onTap: _busy
                        ? null
                        : () => setState(() => _selected = sample),
                  ),
                if (_message != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(_message!),
                  ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: _busy ? null : () => Navigator.pop(context),
            child: const Text('Close'),
          ),
          TextButton(
            onPressed: _busy ? null : _load,
            child: const Text('Reload'),
          ),
          FilledButton(
            onPressed: _busy || _selected == null ? null : _confirmUpload,
            child: const Text('Review one upload'),
          ),
        ],
      ),
    );
  }
}
