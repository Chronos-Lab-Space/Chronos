import type { ReactNode } from 'react'
import { cx } from './cx'

/** Every screen sits in the same editorial column: 42/56/64 padding at the
 *  design width, tightened on narrow viewports. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('px-5 pt-8 pb-14 md:px-10 lg:px-14 lg:pt-[42px] lg:pb-16', className)}>
      {children}
    </div>
  )
}
