import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/services/auth_service.dart';
import '../../../config/colors.dart';
import '../../../config/constants.dart';

class ReconciliationScreen extends StatefulWidget {
  const ReconciliationScreen({super.key});

  @override
  State<ReconciliationScreen> createState() => _ReconciliationScreenState();
}

class _ReconciliationScreenState extends State<ReconciliationScreen> {
  Map<String, dynamic>? _shop;
  final _actualCtrl = TextEditingController();
  double _expectedCash = 0;
  bool _loading = true;
  bool _saving = false;
  bool _saved = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() { _actualCtrl.dispose(); super.dispose(); }

  Future<void> _load() async {
    final shop = await AuthService.getMyShop();
    if (shop == null || !mounted) return;
    setState(() => _shop = shop);

    // Calculate expected cash from today's cash transactions
    final today = DateTime.now();
    final startOfDay = DateTime(today.year, today.month, today.day);
    final result = await Supabase.instance.client
        .from('transactions')
        .select('total_amount')
        .eq('shop_id', shop['id'] as String)
        .eq('payment_method', 'cash')
        .gte('created_at', startOfDay.toIso8601String());

    double expected = 0;
    for (final row in result) expected += (row['total_amount'] as num).toDouble();

    if (mounted) setState(() { _expectedCash = expected; _loading = false; });
  }

  Future<void> _submit() async {
    final actual = double.tryParse(_actualCtrl.text.replaceAll(',', ''));
    if (actual == null || _shop == null) return;
    setState(() => _saving = true);

    final today = DateTime.now();
    await Supabase.instance.client.from('cash_reconciliations').insert({
      'shop_id': _shop!['id'],
      'staff_id': null,
      'shift_date': '${today.year}-${today.month.toString().padLeft(2,'0')}-${today.day.toString().padLeft(2,'0')}',
      'expected_cash': _expectedCash,
      'actual_cash': actual,
    });

    if (!mounted) return;
    setState(() { _saving = false; _saved = true; });
  }

  String _fmt(double n) {
    return 'TZS ${n.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }

  @override
  Widget build(BuildContext context) {
    final actual = double.tryParse(_actualCtrl.text.replaceAll(',', '')) ?? 0;
    final variance = actual - _expectedCash;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Usahihishaji wa Pesa'),
        backgroundColor: AppColors.surface,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2.5))
          : _saved
              ? _buildSuccess(variance)
              : _buildForm(actual, variance),
    );
  }

  Widget _buildForm(double actual, double variance) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppConstants.space5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Expected
          Container(
            padding: const EdgeInsets.all(AppConstants.space5),
            decoration: BoxDecoration(
              color: AppColors.surface,
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(AppConstants.radiusL),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Pesa Inayotarajiwa (Leo)', style: TextStyle(fontSize: 13, color: AppColors.textMuted)),
                    const SizedBox(height: 4),
                    Text(_fmt(_expectedCash), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.primary)),
                  ],
                ),
                const Icon(Icons.receipt_long_rounded, size: 32, color: AppColors.primaryLight),
              ],
            ),
          ),

          const SizedBox(height: AppConstants.space5),

          // Actual input
          const Text('Pesa Halisi Iliyohesabiwa', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
          const SizedBox(height: AppConstants.space2),
          TextField(
            controller: _actualCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: '0',
              prefixText: 'TZS ',
              prefixStyle: TextStyle(fontWeight: FontWeight.w700, color: AppColors.textSecondary),
            ),
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
          ),

          const SizedBox(height: AppConstants.space5),

          // Variance
          if (_actualCtrl.text.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(AppConstants.space4),
              decoration: BoxDecoration(
                color: variance == 0
                    ? AppColors.successBg
                    : variance > 0
                        ? AppColors.infoBg
                        : AppColors.errorBg,
                borderRadius: BorderRadius.circular(AppConstants.radiusL),
                border: Border.all(
                  color: variance == 0 ? AppColors.success
                      : variance > 0   ? AppColors.info
                      : AppColors.error,
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    variance == 0 ? Icons.check_circle_rounded
                        : variance > 0 ? Icons.arrow_upward_rounded
                        : Icons.arrow_downward_rounded,
                    color: variance == 0 ? AppColors.success
                        : variance > 0   ? AppColors.info
                        : AppColors.error,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          variance == 0 ? 'Hakuna tofauti'
                              : variance > 0 ? 'Ziada ya pesa'
                              : 'Upungufu wa pesa',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: variance == 0 ? AppColors.success
                                : variance > 0   ? AppColors.info
                                : AppColors.error,
                          ),
                        ),
                        Text(_fmt(variance.abs()),
                          style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w800,
                            color: variance == 0 ? AppColors.success
                                : variance > 0   ? AppColors.info
                                : AppColors.error,
                          )),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppConstants.space5),
          ],

          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving || _actualCtrl.text.isEmpty ? null : _submit,
              child: _saving
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                  : const Text('Hifadhi Usahihishaji', style: TextStyle(fontWeight: FontWeight.w800)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSuccess(double variance) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppConstants.space8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80, height: 80,
              decoration: const BoxDecoration(color: AppColors.successBg, shape: BoxShape.circle),
              child: const Icon(Icons.check_rounded, color: AppColors.success, size: 44),
            ),
            const SizedBox(height: AppConstants.space5),
            const Text('Usahihishaji Umehifadhiwa!', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: AppConstants.space2),
            Text(
              variance == 0
                  ? 'Hesabu zinaendana kikamilifu'
                  : variance > 0 ? 'Ziada ya ${_fmt(variance.abs())}' : 'Upungufu wa ${_fmt(variance.abs())}',
              style: TextStyle(
                color: variance == 0 ? AppColors.success : variance > 0 ? AppColors.info : AppColors.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
