import Checkbox from 'xedonium/Checkbox'

const CheckBox = ({ checked, onChange, ariaLabel }) => (
  <Checkbox checked={checked} onChange={onChange} aria-label={ariaLabel} />
)

export default CheckBox
