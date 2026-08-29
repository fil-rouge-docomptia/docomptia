export default function LoginRoutePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-[440px] text-center">
        <p className="text-xl font-semibold tracking-[-0.25px] text-foreground">Docomptia</p>
        <div className="mt-6 rounded-xl border bg-card p-8 text-left shadow-elevation-2">
          <h1 className="text-2xl font-semibold tracking-[-0.5px]">Welcome to Docomptia</h1>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            Authentication is available from this public route.
          </p>
        </div>
      </div>
    </main>
  )
}
