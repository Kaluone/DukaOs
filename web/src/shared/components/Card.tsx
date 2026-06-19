import { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingMap = {
  none: '0',
  sm:   'var(--space-4)',
  md:   'var(--space-6)',
  lg:   'var(--space-8)',
}

export function Card({ children, padding = 'md', style, className = '', ...props }: CardProps) {
  return (
    <div
      className={`card ${className}`}
      style={{ padding: paddingMap[padding], ...style }}
      {...props}
    >
      {children}
    </div>
  )
}
