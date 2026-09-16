const CheckBox = ({ checked, onChange, id, ariaLabel }) => (
  <div className="inline-flex items-center">
    <label className="flex items-center cursor-pointer relative">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={ariaLabel}
        className="checkbox peer" id={id} />
      <span className="checkbox-mark absolute opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2.5 6.5l2.25 2.25L9.5 3.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
  </div>
)

export default CheckBox
