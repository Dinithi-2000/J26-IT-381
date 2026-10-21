import 'package:flutter/material.dart';
import '../../theme.dart';

class GradingGuideScreen extends StatefulWidget {
  const GradingGuideScreen({super.key});

  @override
  State<GradingGuideScreen> createState() => _GradingGuideScreenState();
}

class _GradingGuideScreenState extends State<GradingGuideScreen> {
  String _selectedFilter = 'All Grades';
  String _searchQuery = '';
  final List<String> _filters = ['All Grades', 'Premium', 'Continental', 'Mexican'];

  final List<_GradeSpec> _specs = [
    _GradeSpec(
      title: 'Alba',
      badge: 'Top Export Tier',
      category: 'Premium',
      chipColor: AppTheme.albaColor,
      description: 'The highest and most prized grade of Ceylon cinnamon. Slender, pencil-thin quills rolled tightly from the finest inner bark.',
      diameter: '≤ 6.0 mm',
      color: 'Golden Tan',
      oil: 'High (3.5 - 4.5%)',
      standards: 'SLS 81: Part 1 - Grade Alba. Maximum 45 quills per 100g. Bark thickness < 0.2 mm.',
    ),
    _GradeSpec(
      title: 'C5 Special',
      badge: 'Continental Tier 1',
      category: 'Continental',
      chipColor: AppTheme.c5Color,
      description: 'Highly sought after for its exceptional aroma, smooth golden surface, and refined sweetness with low coumarin.',
      diameter: '7.0 - 9.5 mm',
      color: 'Warm Golden',
      oil: 'High (2.8 - 3.5%)',
      standards: 'SLS 81: Part 2 - Grade C5-Sp. Smooth outer quills with tight concentric multi-layers.',
    ),
    _GradeSpec(
      title: 'C4',
      badge: 'Continental Standard',
      category: 'Continental',
      chipColor: AppTheme.c4Color,
      description: 'Standard commercial high-volume export grade. Solid structural integrity, strong sweet aroma, and bright cinnamon color.',
      diameter: '12.0 - 15.0 mm',
      color: 'Medium Brown',
      oil: 'Medium (2.0 - 2.8%)',
      standards: 'SLS 81: Part 2 - Grade C4. Widely used for premium European culinary packaging.',
    ),
    _GradeSpec(
      title: 'M5',
      badge: 'Mexican Coarse',
      category: 'Mexican',
      chipColor: AppTheme.m5Color,
      description: 'Characterized by thicker, rougher outer bark texture. Ideal for industrial extraction, ground cinnamon spice, and beverage brewing.',
      diameter: '16.0 - 20.0 mm',
      color: 'Dark Amber',
      oil: 'Moderate (1.5 - 2.2%)',
      standards: 'SLS 81: Part 3 - Grade M5. Stouter quills with rustic aroma profile.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final filteredList = _specs.where((spec) {
      final matchesFilter = _selectedFilter == 'All Grades' || spec.category == _selectedFilter;
      final matchesSearch = _searchQuery.isEmpty || 
          spec.title.toLowerCase().contains(_searchQuery.toLowerCase()) || 
          spec.description.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    }).toList();

    return Scaffold(
      backgroundColor: AppTheme.canvasColor,
      appBar: AppBar(
        title: const Text('SLS 81 Grading Education'),
      ),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Ceylon Cinnamon Standards',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.darkText,
                      letterSpacing: -0.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Interactive botanical & caliper field assessment guide.',
                    style: TextStyle(fontSize: 13, color: AppTheme.secondaryText),
                  ),
                  const SizedBox(height: 18),

                  // Search Bar
                  TextField(
                    onChanged: (val) => setState(() => _searchQuery = val.trim()),
                    decoration: InputDecoration(
                      hintText: 'Search grades (e.g. Alba, C5, diameter)...',
                      prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.tertiaryText, size: 20),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Filter Chips
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
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
                              color: isSelected ? Colors.white : AppTheme.secondaryText,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              fontSize: 12,
                            ),
                            backgroundColor: AppTheme.surfaceColor,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                              side: BorderSide(
                                color: isSelected ? AppTheme.primaryGreen : AppTheme.borderColor,
                              ),
                            ),
                            showCheckmark: false,
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),

          // Grade Specification Cards
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final spec = filteredList[index];
                  return _buildGradeCard(spec);
                },
                childCount: filteredList.length,
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 28)),
        ],
      ),
    );
  }

  Widget _buildGradeCard(_GradeSpec spec) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.borderColor),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Banner Area with Category Chip
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: spec.chipColor.withValues(alpha: 0.08),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              border: Border(bottom: BorderSide(color: spec.chipColor.withValues(alpha: 0.18))),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: spec.chipColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      spec.category.toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: spec.chipColor,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceColor,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.borderColor),
                  ),
                  child: Text(
                    spec.badge,
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.secondaryText),
                  ),
                ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(18.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      spec.title,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.darkText,
                        letterSpacing: -0.4,
                      ),
                    ),
                    Text(
                      spec.diameter,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: spec.chipColor,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  spec.description,
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppTheme.secondaryText,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 16),

                // Property Pills
                Row(
                  children: [
                    Expanded(child: _buildPropertyBox('Diameter', spec.diameter, Icons.straighten_rounded)),
                    const SizedBox(width: 8),
                    Expanded(child: _buildPropertyBox('Color', spec.color, Icons.palette_outlined)),
                    const SizedBox(width: 8),
                    Expanded(child: _buildPropertyBox('Oil', spec.oil, Icons.opacity_rounded)),
                  ],
                ),
                const SizedBox(height: 16),

                // Learn More Action
                InkWell(
                  onTap: () => _showSpecDetailsModal(spec),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceDim,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    alignment: Alignment.center,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'View SLS 81 Standards Spec',
                          style: TextStyle(
                            color: AppTheme.primaryGreen,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Icon(Icons.arrow_forward_rounded, size: 14, color: AppTheme.primaryGreen),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPropertyBox(String label, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppTheme.surfaceDim,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: AppTheme.tertiaryText),
              const SizedBox(width: 4),
              Text(label, style: const TextStyle(fontSize: 10, color: AppTheme.tertiaryText, fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppTheme.darkText),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  void _showSpecDetailsModal(_GradeSpec spec) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surfaceColor,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) {
        return Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '${spec.title} Technical Spec',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppTheme.darkText),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                spec.standards,
                style: const TextStyle(fontSize: 14, color: AppTheme.secondaryText, height: 1.5),
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.primaryContainer,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.verified_outlined, color: AppTheme.primaryGreen),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Conforms to ISO 6535 & Sri Lanka Standards Institution Specification SLS 81:2022.',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.primaryGreen),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        );
      },
    );
  }
}

class _GradeSpec {
  final String title;
  final String badge;
  final String category;
  final Color chipColor;
  final String description;
  final String diameter;
  final String color;
  final String oil;
  final String standards;

  _GradeSpec({
    required this.title,
    required this.badge,
    required this.category,
    required this.chipColor,
    required this.description,
    required this.diameter,
    required this.color,
    required this.oil,
    required this.standards,
  });
}
