export function DeveloperNote({ className = "" }: { className?: string }) {
  return (
    <footer className={`space-y-1.5 text-center text-[11px] leading-relaxed text-muted-foreground ${className}`}>
      <p>
        Developed by <span className="font-medium text-foreground">Jaifer Ali</span>
      </p>
      <p>
        <a href="tel:9995080431" className="underline-offset-4 hover:underline">
          Mob 9995080431
        </a>
        <span className="mx-1.5 text-border">·</span>
        <a href="mailto:sunjaifer@gmail.com" className="underline-offset-4 hover:underline">
          sunjaifer@gmail.com
        </a>
      </p>
      <p className="mx-auto max-w-xs">
        This app helps prepare bills and GST working. Check the figures with your accountant before filing. The developer is not responsible for returns filed from these reports.
      </p>
    </footer>
  );
}
