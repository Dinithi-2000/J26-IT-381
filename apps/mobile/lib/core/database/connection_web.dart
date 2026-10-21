import 'package:drift/drift.dart';
import 'package:drift/wasm.dart';
import 'package:flutter/foundation.dart';

QueryExecutor openConnection() {
  return LazyDatabase(() async {
    final result = await WasmDatabase.open(
      databaseName: 'quillgrade',
      sqlite3Uri: Uri.parse('sql-wasm.wasm'),
      driftWorkerUri: Uri.parse('drift_worker.dart.js'),
    );
    if (result.missingFeatures.isNotEmpty) {
      // Log missing features but still proceed
      debugPrint('Drift WASM missing features: ${result.missingFeatures}');
    }
    return result.resolvedExecutor;
  });
}
