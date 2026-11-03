// Hero illustration: quadcopter lowering a med box on a winch rope.
export function DroneArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 420" className={className} role="img" aria-label="Drone lowering a medical package on a rope">
      <defs>
        <linearGradient id="body" x1="0" x2="1">
          <stop offset="0" stopColor="#0f1f2e" />
          <stop offset="1" stopColor="#1e3a4c" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#2ec3bc" stopOpacity=".35" />
          <stop offset="1" stopColor="#2ec3bc" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="210" cy="190" r="190" fill="url(#glow)" />
      {/* landing marker on the ground */}
      <g transform="translate(160 360)">
        <ellipse cx="50" cy="22" rx="80" ry="14" fill="#0f1f2e" opacity=".08" />
        <rect x="18" y="0" width="64" height="30" rx="4" fill="#fff" stroke="#cbd5e1" transform="skewX(-25)" />
      </g>
      <g className="animate-float" style={{ transformOrigin: '210px 110px' }}>
        {/* arms */}
        <g stroke="#1e3a4c" strokeWidth="10" strokeLinecap="round">
          <path d="M130 80 L290 140" />
          <path d="M290 80 L130 140" />
        </g>
        {/* rotors */}
        {[
          [130, 80],
          [290, 80],
          [130, 140],
          [290, 140],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 4} y={y - 12} width="8" height="14" rx="3" fill="#0f1f2e" />
            <ellipse cx={x} cy={y - 14} rx="44" ry="7" fill="#2ec3bc" opacity=".28">
              <animate attributeName="rx" values="44;38;44" dur="0.18s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx={x} cy={y - 14} rx="40" ry="2.5" fill="#0f1f2e" opacity=".55" />
          </g>
        ))}
        {/* body */}
        <rect x="170" y="88" width="80" height="44" rx="16" fill="url(#body)" />
        <rect x="186" y="98" width="48" height="10" rx="5" fill="#2ec3bc" opacity=".9" />
        <circle cx="210" cy="124" r="4" fill="#ef4444">
          <animate attributeName="opacity" values="1;.2;1" dur="1.2s" repeatCount="indefinite" />
        </circle>
        {/* winch housing */}
        <rect x="196" y="132" width="28" height="16" rx="5" fill="#334155" />
        {/* rope + gripper + box, gently swinging */}
        <g className="animate-swing" style={{ transformOrigin: '210px 148px' }}>
          <line x1="210" y1="148" x2="210" y2="262" stroke="#94a3b8" strokeWidth="2.5" strokeDasharray="1 0" />
          <path d="M200 262 h20 l-4 10 h-12z" fill="#334155" />
          <path d="M202 272 q-8 8 0 16 M218 272 q8 8 0 16" stroke="#334155" strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x="176" y="284" width="68" height="54" rx="10" fill="#fff" stroke="#e2e8f0" strokeWidth="2" />
          <rect x="176" y="284" width="68" height="14" rx="7" fill="#0b8f8a" />
          <path d="M210 306v22M199 317h22" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
