interface TagInheritSwitchProps {
  inherit: boolean
  onChange: (inherit: boolean) => void
  inheritLabel?: string
  customLabel?: string
  ariaLabel?: string
}

export function TagInheritSwitch({
  inherit,
  onChange,
  inheritLabel = 'Inherit',
  customLabel = 'Custom',
  ariaLabel = 'Toggle inherit or custom'
}: TagInheritSwitchProps) {
  return (
    <div className="tag-inherit-switch" aria-label={ariaLabel}>
      <span
        className={`tag-inherit-switch__label${inherit ? ' tag-inherit-switch__label--active' : ''}`}
      >
        {inheritLabel}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={!inherit}
        className={`tag-inherit-switch__track${inherit ? '' : ' tag-inherit-switch__track--custom'}`}
        onClick={() => onChange(!inherit)}
      >
        <span className="tag-inherit-switch__thumb" />
      </button>
      <span
        className={`tag-inherit-switch__label${!inherit ? ' tag-inherit-switch__label--active' : ''}`}
      >
        {customLabel}
      </span>
    </div>
  )
}
