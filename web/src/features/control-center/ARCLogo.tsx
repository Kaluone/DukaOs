interface ARCLogoProps {
  size?: number
  showText?: boolean
  collapsed?: boolean
}

export function ARCLogo({ size = 40, showText = true, collapsed = false }: ARCLogoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 10 }}>
      <img
        src="/arc-logo.png"
        alt="AutoRevenue Labs"
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          flexShrink: 0,
        }}
      />
      {showText && !collapsed && (
        <div style={{ lineHeight: 1.15 }}>
          <div style={{
            fontSize: size > 32 ? 14 : 11,
            fontWeight: 800,
            color: '#f1f5f9',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}>
            AutoRevenue Labs
          </div>
          <div style={{
            fontSize: size > 32 ? 9 : 8,
            fontWeight: 700,
            color: '#b8860b',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginTop: 1,
          }}>
            Control Center
          </div>
        </div>
      )}
    </div>
  )
}
