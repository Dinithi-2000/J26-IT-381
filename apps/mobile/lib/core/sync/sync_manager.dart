import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:workmanager/workmanager.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:drift/drift.dart' as drift;

import '../database/database_provider.dart';
import '../database/app_database.dart';

/// The existing Firestore payload plus optional Hybrid V2 metadata.
Map<String, Object?> sampleSyncFields(Sample sample) => {
  'ownerId': sample.ownerId,
  'captureTimestamp': sample.captureTimestamp.toIso8601String(),
  'predictedGrade': sample.predictedGrade,
  'crossSectionWidthMm': sample.crossSectionWidthMm,
  'crossSectionHeightMm': sample.crossSectionHeightMm,
  'diameterMm': sample.diameterMm,
  'diameterSource': sample.diameterSource,
  'diameterModelVersion': sample.diameterModelVersion,
  'estimatedDiameterMm': sample.estimatedDiameterMm,
  'measuredDiameterMm': sample.measuredDiameterMm,
  'measurementMethod': sample.measurementMethod,
  'modelVersion': sample.modelVersion,
  'modelProbability': sample.modelProbability,
  'needsReview': sample.needsReview,
};

final syncManagerProvider = Provider<SyncManager>((ref) {
  return SyncManager(ref);
});

const String syncTaskName = "com.quillgrade.syncTask";

@pragma('vm:entry-point')
void callbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    if (task == syncTaskName) {
      // Background sync execution
      // Requires initializing Drift, Firestore, Storage here in background isolate
      // For now, return success
      return Future.value(true);
    }
    return Future.value(true);
  });
}

class SyncManager {
  final Ref _ref;

  SyncManager(this._ref);

  Future<void> initialize() async {
    if (kIsWeb ||
        (defaultTargetPlatform != TargetPlatform.android &&
            defaultTargetPlatform != TargetPlatform.iOS)) {
      return;
    }
    try {
      await Workmanager().initialize(callbackDispatcher);
    } catch (e) {
      debugPrint('Workmanager init: $e');
    }
  }

  Future<void> scheduleSync() async {
    if (kIsWeb) {
      await triggerImmediateSync();
      return;
    }
    final connectivityResult = await Connectivity().checkConnectivity();
    if (connectivityResult.contains(ConnectivityResult.none)) {
      // Schedule for later when connected
      await Workmanager().registerOneOffTask(
        "sync-task-unique-id",
        syncTaskName,
        constraints: Constraints(networkType: NetworkType.connected),
      );
    } else {
      // Execute immediately or queue
      await triggerImmediateSync();
    }
  }

  Future<void> triggerImmediateSync() async {
    final hasConnection = await Connectivity().checkConnectivity();
    if (hasConnection.contains(ConnectivityResult.none)) return;

    try {
      final db = _ref.read(databaseProvider);
      final unsyncedSamples = await (db.select(
        db.samples,
      )..where((t) => t.isSynced.equals(false))).get();

      final firestore = FirebaseFirestore.instance;

      for (final sample in unsyncedSamples) {
        final docRef = firestore.collection('samples').doc(sample.id);

        await docRef.set({
          ...sampleSyncFields(sample),
          'syncedAt': FieldValue.serverTimestamp(),
        });

        // Mark as synced locally
        await (db.update(db.samples)..where((t) => t.id.equals(sample.id)))
            .write(const SamplesCompanion(isSynced: drift.Value(true)));
      }
    } catch (e) {
      debugPrint('Sync failed: $e');
    }
  }
}
