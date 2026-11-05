// Hero illustration: neon quadcopter lowering a med box on a winch rope over a scanning marker.
export function DroneArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 420" className={className} role="img" aria-label="Drone lowering a medical package on a rope">
      <defs>
        <linearGradient id="da-body" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#1e4059" />
          <stop offset="1" stopColor="#0d2c4a" />
        </linearGradient>
        <linearGradient id="da-neon" x1="0" x2="1">
          <stop offset="0" stopColor="#00c2c7" />
          <stop offset="1" stopColor="#82a8c4" />
        </linearGradient>
        <radialGradient id="da-glow" cx="50%" cy="45%" r="50%">
          <stop offset="0" stopColor="#00c2c7" stopOpacity=".25" />
          <stop offset="1" stopColor="#00c2c7" stopOpacity="0" />
        </radialGradient>
        <filter id="da-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <circle cx="210" cy="190" r="200" fill="url(#da-glow)" />

      {/* ground marker with scanning rings */}
      <g transform="translate(210 372)">
        {[70, 48, 26].map((r, i) => (
          <ellipse key={r} rx={r} ry={r * 0.28} fill="none" stroke="#00c2c7" strokeOpacity={0.25 + i * 0.2} strokeWidth="1.5">
            <animate attributeName="stroke-opacity" values={`${0.15 + i * 0.2};${0.6};${0.15 + i * 0.2}`} dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
          </ellipse>
        ))}
        <rect x="-14" y="-5" width="28" height="10" fill="#00c2c7" opacity=".7" transform="skewX(-30)" />
      </g>
      {/* targeting beam */}
      <path d="M210 150 L150 372 L270 372 Z" fill="url(#da-neon)" opacity=".06" />

      <g className="animate-float" style={{ transformOrigin: '210px 110px' }}>
        {/* arms */}
        <g stroke="#1e4059" strokeWidth="10" strokeLinecap="round">
          <path d="M130 80 L290 140" />
          <path d="M290 80 L130 140" />
        </g>
        {/* rotors with neon blur */}
        {[
          [130, 80],
          [290, 80],
          [130, 140],
          [290, 140],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x - 4} y={y - 12} width="8" height="14" rx="3" fill="#0d2c4a" stroke="#00c2c7" strokeOpacity=".5" />
            <ellipse cx={x} cy={y - 14} rx="44" ry="7" fill="#00c2c7" opacity=".22" filter="url(#da-blur)">
              <animate attributeName="rx" values="44;36;44" dur="0.16s" repeatCount="indefinite" />
            </ellipse>
            <ellipse cx={x} cy={y - 14} rx="40" ry="2" fill="#5fdcdf" opacity=".6" />
          </g>
        ))}
        {/* body */}
        <rect x="168" y="86" width="84" height="48" rx="18" fill="url(#da-body)" stroke="url(#da-neon)" strokeWidth="1.5" />
        <rect x="184" y="98" width="52" height="8" rx="4" fill="url(#da-neon)" />
        <circle cx="196" cy="122" r="3" fill="#00c2c7">
          <animate attributeName="opacity" values="1;.2;1" dur="1s" repeatCount="indefinite" />
        </circle>
        <circle cx="224" cy="122" r="3" fill="#ff685f">
          <animate attributeName="opacity" values=".2;1;.2" dur="1s" repeatCount="indefinite" />
        </circle>
        <rect x="196" y="134" width="28" height="14" rx="5" fill="#12304b" stroke="#00c2c7" strokeOpacity=".4" />
        {/* rope + gripper + box, gently swinging */}
        <g className="animate-swing" style={{ transformOrigin: '210px 148px' }}>
          <line x1="210" y1="148" x2="210" y2="262" stroke="#5fdcdf" strokeOpacity=".7" strokeWidth="2" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" values="8;0" dur="0.6s" repeatCount="indefinite" />
          </line>
          <path d="M200 262 h20 l-4 10 h-12z" fill="#1e4059" stroke="#00c2c7" strokeOpacity=".5" />
          <path d="M202 272 q-8 8 0 16 M218 272 q8 8 0 16" stroke="#8fa4b7" strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x="176" y="284" width="68" height="54" rx="10" fill="#12304b" stroke="url(#da-neon)" strokeWidth="1.5" />
          <rect x="176" y="284" width="68" height="12" rx="6" fill="url(#da-neon)" opacity=".85" />
          <path d="M210 306v22M199 317h22" stroke="#ff685f" strokeWidth="6" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
