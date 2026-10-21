import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:quill_grade/core/services/image_only_service.dart';
import 'package:quill_grade/features/scan/capture_validation_controller.dart';

class TestImageOnly extends ImageOnlyService {
  int calls = 0;
  String? side;
  String? end;
  Object? error;
  Completer<ImageOnlyGradeResult>? pending;
  List<double> scores = [0.1, 0.2, 0.3, 0.4];

  @override
  Future<ImageOnlyGradeResult> analyzeSample({
    required String sideImage,
    required String endImage,
  }) async {
    calls++;
    side = sideImage;
    end = endImage;
    if (error != null) throw error!;
    return pending != null
        ? pending!.future
        : ImageOnlyGradeResult.fromOutput(scores);
  }
}

/// Actual files for the repository's photo checks, confined to a test directory.
class TestFilePhotos extends CapturePhotoStorage {
  final Directory directory;
  final Set<String> saved = {};
  int writes = 0;
  TestFilePhotos(this.directory);

  @override
  Future<String> save(Uint8List bytes, String prefix) async {
    final file = File('${directory.path}/$prefix-${++writes}.png');
    file.writeAsBytesSync(bytes);
    saved.add(file.path);
    return file.path;
  }

  @override
  Future<void> delete(String path) async {
    if (saved.remove(path)) File(path).deleteSync();
  }
}
