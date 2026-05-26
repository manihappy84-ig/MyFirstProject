interface ProgressBarProps {
  progress: number
  label?: string
  showPercent?: boolean
  color?: 'blue' | 'green' | 'purple'
}

export function ProgressBar({
  progress,
  label,
  showPercent = true,
  color = 'blue',
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress))

  const gradients = {
    blue: 'from-blue-500 to-cyan-400',
    green: 'from-green-500 to-emerald-400',
    purple: 'from-purple-500 to-pink-400',
  }

  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-2">
          {label && <span className="text-sm text-gray-300 font-medium">{label}</span>}
          {showPercent && (
            <span className="text-sm font-bold text-white tabular-nums">{clamped}%</span>
          )}
        </div>
      )}
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${gradients[color]} rounded-full progress-bar`}
          style={{ width: `${clamped}%` }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
