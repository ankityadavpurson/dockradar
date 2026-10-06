import { Modal as XModal } from 'xedonium'

const WIDTHS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
}

/**
 * Thin adapter over xedonium's Modal: keeps the app's `size` / mounted-means-open
 * contract. Pass `title` as a string or a node.
 */
export default function Modal({ title, onClose, size = 'md', footer, children, ariaLabel, ...rest }) {
  return (
    <XModal open onClose={onClose} title={title} footer={footer}
      maxWidth={WIDTHS[size] ?? WIDTHS.md} aria-label={ariaLabel} {...rest}>
      <div className="flex flex-col gap-3 px-6 py-5">{children}</div>
    </XModal>
  )
}
