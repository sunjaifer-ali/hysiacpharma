import { cn } from "@/lib/utils";
import logoUrl from "@/assets/hysiac-logo.png";
import markUrl from "@/assets/hysiac-mark.png";

export function HysiacMark({ className }: { className?: string }) {
  return <img src={markUrl} alt="" className={cn("size-9 object-contain", className)} />;
}

export function HysiacLogo({ className }: { className?: string }) {
  return (
    <img
      src={logoUrl}
      alt="Hysiac Pharmaceuticals Pvt Ltd"
      className={cn("mx-auto h-28 w-auto max-w-full object-contain", className)}
    />
  );
}