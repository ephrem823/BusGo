export default function BiftuLogo({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="busGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id="windowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.6" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Bus body */}
      <rect x="4" y="18" width="52" height="28" rx="5" fill="url(#busGrad)" />

      {/* Roof curve */}
      <path d="M9 18 Q32 10 55 18" stroke="url(#busGrad)" strokeWidth="2" fill="none" />

      {/* Windows row */}
      <rect x="8"  y="21" width="9" height="7" rx="2" fill="url(#windowGrad)" filter="url(#glow)" />
      <rect x="20" y="21" width="9" height="7" rx="2" fill="url(#windowGrad)" filter="url(#glow)" />
      <rect x="32" y="21" width="9" height="7" rx="2" fill="url(#windowGrad)" filter="url(#glow)" />
      <rect x="44" y="21" width="9" height="7" rx="2" fill="url(#windowGrad)" filter="url(#glow)" />

      {/* Door */}
      <rect x="8" y="31" width="7" height="12" rx="2" fill="white" fillOpacity="0.15" />
      <line x1="11.5" y1="31" x2="11.5" y2="43" stroke="white" strokeOpacity="0.3" strokeWidth="0.8" />

      {/* Body stripe */}
      <rect x="4" y="30" width="52" height="1.5" fill="white" fillOpacity="0.15" />

      {/* Front light */}
      <rect x="55" y="22" width="4" height="3" rx="1" fill="#fde68a" filter="url(#glow)" />
      {/* Rear light */}
      <rect x="5" y="22" width="3" height="3" rx="1" fill="#fca5a5" />

      {/* Wheels */}
      <circle cx="16" cy="47" r="6" fill="#1e1b4b" />
      <circle cx="16" cy="47" r="3.5" fill="#4c1d95" />
      <circle cx="16" cy="47" r="1.5" fill="url(#busGrad)" />

      <circle cx="46" cy="47" r="6" fill="#1e1b4b" />
      <circle cx="46" cy="47" r="3.5" fill="#4c1d95" />
      <circle cx="46" cy="47" r="1.5" fill="url(#busGrad)" />

      {/* Wheel arch shadows */}
      <path d="M10 46 Q16 40 22 46" stroke="white" strokeOpacity="0.1" strokeWidth="1" fill="none" />
      <path d="M40 46 Q46 40 52 46" stroke="white" strokeOpacity="0.1" strokeWidth="1" fill="none" />

      {/* Animated headlight beam */}
      <line x1="59" y1="23" x2="63" y2="21" stroke="#fde68a" strokeOpacity="0.6" strokeWidth="1">
        <animate attributeName="stroke-opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
      </line>
      <line x1="59" y1="24.5" x2="64" y2="24.5" stroke="#fde68a" strokeOpacity="0.4" strokeWidth="0.8">
        <animate attributeName="stroke-opacity" values="0.4;0.8;0.4" dur="2s" repeatCount="indefinite" />
      </line>

      {/* Animated wheel spin dots */}
      <circle cx="16" cy="44" r="0.8" fill="white" fillOpacity="0.6">
        <animateTransform attributeName="transform" type="rotate" from="0 16 47" to="360 16 47" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="46" cy="44" r="0.8" fill="white" fillOpacity="0.6">
        <animateTransform attributeName="transform" type="rotate" from="0 46 47" to="360 46 47" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
