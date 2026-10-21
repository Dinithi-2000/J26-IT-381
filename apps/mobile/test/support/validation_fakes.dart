import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/services.dart';
import 'package:quill_grade/core/ml/image_preprocessor.dart';
import 'package:quill_grade/core/services/cinnamon_validator_service.dart';
import 'package:tflite_flutter/tflite_flutter.dart';

const testLabels = ['valid_cinnamon', 'cinnamon_with_hand', 'other_objects'];
CinnamonValidationResult prediction(List<double> scores) =>
    CinnamonValidationResult.fromScores(testLabels, scores, 0.8);

class LabelBundle extends CachingAssetBundle {
  String content = '0 valid_cinnamon\n1 cinnamon_with_hand\n2 other_objects\n';
  @override
  Future<ByteData> load(String key) async =>
      ByteData.sublistView(Uint8List.fromList(content.codeUnits));
}

class FakeModel implements CinnamonModel {
  @override
  List<int> inputShape = [1, 224, 224, 3];
  @override
  List<int> outputShape = [1, 3];
  @override
  TensorType inputType = TensorType.float32;
  @override
  TensorType outputType = TensorType.float32;
  List<double> scores = [0.9, 0.05, 0.05];
  Object? error;
  int runs = 0;
  bool closed = false;
  PreprocessedImage? input;
  @override
  List<double> run(PreprocessedImage image) {
    runs++;
    input = image;
    if (error != null) throw error!;
    return scores;
  }

  @override
  void close() => closed = true;
}

class FakeValidator extends CinnamonValidatorService {
  CinnamonValidationResult result = prediction([0.9, 0.05, 0.05]);
  Completer<CinnamonValidationResult>? pending;
  Object? error;
  int calls = 0;
  final List<Uint8List> images = [];
  @override
  Future<CinnamonValidationResult> classify(Uint8List imageBytes) async {
    calls++;
    images.add(imageBytes);
    if (error != null) throw error!;
    return pending != null ? pending!.future : result;
  }
}

Future<Uint8List> testPng({
  int width = 3,
  int height = 2,
  ui.Color color = const ui.Color(0xFFFF0000),
}) async {
  final recorder = ui.PictureRecorder();
  final canvas = ui.Canvas(recorder);
  canvas.drawColor(color, ui.BlendMode.src);
  final picture = recorder.endRecording();
  final image = await picture.toImage(width, height);
  try {
    final data = (await image.toByteData(format: ui.ImageByteFormat.png))!;
    return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
  } finally {
    image.dispose();
    picture.dispose();
  }
}
