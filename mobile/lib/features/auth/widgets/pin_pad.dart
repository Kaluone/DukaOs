import 'package:flutter/material.dart';
import '../../../config/colors.dart';

class PinPad extends StatelessWidget {
  final void Function(String) onDigit;
  final VoidCallback onDelete;

  const PinPad({super.key, required this.onDigit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 280,
      child: Column(
        children: [
          _row(['1','2','3'], context),
          const SizedBox(height: 12),
          _row(['4','5','6'], context),
          const SizedBox(height: 12),
          _row(['7','8','9'], context),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              const SizedBox(width: 72),
              _DigitKey(label: '0', onTap: () => onDigit('0')),
              _DeleteKey(onTap: onDelete),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(List<String> digits, BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: digits.map((d) => _DigitKey(label: d, onTap: () => onDigit(d))).toList(),
    );
  }
}

class _DigitKey extends StatefulWidget {
  final String label;
  final VoidCallback onTap;
  const _DigitKey({required this.label, required this.onTap});

  @override
  State<_DigitKey> createState() => _DigitKeyState();
}

class _DigitKeyState extends State<_DigitKey> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) { setState(() => _pressed = false); widget.onTap(); },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 80),
        width: 72, height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: _pressed ? AppColors.primaryLight : AppColors.surface,
          border: Border.all(color: AppColors.border, width: 1.5),
          boxShadow: _pressed ? [] : [BoxShadow(color: AppColors.primary.withOpacity(0.06), blurRadius: 8, offset: const Offset(0,2))],
        ),
        child: Center(
          child: Text(widget.label,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        ),
      ),
    );
  }
}

class _DeleteKey extends StatelessWidget {
  final VoidCallback onTap;
  const _DeleteKey({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 72, height: 72,
        decoration: const BoxDecoration(shape: BoxShape.circle),
        child: const Center(
          child: Icon(Icons.backspace_outlined, size: 24, color: AppColors.textSecondary),
        ),
      ),
    );
  }
}
