import React from 'react';
import { motion } from 'framer-motion';

/**
 * Neo-Brutalist interactive button powered by Framer Motion.
 * Provides a tactile physical press animation with hard drop-shadows and Lucide SVG icons.
 */
export function NeoButton({
  children,
  onClick,
  variant = 'primary', // 'primary' (lime), 'white', 'black', 'yellow', 'cyan', 'orange', 'ghost'
  size = 'md', // 'sm', 'md', 'lg'
  icon: Icon = null,
  iconRight: IconRight = null,
  className = '',
  disabled = false,
  type = 'button',
  fullWidth = false,
  ...props
}) {
  const variantStyles = {
    // Reference Image 1 & 3: Vibrant Lime Green CTA
    primary:
      'bg-[#a6ff70] text-black border-2 border-black shadow-[3px_3px_0px_#000000] hover:bg-[#b8ff8a] dark:text-black dark:border-black',
    lime:
      'bg-[#a6ff70] text-black border-2 border-black shadow-[3px_3px_0px_#000000] hover:bg-[#b8ff8a] dark:text-black dark:border-black',
    // Reference Image 2: "Open Work" / Inactive tab clean white
    white:
      'bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000000] hover:bg-zinc-50 dark:bg-zinc-900 dark:text-white dark:border-zinc-200 dark:shadow-[3px_3px_0px_#ffffff]',
    // Reference Image 2: "All Projects" solid black active tab
    black:
      'bg-black text-white border-2 border-black shadow-[3px_3px_0px_#000000] hover:bg-zinc-900 dark:bg-white dark:text-black dark:border-white dark:shadow-[3px_3px_0px_#ffffff]',
    yellow:
      'bg-[#fde047] text-black border-2 border-black shadow-[3px_3px_0px_#000000] hover:bg-[#fef08a] dark:text-black dark:border-black',
    cyan:
      'bg-[#67e8f9] text-black border-2 border-black shadow-[3px_3px_0px_#000000] hover:bg-[#a5f3fc] dark:text-black dark:border-black',
    orange:
      'bg-[#fb923c] text-black border-2 border-black shadow-[3px_3px_0px_#000000] hover:bg-[#fdba74] dark:text-black dark:border-black',
    ghost:
      'bg-transparent text-black dark:text-zinc-200 border-2 border-transparent hover:border-black dark:hover:border-zinc-400 hover:bg-white/80 dark:hover:bg-zinc-800',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs font-bold gap-1.5',
    md: 'px-3.5 py-2 text-xs sm:text-sm font-bold gap-2',
    lg: 'px-5 py-2.5 text-sm sm:text-base font-bold gap-2.5',
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{
        x: -1,
        y: -1,
        boxShadow: '4px 4px 0px #000000',
        transition: { duration: 0.1 },
      }}
      whileTap={{
        x: 2,
        y: 2,
        boxShadow: '0px 0px 0px #000000',
        transition: { duration: 0.05 },
      }}
      className={`inline-flex items-center justify-center font-sans tracking-tight transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed ${
        fullWidth ? 'w-full' : ''
      } ${variantStyles[variant] || variantStyles.primary} ${sizeStyles[size] || sizeStyles.md} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />}
      {children && <span>{children}</span>}
      {IconRight && <IconRight className="w-4 h-4 shrink-0 stroke-[2.2]" />}
    </motion.button>
  );
}
