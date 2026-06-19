import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/services/product_service.dart';
import '../../../core/services/auth_service.dart';
import '../../../models/product_model.dart';
import '../../../models/transaction_model.dart';
import '../../../config/colors.dart';
import '../../../config/constants.dart';
import '../widgets/product_tile.dart';

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  List<ProductModel> _products = [];
  final List<CartItem> _cart = [];
  String _search = '';
  bool _loading = true;
  Map<String, dynamic> _shop = {};

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final shop = await AuthService.getMyShop();
    if (shop == null || !mounted) return;
    setState(() => _shop = shop);

    final products = await ProductService.getProducts(shop['id'] as String);
    if (mounted) setState(() { _products = products; _loading = false; });
  }

  void _addToCart(ProductModel product) {
    setState(() {
      final existing = _cart.indexWhere((c) => c.productId == product.id);
      if (existing >= 0) {
        _cart[existing].quantity++;
      } else {
        _cart.add(CartItem(
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          photoUrl: product.photoUrl,
        ));
      }
    });
    // Show brief feedback
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${product.name} — imeongezwa'),
        duration: const Duration(milliseconds: 1200),
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.primary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  int get _cartCount => _cart.fold(0, (s, i) => s + i.quantity);
  double get _cartTotal => _cart.fold(0.0, (s, i) => s + i.subtotal);

  List<ProductModel> get _filtered => _search.isEmpty
      ? _products
      : _products.where((p) =>
          p.name.toLowerCase().contains(_search.toLowerCase()) ||
          (p.category?.toLowerCase().contains(_search.toLowerCase()) ?? false)
        ).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Mauzo'),
        backgroundColor: AppColors.surface,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ProductService.invalidateCache().then((_) => _loadData()),
            tooltip: 'Onyesha upya',
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(AppConstants.space4),
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Tafuta bidhaa...',
                prefixIcon: const Icon(Icons.search_rounded, color: AppColors.textMuted, size: 20),
                suffixIcon: _search.isNotEmpty
                    ? IconButton(icon: const Icon(Icons.close, size: 18), onPressed: () => setState(() => _search = ''))
                    : null,
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),

          // Product grid
          Expanded(
            child: _loading
                ? _buildSkeleton()
                : _filtered.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.inventory_2_outlined, size: 48, color: AppColors.textMuted),
                            const SizedBox(height: 12),
                            Text(_search.isEmpty ? 'Hakuna bidhaa. Ongeza kwenye dashibodi.' : 'Bidhaa haijapatikana',
                              style: const TextStyle(color: AppColors.textMuted)),
                          ],
                        ),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: AppConstants.space4),
                        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: 180,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 0.78,
                        ),
                        itemCount: _filtered.length,
                        itemBuilder: (_, i) => ProductTile(
                          product: _filtered[i],
                          onTap: () => _addToCart(_filtered[i]),
                        ),
                      ),
          ),
        ],
      ),

      // Cart FAB
      floatingActionButton: _cartCount > 0
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/cart', extra: {'cart': _cart, 'shop': _shop}),
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              elevation: 4,
              label: Text(
                '$_cartCount bidhaa · ${_fmt(_cartTotal)}',
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
              ),
              icon: const Icon(Icons.shopping_cart_rounded, size: 22),
            )
          : null,
    );
  }

  Widget _buildSkeleton() {
    return GridView.builder(
      padding: const EdgeInsets.symmetric(horizontal: AppConstants.space4),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 180, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 0.78,
      ),
      itemCount: 8,
      itemBuilder: (_, __) => Container(
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(AppConstants.radiusL),
        ),
      ),
    );
  }

  String _fmt(double n) {
    return 'TZS ${n.toStringAsFixed(0).replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (m) => '${m[1]},')}';
  }
}
