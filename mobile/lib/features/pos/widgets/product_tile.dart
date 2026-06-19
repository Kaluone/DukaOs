import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../models/product_model.dart';
import '../../../config/colors.dart';
import '../../../config/constants.dart';

class ProductTile extends StatefulWidget {
  final ProductModel product;
  final VoidCallback onTap;

  const ProductTile({super.key, required this.product, required this.onTap});

  @override
  State<ProductTile> createState() => _ProductTileState();
}

class _ProductTileState extends State<ProductTile> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: AppConstants.animFast);
    _scale = Tween(begin: 1.0, end: 0.94).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _ctrl.forward(),
      onTapUp: (_) { _ctrl.reverse(); widget.onTap(); },
      onTapCancel: () => _ctrl.reverse(),
      child: ScaleTransition(
        scale: _scale,
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppConstants.radiusL),
            border: Border.all(color: AppColors.border),
            boxShadow: [BoxShadow(color: AppColors.primary.withOpacity(0.05), blurRadius: 8, offset: const Offset(0,2))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Product image
              Expanded(
                flex: 3,
                child: Container(
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.surface2,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(AppConstants.radiusL),
                      topRight: Radius.circular(AppConstants.radiusL),
                    ),
                  ),
                  child: widget.product.photoUrl != null
                      ? ClipRRect(
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(AppConstants.radiusL),
                            topRight: Radius.circular(AppConstants.radiusL),
                          ),
                          child: CachedNetworkImage(
                            imageUrl: widget.product.photoUrl!,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => _placeholder(),
                          ),
                        )
                      : _placeholder(),
                ),
              ),

              // Info
              Expanded(
                flex: 2,
                child: Padding(
                  padding: const EdgeInsets.all(AppConstants.space3),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        widget.product.name,
                        maxLines: 2, overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                      ),
                      Text(
                        widget.product.formattedPrice,
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.primary),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _placeholder() {
    return Center(
      child: Text(
        widget.product.name[0].toUpperCase(),
        style: const TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: AppColors.primary),
      ),
    );
  }
}
