import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Shared by the auth diagnostic and the explicit single-record upload.
/// An address entered in either dialog is retained for this app session.
final backendBaseUrlProvider = NotifierProvider<BackendBaseUrl, String>(
  BackendBaseUrl.new,
);

class BackendBaseUrl extends Notifier<String> {
  @override
  String build() => const String.fromEnvironment('BACKEND_BASE_URL');

  void setUrl(String value) => state = value;
}

Uri backendEndpoint(
  String baseUrl,
  String path, {
  bool adbReverseConfigured = const bool.fromEnvironment('BACKEND_ADB_REVERSE'),
}) {
  final cleanUrl = baseUrl.trim().replaceAll(RegExp(r'/+$'), '');
  final base = Uri.parse(cleanUrl);
  final host = base.host.toLowerCase().replaceAll(RegExp(r'\.$'), '');
  final loopback =
      host == 'localhost' ||
      host.endsWith('.localhost') ||
      host.startsWith('127.') ||
      host == '::1' ||
      host == '[::1]' ||
      host == '0.0.0.0' ||
      host.contains('::ffff:127.');
  if (!['http', 'https'].contains(base.scheme) ||
      base.host.isEmpty ||
      base.userInfo.isNotEmpty ||
      base.hasQuery ||
      base.hasFragment ||
      (base.path.isNotEmpty && base.path != '/') ||
      (loopback && !adbReverseConfigured)) {
    throw const FormatException(
      'Use a backend origin; loopback requires ADB reverse.',
    );
  }
  return base.replace(path: path);
}
