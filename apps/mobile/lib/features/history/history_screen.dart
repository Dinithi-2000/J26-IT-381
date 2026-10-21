import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/database/repositories/sample_repository.dart';
import '../../core/database/app_database.dart';
import '../../theme.dart';

class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  String _selectedFilter = 'All';
  String _searchQuery = '';
  final TextEditingController _searchCtrl = TextEditingController();

  final List<String> _filters = [
    'All',
    'Alba',
    'C4',
    'C5',
    'EXTRA',
    'H1',
    'H2',
    'M4',
    'C5 Special',
    'M5',
  ];

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Color _getGradeColor(String? grade) {
    switch (grade?.toUpperCase()) {
      case 'ALBA':
        return AppTheme.albaColor;
      case 'C5 SPECIAL':
      case 'C5':
        return AppTheme.c5Color;
      case 'C4':
        return AppTheme.c4Color;
      case 'M5':
      case 'M4':
        return AppTheme.m5Color;
      default:
        return AppTheme.primaryGreen;
    }
  }

  @override
  Widget build(BuildContext context) {
    final sampleRepo = ref.watch(sampleRepositoryProvider);

    return Scaffold(
      backgroundColor: AppTheme.canvasColor,
      appBar: AppBar(title: const Text('Scan History')),
      body: SafeArea(
        child: Column(
          children: [
            // Search Input
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: TextField(
                controller: _searchCtrl,
                onChanged: (val) =>
                    setState(() => _searchQuery = val.trim().toLowerCase()),
                decoration: InputDecoration(
                  hintText: 'Search by lot ID or grade...',
                  prefixIcon: const Icon(
                    Icons.search,
                    color: AppTheme.secondaryText,
                    size: 20,
                  ),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear, size: 18),
                          onPressed: () {
                            _searchCtrl.clear();
                            setState(() => _searchQuery = '');
                          },
                        )
                      : null,
                ),
              ),
            ),

            // Filter Chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                children: _filters.map((filter) {
                  final isSelected = _selectedFilter == filter;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: ChoiceChip(
                      label: Text(filter),
                      selected: isSelected,
                      onSelected: (selected) {
                        if (selected) setState(() => _selectedFilter = filter);
                      },
                      selectedColor: AppTheme.primaryGreen,
                      labelStyle: TextStyle(
                        color: isSelected
                            ? Colors.white
                            : AppTheme.secondaryText,
                        fontWeight: isSelected
                            ? FontWeight.w600
                            : FontWeight.w500,
                        fontSize: 12,
                      ),
                      backgroundColor: AppTheme.surfaceColor,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(
                          color: isSelected
                              ? AppTheme.primaryGreen
                              : AppTheme.borderColor,
                        ),
                      ),
                      showCheckmark: false,
                    ),
                  );
                }).toList(),
              ),
            ),

            const SizedBox(height: 8),

            // Samples List
            Expanded(
              child: StreamBuilder<List<Sample>>(
                stream: sampleRepo.watchAllSamples(),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  var samples = snapshot.data ?? [];

                  if (_searchQuery.isNotEmpty) {
                    samples = samples.where((s) {
                      final idMatches = s.sampleId.toLowerCase().contains(
                        _searchQuery,
                      );
                      final gradeMatches = (s.predictedGrade ?? '')
                          .toLowerCase()
                          .contains(_searchQuery);
                      return idMatches || gradeMatches;
                    }).toList();
                  }

                  if (_selectedFilter != 'All') {
                    samples = samples.where((s) {
                      return (s.predictedGrade ?? '').toLowerCase() ==
                          _selectedFilter.toLowerCase();
                    }).toList();
                  }

                  if (samples.isEmpty) {
                    return const Center(
                      child: Text(
                        'No scans found',
                        style: TextStyle(color: AppTheme.secondaryText),
                      ),
                    );
                  }

                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    itemCount: samples.length,
                    itemBuilder: (context, index) {
                      final sample = samples[index];
                      final grade = sample.predictedGrade ?? 'Graded';
                      final gradeColor = _getGradeColor(grade);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceColor,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.borderColor),
                        ),
                        child: Material(
                          type: MaterialType.transparency,
                          borderRadius: BorderRadius.circular(12),
                          clipBehavior: Clip.antiAlias,
                          child: ListTile(
                            onTap: () => context.go('/result/${sample.id}'),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 4,
                            ),
                            leading: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: gradeColor.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                grade,
                                style: TextStyle(
                                  color: gradeColor,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                            title: Text(
                              sample.sampleId,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                              ),
                            ),
                            subtitle: Text(
                              'Ø ${(sample.diameterMm ?? sample.crossSectionWidthMm)?.toStringAsFixed(2) ?? '?'} mm • ${sample.captureTimestamp.hour.toString().padLeft(2, '0')}:${sample.captureTimestamp.minute.toString().padLeft(2, '0')}',
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppTheme.secondaryText,
                              ),
                            ),
                            trailing: const Icon(
                              Icons.chevron_right,
                              size: 18,
                              color: AppTheme.tertiaryText,
                            ),
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
