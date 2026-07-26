import type { ReactNode } from 'react'
import { cx } from './cx'

/** The mono section label that opens every block in the workspace. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('font-mono text-[9.5px] tracking-[0.2em] text-faint', className)}>
      {children}
    </div>
  )
}
