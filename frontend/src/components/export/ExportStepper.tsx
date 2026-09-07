const steps = ['Selection', 'Validation', 'Format', 'Confirmation']

export function ExportStepper({ step }: { step: 1 | 2 | 3 | 4 }) {
  return <header className="space-y-5">
    <div><h1 className="text-2xl font-semibold tracking-tight">Create export</h1><p className="mt-2 text-sm text-muted-foreground">Step {step} of 4 · {steps[step - 1]}</p></div>
    <ol aria-label="Export steps" className="grid grid-cols-4 gap-2">{steps.map((label, index) => <li aria-current={index + 1 === step ? 'step' : undefined} className="flex flex-col items-center gap-2 text-center text-xs sm:flex-row sm:text-left sm:text-sm" key={label}><span className={`flex size-8 shrink-0 items-center justify-center rounded-full border font-medium ${index + 1 <= step ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'}`}>{index + 1}</span><span className={index + 1 === step ? 'font-medium' : 'text-muted-foreground'}>{label}</span></li>)}</ol>
    <div aria-label="Export setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={step * 25} className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar"><div className="h-full rounded-full bg-primary" style={{ width: `${step * 25}%` }} /></div>
  </header>
}
