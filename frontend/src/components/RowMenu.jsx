import { ActionMenu, MoreVerticalIcon } from 'xedonium'

/** Per-row ⋮ actions menu (xedonium ActionMenu: portalled, flips near viewport edges). */
const RowMenu = ({ container: c, hasCompose, isBusy, onConfirmUpdate, onComposeUpdate, onConfirmDelete, onShowDetails }) => {
  const outdated = c.update_status === 'update_available'

  const items = [
    { key: 'details', label: 'View details', onClick: () => onShowDetails && onShowDetails(c) },
    hasCompose && { key: 'compose', label: 'Update via compose', onClick: () => onComposeUpdate && onComposeUpdate(c) },
    {
      key: 'update',
      label: outdated ? 'Update (pull + recreate)' : 'Re-pull & recreate',
      onClick: () => onConfirmUpdate(c),
    },
    { key: 'remove', label: 'Remove container', tone: 'warning', hasDialog: true, onClick: () => onConfirmDelete(c) },
  ].filter(Boolean).map(i => ({ ...i, disabled: isBusy }))

  return (
    <ActionMenu
      label={`Actions for ${c.name}`}
      trigger={<MoreVerticalIcon className="h-4 w-4 shrink-0" />}
      variant="flat"
      placement="bottom-end"
      items={items}
    />
  )
}

export default RowMenu
