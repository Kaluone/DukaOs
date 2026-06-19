import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/auth_service.dart';
import '../services/transaction_service.dart';
import '../services/offline_queue_service.dart';
import '../../models/product_model.dart';
import '../../models/transaction_model.dart';

// ── Supabase client ───────────────────────────────────────────────────────────
final supabaseClientProvider = Provider<SupabaseClient>(
  (_) => Supabase.instance.client,
);

// ── Auth ──────────────────────────────────────────────────────────────────────
final currentUserProvider = StreamProvider<User?>((ref) {
  return ref
      .watch(supabaseClientProvider)
      .auth
      .onAuthStateChange
      .map((e) => e.session?.user);
});

// AuthService uses static methods — no instance provider needed.
// Call AuthService.getMyShop(), AuthService.signInWithGoogle(), etc. directly.

final shopProvider = FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  // Re-run whenever auth state changes (e.g. after login)
  ref.watch(currentUserProvider);
  return AuthService.getMyShop();
});

// ── Offline queue ─────────────────────────────────────────────────────────────
// The OfflineQueueService instance is created in main.dart (after Hive.initFlutter)
// and injected via ProviderScope.overrides. This avoids calling init() twice.
final offlineQueueProvider = Provider<OfflineQueueService>((_) {
  throw StateError(
    'offlineQueueProvider has no value. '
    'Provide the initialized instance via ProviderScope.overrides in main.dart.',
  );
});

// ── Pending sync badge count ──────────────────────────────────────────────────
final pendingCountProvider = StreamProvider<int>((ref) {
  final queue = ref.watch(offlineQueueProvider);
  return queue.changes.map((_) => queue.pendingCount);
});

// ── Transaction service ───────────────────────────────────────────────────────
final transactionServiceProvider = Provider<TransactionService>((ref) {
  return TransactionService(
    supabase: ref.watch(supabaseClientProvider),
    queue:    ref.watch(offlineQueueProvider),
  );
});

// ── Products ──────────────────────────────────────────────────────────────────
final productsProvider = FutureProvider.autoDispose
    .family<List<ProductModel>, String>((ref, shopId) async {
  final supabase = ref.watch(supabaseClientProvider);
  final res = await supabase
      .from('products')
      .select('*, stock_levels(quantity, reorder_threshold)')
      .eq('shop_id', shopId)
      .eq('active', true)
      .order('name');
  return (res as List)
      .map((e) => ProductModel.fromMap(e as Map<String, dynamic>))
      .toList();
});

// ── Cart ──────────────────────────────────────────────────────────────────────
final cartProvider =
    StateNotifierProvider<CartNotifier, Map<String, CartItem>>(
  (_) => CartNotifier(),
);

class CartNotifier extends StateNotifier<Map<String, CartItem>> {
  CartNotifier() : super({});

  void add(ProductModel product) {
    final existing = state[product.id];
    if (existing != null) {
      existing.quantity++;
      state = Map.of(state); // trigger rebuild
    } else {
      state = {
        ...state,
        product.id: CartItem(
          productId:   product.id,
          productName: product.name,
          unitPrice:   product.price,
          photoUrl:    product.photoUrl,
        ),
      };
    }
  }

  void remove(String productId) {
    final existing = state[productId];
    if (existing == null) return;
    if (existing.quantity <= 1) {
      state = Map.of(state)..remove(productId);
    } else {
      existing.quantity--;
      state = Map.of(state);
    }
  }

  void clear() => state = {};

  int get itemCount =>
      state.values.fold(0, (s, i) => s + i.quantity);

  double get total =>
      state.values.fold(0.0, (s, i) => s + i.subtotal);
}

// ── Active staff PIN session ──────────────────────────────────────────────────
final activeStaffIdProvider = StateProvider<String?>((ref) => null);
