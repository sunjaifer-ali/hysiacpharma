export function DeveloperNote({ className = "" }: { className?: string }) {
  return (
    <footer className={`space-y-2 text-center text-[11px] leading-relaxed text-muted-foreground ${className}`}>
      <p className="mx-auto max-w-sm">
        Hysiac GST Billing supports sales invoices, quotations, purchases, customer receipts, supplier payments,
        credit notes and GST reports. Please review transaction details and verify tax calculations with your
        accountant before filing GST returns.
      </p>
      <p>Hysiac Pharmaceuticals Pvt Ltd · Business billing system</p>
    </footer>
  );
}
