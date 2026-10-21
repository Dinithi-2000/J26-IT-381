import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quill_grade/core/database/app_database.dart';
import 'package:quill_grade/core/database/repositories/sample_repository.dart';

void main() {
  late AppDatabase db;
  late SampleRepository repository;

  setUp(() {
    // Create an in-memory database for testing
    db = AppDatabase.forTesting(NativeDatabase.memory());
    repository = SampleRepository(db);
  });

  tearDown(() async {
    await db.close();
  });

  test('createNewSample creates a sample with pending state', () async {
    final ownerId = 'test-user-123';
    
    // Create sample
    final sampleId = await repository.createNewSample(ownerId);
    expect(sampleId, isNotNull);
    
    // Retrieve sample
    final sample = await repository.getSample(sampleId);
    
    expect(sample.ownerId, ownerId);
    expect(sample.predictedGrade, isNull);
    expect(sample.crossSectionWidthMm, isNull);
    expect(sample.isSynced, isFalse);
    expect(sample.needsReview, isFalse); // Initially false until analysis
  });

  test('saveAnalysisResult updates dimensions and sets needsReview', () async {
    final ownerId = 'test-user-123';
    
    final sampleId = await repository.createNewSample(ownerId);
    
    // Simulate ML analysis completion
    await repository.saveAnalysisResult(sampleId, 12.5, 11.2, 'ALBA');
    
    // Retrieve updated sample
    final sample = await repository.getSample(sampleId);
    
    expect(sample.predictedGrade, 'ALBA');
    expect(sample.crossSectionWidthMm, 12.5);
    expect(sample.crossSectionHeightMm, 11.2);
    expect(sample.needsReview, isTrue);
    expect(sample.isSynced, isFalse); // Should be false because it was just edited
  });
}
