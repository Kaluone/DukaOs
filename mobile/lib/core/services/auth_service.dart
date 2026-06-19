import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService {
  AuthService._();
  static final _client = Supabase.instance.client;

  static User? get currentUser => _client.auth.currentUser;
  static bool get isAuthenticated => currentUser != null;
  static Session? get currentSession => _client.auth.currentSession;

  // ── Owner login (Google OAuth) ──
  static Future<void> signInWithGoogle() async {
    await _client.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: 'dukaos://auth-callback',
    );
  }

  static Future<void> signOut() async {
    await _client.auth.signOut();
  }

  // ── Fetch the owner's shop ──
  static Future<Map<String, dynamic>?> getMyShop() async {
    if (currentUser == null) return null;
    final res = await _client
        .from('shops')
        .select('*')
        .eq('owner_user_id', currentUser!.id)
        .maybeSingle();
    return res;
  }

  // ── Staff PIN verification ──
  // Returns the staff record if PIN is correct, null otherwise.
  static Future<Map<String, dynamic>?> verifyStaffPin({
    required String shopId,
    required String pin,
  }) async {
    final pinHash = _hashPin(pin);
    final res = await _client
        .from('staff')
        .select('id, full_name, shop_id')
        .eq('shop_id', shopId)
        .eq('pin_hash', pinHash)
        .eq('active', true)
        .maybeSingle();
    return res;
  }

  static String _hashPin(String pin) {
    final bytes = utf8.encode(pin);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  // ── Auth state stream ──
  static Stream<AuthState> get authStateChanges => _client.auth.onAuthStateChange;
}
