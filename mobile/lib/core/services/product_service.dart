import 'package:supabase_flutter/supabase_flutter.dart';
import '../../models/product_model.dart';
import '../../config/constants.dart';

class ProductService {
  ProductService._();
  static final _client = Supabase.instance.client;

  // In-memory TTL cache
  static List<ProductModel>? _cache;
  static DateTime? _cacheTime;

  static Future<List<ProductModel>> getProducts(
    String shopId, {
    bool forceRefresh = false,
  }) async {
    if (!forceRefresh && _cache != null && _cacheTime != null) {
      if (DateTime.now().difference(_cacheTime!) < AppConstants.cacheProducts) {
        return _cache!;
      }
    }
    final data = await _client
        .from('products')
        .select('*')
        .eq('shop_id', shopId)
        .eq('active', true)
        .order('name');

    _cache = (data as List).map((e) => ProductModel.fromMap(e as Map<String, dynamic>)).toList();
    _cacheTime = DateTime.now();
    return _cache!;
  }

  static void invalidateCache() { _cache = null; _cacheTime = null; }

  static Future<Map<String, dynamic>> getStockMap(String shopId) async {
    final data = await _client
        .from('stock_levels')
        .select('product_id, quantity, reorder_threshold')
        .eq('shop_id', shopId);
    final map = <String, dynamic>{};
    for (final row in data) map[row['product_id'] as String] = row;
    return map;
  }

  static Future<void> addProduct({
    required String shopId,
    required String name,
    required double price,
    String? category,
    String? photoUrl,
    int initialQty = 0,
    int reorderThreshold = 2,
  }) async {
    final prod = await _client.from('products').insert({
      'shop_id': shopId, 'name': name, 'price': price,
      'category': category, 'photo_url': photoUrl,
    }).select('id').single();

    final prodId = prod['id'] as String;
    await _client.from('stock_levels').insert({
      'product_id': prodId, 'shop_id': shopId,
      'quantity': initialQty, 'reorder_threshold': reorderThreshold,
    });
    invalidateCache();
  }
}
