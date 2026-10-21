/// Contract for the bundled four-class, two-image model.
class ImageOnlyConfig {
  ImageOnlyConfig._();

  static const modelAsset =
      'assets/models/quillgrade_image_only_v1_fp32.tflite';
  static const modelVersion = 'image_only_4class_v1';
  static const classes = ['ALBA', 'C4', 'C5', 'Special'];
  static const sideInputName = 'serving_default_side_image:0';
  static const endInputName = 'serving_default_end_image:0';
  static const outputName = 'StatefulPartitionedCall_1:0';
  static const inputShape = [1, 224, 224, 3];
  static const outputShape = [1, 4];
}

class ImageOnlyException implements Exception {
  final String message;
  const ImageOnlyException(this.message);

  @override
  String toString() => message;
}
