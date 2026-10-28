export function DeveloperNote({ className = "" }: { className?: string }) {
  return (
    <footer className={`text-center text-[11px] leading-relaxed text-muted-foreground ${className}`}>
      <p>App developed for Hysiac by Jaifer M, for personal use only.</p>
    </footer>
  );
}
