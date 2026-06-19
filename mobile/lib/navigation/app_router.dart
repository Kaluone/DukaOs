import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/services/auth_service.dart';
import '../features/auth/screens/owner_login_screen.dart';
import '../features/auth/screens/staff_pin_screen.dart';
import '../features/pos/screens/pos_screen.dart';
import '../features/pos/screens/cart_screen.dart';
import '../features/dashboard/screens/owner_dashboard_screen.dart';
import '../features/products/screens/add_product_screen.dart';
import '../features/reconciliation/screens/reconciliation_screen.dart';
import 'main_shell.dart';

final appRouter = GoRouter(
  debugLogDiagnostics: false,
  initialLocation: '/login',
  redirect: (context, state) async {
    final isAuth = AuthService.isAuthenticated;
    final isAuthRoute = state.matchedLocation.startsWith('/login') ||
                        state.matchedLocation.startsWith('/staff-pin');
    if (!isAuth && !isAuthRoute) return '/login';
    if (isAuth && state.matchedLocation == '/login') return '/dashboard';
    return null;
  },
  routes: [
    GoRoute(
      path: '/login',
      pageBuilder: (context, state) => _fade(const OwnerLoginScreen()),
    ),
    GoRoute(
      path: '/staff-pin',
      pageBuilder: (context, state) => _fade(const StaffPinScreen()),
    ),
    ShellRoute(
      builder: (context, state, child) => MainShell(child: child),
      routes: [
        GoRoute(
          path: '/dashboard',
          pageBuilder: (context, state) => _fade(const OwnerDashboardScreen()),
        ),
        GoRoute(
          path: '/pos',
          pageBuilder: (context, state) => _fade(const PosScreen()),
        ),
        GoRoute(
          path: '/cart',
          pageBuilder: (context, state) => _slide(const CartScreen()),
        ),
        GoRoute(
          path: '/add-product',
          pageBuilder: (context, state) => _slide(const AddProductScreen()),
        ),
        GoRoute(
          path: '/reconciliation',
          pageBuilder: (context, state) => _slide(const ReconciliationScreen()),
        ),
      ],
    ),
  ],
);

CustomTransitionPage<void> _fade(Widget child) => CustomTransitionPage(
  child: child,
  transitionsBuilder: (_, animation, __, child) =>
    FadeTransition(opacity: animation, child: child),
  transitionDuration: const Duration(milliseconds: 220),
);

CustomTransitionPage<void> _slide(Widget child) => CustomTransitionPage(
  child: child,
  transitionsBuilder: (_, animation, __, child) => SlideTransition(
    position: Tween<Offset>(begin: const Offset(0, 0.04), end: Offset.zero)
        .animate(CurvedAnimation(parent: animation, curve: Curves.easeOut)),
    child: FadeTransition(opacity: animation, child: child),
  ),
  transitionDuration: const Duration(milliseconds: 280),
);
