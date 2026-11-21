import React from 'react';

/**
 * Neo-Brutalist Card container following Reference Images 2 and 3.
 * Features 2px solid border, hard offset drop-shadow, and optional eyebrow tag.
 */
export function NeoCard({
  children,
  eyebrow = null,
  title = null,
  badge = null,
  badgeVariant = 'lime', // 'lime', 'yellow', 'cyan', 'orange', 'white'
  actions = null,
  className = '',
  shadow = 'normal', // 'sm', 'normal', 'lg'
  innerPadding = true,
  ...props
}) {
  const shadowStyles = {
    sm: 'shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff]',
    normal: 'shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff]',
    lg: 'shadow-[7px_7px_0px_#000000] dark:shadow-[7px_7px_0px_#ffffff]',
  };

  const badgeColorMap = {
    lime: 'bg-[#a6ff70] text-black border border-black',
    yellow: 'bg-[#fde047] text-black border border-black',
    cyan: 'bg-[#67e8f9] text-black border border-black',
    orange: 'bg-[#fb923c] text-black border border-black',
    white: 'bg-white text-black border border-black',
  };

  return (
    <div
      className={`bg-white dark:bg-zinc-900 border-2 border-black dark:border-white ${
        shadowStyles[shadow] || shadowStyles.normal
      } ${innerPadding ? 'p-5 sm:p-7' : ''} ${className}`}
      {...props}
    >
      {(eyebrow || title || badge || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b-2 border-black dark:border-zinc-800">
          <div>
            {eyebrow && (
              <span className="text-[10px] sm:text-[11px] font-mono font-bold tracking-widest text-slate-500 dark:text-zinc-400 uppercase block mb-1">
                {eyebrow}
              </span>
            )}
            <div className="flex items-center gap-2.5">
              {title && (
                <h3 className="text-base sm:text-lg font-bold text-black dark:text-white tracking-tight">
                  {title}
                </h3>
              )}
              {badge && (
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 uppercase tracking-wider ${
                    badgeColorMap[badgeVariant] || badgeColorMap.lime
                  }`}
                >
                  {badge}
                </span>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
