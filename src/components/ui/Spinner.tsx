export function Spinner({ center = true }: { center?: boolean }) {
  const spinner = <div className="spinner" />
  if (!center) return spinner
  return <div className="flex justify-center p-12">{spinner}</div>
}
