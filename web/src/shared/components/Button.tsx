import { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  children: ReactNode
}

const variantStyles: Record<Variant, string> = {
  primary:   'btn-primary',
  secondary: 'btn-secondary',
  ghost:     'btn-ghost',
  danger:    'btn-danger',
}

const sizeStyles: Record<Size, string> = {
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span className="btn-spinner" aria-hidden="true" />
      ) : icon ? (
        <span className="btn-icon" aria-hidden="true">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  )
}
