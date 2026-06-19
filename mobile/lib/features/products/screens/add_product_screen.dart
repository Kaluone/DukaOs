import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/product_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../config/colors.dart';
import '../../../config/constants.dart';

class AddProductScreen extends StatefulWidget {
  const AddProductScreen({super.key});

  @override
  State<AddProductScreen> createState() => _AddProductScreenState();
}

class _AddProductScreenState extends State<AddProductScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl     = TextEditingController();
  final _priceCtrl    = TextEditingController();
  final _categoryCtrl = TextEditingController();
  final _qtyCtrl      = TextEditingController(text: '0');
  final _threshCtrl   = TextEditingController(text: '2');
  bool _loading = false;

  @override
  void dispose() {
    _nameCtrl.dispose(); _priceCtrl.dispose();
    _categoryCtrl.dispose(); _qtyCtrl.dispose(); _threshCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final shop = await AuthService.getMyShop();
    if (shop == null) return;
    setState(() => _loading = true);

    await ProductService.addProduct(
      shopId: shop['id'] as String,
      name: _nameCtrl.text.trim(),
      price: double.parse(_priceCtrl.text),
      category: _categoryCtrl.text.trim().isEmpty ? null : _categoryCtrl.text.trim(),
      initialQty: int.tryParse(_qtyCtrl.text) ?? 0,
      reorderThreshold: int.tryParse(_threshCtrl.text) ?? 2,
    );

    if (!mounted) return;
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Ongeza Bidhaa Mpya'),
        backgroundColor: AppColors.surface,
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(AppConstants.space5),
          children: [
            // Photo placeholder
            Container(
              height: 140,
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border.all(color: AppColors.border, style: BorderStyle.solid),
                borderRadius: BorderRadius.circular(AppConstants.radiusL),
              ),
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.add_photo_alternate_rounded, size: 36, color: AppColors.textMuted),
                    SizedBox(height: 8),
                    Text('Bonyeza kupakia picha', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppConstants.space5),

            _field('Jina la Bidhaa *', _nameCtrl, 'mfano: Beseni la Plastiki', required: true),
            const SizedBox(height: AppConstants.space4),
            _field('Bei (TZS) *', _priceCtrl, 'mfano: 5000', type: TextInputType.number, required: true,
              validator: (v) => double.tryParse(v ?? '') == null ? 'Ingiza nambari sahihi' : null),
            const SizedBox(height: AppConstants.space4),
            _field('Aina ya Bidhaa', _categoryCtrl, 'mfano: Vyombo vya Jikoni'),
            const SizedBox(height: AppConstants.space4),

            Row(
              children: [
                Expanded(child: _field('Idadi ya Awali', _qtyCtrl, '0', type: TextInputType.number)),
                const SizedBox(width: AppConstants.space4),
                Expanded(child: _field('Kiwango cha Onyo', _threshCtrl, '2', type: TextInputType.number)),
              ],
            ),
            const SizedBox(height: AppConstants.space8),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _loading ? null : _save,
                child: _loading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                    : const Text('Hifadhi Bidhaa', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    String label, TextEditingController ctrl, String hint, {
    TextInputType type = TextInputType.text,
    bool required = false,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppColors.textPrimary)),
        const SizedBox(height: 6),
        TextFormField(
          controller: ctrl,
          keyboardType: type,
          decoration: InputDecoration(hintText: hint),
          validator: validator ?? (required ? (v) => v!.isEmpty ? 'Hii ni lazima' : null : null),
        ),
      ],
    );
  }
}
