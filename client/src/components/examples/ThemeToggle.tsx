import ThemeToggle from '../ThemeToggle'

export default function ThemeToggleExample() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Theme Toggle</h3>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <p className="text-sm text-muted-foreground">
            Click to toggle between light and dark themes
          </p>
        </div>
      </div>
    </div>
  )
}