import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts } = useToast();

  return (
    // Default auto-dismiss for every toast — a toast can still opt out
    // individually by passing duration: Infinity to toast({...}) (e.g. the
    // low-stock alert in useSocket.ts, which should stay until staff
    // actively dismisses it). Previously this was Infinity globally, so
    // every toast — including routine login/signup feedback — required a
    // manual close and piled up on screen.
    <ToastProvider duration={1500}>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
