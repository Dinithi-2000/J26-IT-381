import 'package:drift/drift.dart';

import 'tables.dart';
import 'connection.dart';

part 'app_database.g.dart';

@DriftDatabase(tables: [Samples, SyncJobs])
class AppDatabase extends _$AppDatabase {
  AppDatabase() : super(openConnection());
  AppDatabase.forTesting(super.e);

  @override
  int get schemaVersion => 3;

  @override
  MigrationStrategy get migration => MigrationStrategy(
    onCreate: (m) => m.createAll(),
    onUpgrade: (m, from, to) async {
      if (from < 2) {
        await m.addColumn(samples, samples.diameterMm);
        await m.addColumn(samples, samples.modelProbability);
      }
      if (from < 3) {
        await m.addColumn(samples, samples.diameterSource);
        await m.addColumn(samples, samples.diameterModelVersion);
        await m.addColumn(samples, samples.estimatedDiameterMm);
        await m.addColumn(samples, samples.measuredDiameterMm);
      }
    },
  );
}
