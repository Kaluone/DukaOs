import 'package:flutter/material.dart';
import 'package:curved_navigation_bar/curved_navigation_bar.dart';
import 'package:go_router/go_router.dart';
import '../config/colors.dart';

class MainShell extends StatelessWidget {
  final Widget child;
  const MainShell({super.key, required this.child});

  static const _routes = ['/dashboard', '/pos', '/reconciliation'];
  static const _icons = [
    Icon(Icons.dashboard_rounded,       size: 26, color: AppColors.primary),
    Icon(Icons.point_of_sale_rounded,   size: 26, color: AppColors.primary),
    Icon(Icons.account_balance_wallet_rounded, size: 26, color: AppColors.primary),
  ];

  int _currentIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final idx = _routes.indexOf(location);
    return idx >= 0 ? idx : 0;
  }

  @override
  Widget build(BuildContext context) {
    final isDesktop = MediaQuery.of(context).size.width > 800;

    if (isDesktop) {
      return Scaffold(
        body: Row(
          children: [
            _Sidebar(currentRoute: GoRouterState.of(context).matchedLocation),
            Expanded(child: child),
          ],
        ),
      );
    }

    return Scaffold(
      body: child,
      extendBody: true,
      bottomNavigationBar: CurvedNavigationBar(
        index: _currentIndex(context),
        height: 60,
        color: AppColors.surface,
        buttonBackgroundColor: AppColors.surface,
        backgroundColor: Colors.transparent,
        animationDuration: const Duration(milliseconds: 350),
        animationCurve: Curves.easeOutCubic,
        items: _icons,
        onTap: (i) => context.go(_routes[i]),
      ),
    );
  }
}

class _Sidebar extends StatelessWidget {
  final String currentRoute;
  const _Sidebar({required this.currentRoute});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 240,
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(right: BorderSide(color: AppColors.border)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 32),
          // Logo
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.store_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                Text('DukaOS', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
              ],
            ),
          ),
          const SizedBox(height: 32),
          _buildNavItem(context, '/dashboard', Icons.dashboard_rounded, 'Dashibodi'),
          _buildNavItem(context, '/pos', Icons.point_of_sale_rounded, 'Mauzo (POS)'),
          _buildNavItem(context, '/reconciliation', Icons.account_balance_wallet_rounded, 'Usahihishaji'),
        ],
      ),
    );
  }

  Widget _buildNavItem(BuildContext context, String route, IconData icon, String label) {
    final isActive = currentRoute == route;
    return InkWell(
      onTap: () => context.go(route),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isActive ? AppColors.primaryLight : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: isActive ? AppColors.primary : AppColors.textSecondary),
            const SizedBox(width: 12),
            Text(label, style: TextStyle(
              fontSize: 14, fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
              color: isActive ? AppColors.primary : AppColors.textSecondary,
            )),
          ],
        ),
      ),
    );
  }
}
