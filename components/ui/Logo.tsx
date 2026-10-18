interface LogoProps {
  /** Shows "coffee on qr" wordmark next to the tile. */
  withWordmark?: boolean;
  /** Adds the small "CAFÉ OS" mono label under the wordmark (console contexts). */
  consoleVariant?: boolean;
  /** Renders on a dark surface — swaps wordmark text to oat. */
  onDark?: boolean;
  size?: number;
  className?: string;
}

export function Logo({
  withWordmark = true,
  consoleVariant = false,
  onDark = true,
  size = 36,
  className = "",
}: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="36" height="36" rx="10" fill="#2E4A2C" />
        <path
          d="M21.5 11.5c0-1.1-1.1-2-2.6-2h-1.8c-2.9 0-5.1 1.9-5.1 4.6 0 1.9 1.1 3 2.6 3.7-1.7.6-3 1.9-3 4 0 2.8 2.4 4.7 5.5 4.7h1.9c1.5 0 2.6-.9 2.6-2"
          stroke="#A8C47A"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <div className="flex flex-col leading-none">
          <span className={`font-display font-extrabold text-[1.05rem] ${onDark ? "text-oat" : "text-espresso"}`}>
            coffee <span className="text-matcha">on</span> qr
          </span>
          {consoleVariant && (
            <span className="mono-label mt-1 text-matcha/80">CAFÉ OS</span>
          )}
        </div>
      )}
    </div>
  );
}
